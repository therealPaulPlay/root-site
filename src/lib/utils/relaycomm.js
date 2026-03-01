import { toast } from "svelte-sonner";
import { encode, decode } from "cbor-x";
import { Encryption, encodeKey, computeAAD } from "./encryption.js";
import { getProduct, saveProduct } from "./pairedProductsStorage.js";

export const RELAY_REQUEST_TIMEOUT = 10_000;
const KEY_RENEWAL_MSG_TYPES = ["renewKey", "renewKeyAck"];
const ERR_INTENTIONAL_DISCONNECT = "Intentional disconnect";

export class RelayComm {
	#ws = null;
	#connected = false;
	#encryptions = new Map();
	#prevEncryptions = new Map(); // productId -> previous encryption (temporary during key renewal)
	#renewalPromises = new Map(); // productId -> Promise (for ongoing renewals)
	#handlers = new Map();
	#pendingRequestTimeouts = new Map(); // requestId -> timeout handle
	#muteConnectionErrors = false;
	#reconnectTimeout;
	#intentionalDisconnect = false;

	constructor(relayDomain, deviceId) {
		this.relayDomain = relayDomain;
		this.deviceId = deviceId;
	}

	get connected() {
		return this.#connected;
	}

	async connect() {
		if (this.#ws?.readyState === WebSocket.OPEN) return;

		// Clean up any existing connection
		if (this.#ws) this.disconnect();

		this.#intentionalDisconnect = false;

		return new Promise((resolve, reject) => {
			this.#ws = new WebSocket(`wss://${this.relayDomain}/ws?client-id=${this.deviceId}`);
			this.#ws.onopen = () => {
				this.#connected = true;
				if (this.#muteConnectionErrors) toast.info("Reconnected!"); // If errors are muted (indicating that relay connection is in bad state), toast on reconnect
				this.#muteConnectionErrors = false;
				console.info("Relay connection opened.");
				resolve();
			}
			this.#ws.onerror = (e) => {
				if (!this.#muteConnectionErrors) toast.error("Websocket relay connection failed!");
				this.#muteConnectionErrors = true;
				console.error("WebSocket relay connection error:", e);
			}
			this.#ws.binaryType = "arraybuffer";
			this.#ws.onmessage = async (e) => {
				try {
					const msg = decode(new Uint8Array(e.data));
					await this.#handleMessage(msg);
				} catch (err) {
					console.error("Failed to handle WebSocket message:", err);
				}
			};
			this.#ws.onclose = () => {
				this.#connected = false;
				console.warn("Relay connection closed.");

				// Only attempt reconnect if this was not an intentional disconnect
				if (!this.#intentionalDisconnect) {
					if (!this.#muteConnectionErrors) toast.error("Relay connection closed, attempting reconnect...");
					this.#muteConnectionErrors = true;
					this.#ws = null; // To prevent .disconnect() attempt on .connect() - not needed, since we are already disconnected
					this.#reconnectTimeout = setTimeout(() => this.connect().catch((e) => { console.error("Reconnecting to the relay failed – retrying in 5s:", e) }), 5000);
				}
			}
		});
	}

	async #getEncryption(productId) {
		if (this.#encryptions.has(productId)) return this.#encryptions.get(productId);

		const encryption = await Encryption.initForProduct(productId);
		this.#encryptions.set(productId, encryption); // Cache
		return encryption;
	}

	async #ensureKeyFresh(productId) {
		const product = getProduct(productId);
		if (!product) throw new Error("Product not found");

		// Check if key should be renewed (>5 minutes old)
		const keyAge = Date.now() - (product.keyCreatedAt || 0);
		if (keyAge < 5 * 60 * 1000) return;

		// Wait for existing renewal or start new one
		if (!this.#renewalPromises.has(productId)) {
			this.#renewalPromises.set(productId, this.#renewKey(productId).finally(() => {
				this.#renewalPromises.delete(productId);
			}));
		}
		await this.#renewalPromises.get(productId);
	}

	async #renewKey(productId) {
		try {
			const newKeypair = await Encryption.generateKeypair();

			// Step 1: Send renewal request (encrypted with OLD key), wait for camera to confirm
			const renewResult = await this.#send(productId, "renewKey", { newPublicKey: encodeKey(newKeypair.publicKey) });

			if (!renewResult.payload.success) {
				throw new Error(`Key renewal for product ${productId} failed: ` + (renewResult.payload.error || "Unknown error"));
			}

			// Step 2: Store old encryption temporarily for in-flight chunks
			const oldEncryption = this.#encryptions.get(productId);
			if (oldEncryption) {
				this.#prevEncryptions.set(productId, oldEncryption);
				setTimeout(() => this.#prevEncryptions.delete(productId), 30_000);
			}

			// Step 3: Switch to NEW key locally
			const product = getProduct(productId);
			product.devicePrivateKey = encodeKey(newKeypair.privateKey);
			product.keyCreatedAt = Date.now();
			saveProduct(product);
			this.#encryptions.delete(productId); // Clear cache so next call uses new key

			// Step 4: Send ACK (encrypted with NEW key), wait for confirmation
			const ackResult = await this.#send(productId, "renewKeyAck", { ack: true });

			if (!ackResult.payload.success) {
				throw new Error(`Key renewal ACK for product ${productId} failed: ` + (ackResult.payload.error || "Unknown error"));
			}

			console.log(`Key renewed for product: ${productId}`);
		} catch (e) {
			if (e.message !== ERR_INTENTIONAL_DISCONNECT) throw e;
			else console.warn("Key renewal aborted due to intentional disconnect.");
		}
	}

	async #handleMessage(msg) {
		// Decrypt and decode payload (encrypted CBOR -> decrypted bytes -> CBOR decode)
		// Unencrypted error payloads are already CBOR objects, encrypted ones are Uint8Array
		if (msg.payload instanceof Uint8Array) msg.payload = await this.#decryptPayload(msg);

		// Route to handlers
		const handlers = this.#handlers.get(msg.type);
		if (handlers) {
			handlers.forEach((handler) => {
				try {
					handler(msg);
				} catch (err) {
					console.error(`Error in handler for '${msg.type}':`, err);
				}
			});
		}

		// Clear pending request timeout and resolve promise with the message
		if (msg.requestId && this.#pendingRequestTimeouts.has(msg.requestId)) {
			const { timeout, resolve } = this.#pendingRequestTimeouts.get(msg.requestId);
			clearTimeout(timeout);
			this.#pendingRequestTimeouts.delete(msg.requestId);
			resolve(msg);
		}
	}

	async #decryptPayload(msg) {
		const encryption = await this.#getEncryption(msg.originId);
		const aad = await computeAAD(msg.type, msg.originId, msg.targetId);
		try {
			const decrypted = await encryption.decrypt(msg.payload, aad);
			return decode(decrypted);
		} catch (decryptError) {
			// Retry with old key if available (for in-flight chunks during key renewal)
			const prevEncryption = this.#prevEncryptions.get(msg.originId);
			if (prevEncryption) {
				try {
					const decrypted = await prevEncryption.decrypt(msg.payload, aad);
					return decode(decrypted);
				} catch {
					throw decryptError; // Both keys failed, re-throw original error
				}
			} else {
				throw decryptError;
			}
		}
	}

	send(...args) {
		if (KEY_RENEWAL_MSG_TYPES.includes(args[1])) throw new Error("Reserved message type");
		const inner = this.#send(...args);
		const promise = inner.then(() => { }).catch((e) => { if (e.message !== ERR_INTENTIONAL_DISCONNECT) throw e; }); // Discard resolve value + intentional errors
		promise.requestId = inner.requestId;
		return promise;
	}

	#send(productId, type, data = {}) {
		const requestId = crypto.randomUUID();

		const promise = (async () => {
			if (this.#ws?.readyState !== WebSocket.OPEN) throw new Error("Not connected");
			if (!KEY_RENEWAL_MSG_TYPES.includes(type)) await this.#ensureKeyFresh(productId);

			// After the await, we may have been disconnected
			if (this.#intentionalDisconnect) throw new Error(ERR_INTENTIONAL_DISCONNECT);

			const encryption = await this.#getEncryption(productId);
			const aad = await computeAAD(type, this.deviceId, productId);
			const encrypted = await encryption.encrypt(encode(data), aad);

			// Check again after encryption awaits — disconnect() may have been called
			if (this.#intentionalDisconnect) throw new Error(ERR_INTENTIONAL_DISCONNECT);

			return new Promise((resolve, reject) => {
				const timeout = setTimeout(() => {
					this.#pendingRequestTimeouts.delete(requestId);
					reject(new Error(`Request ${type} to product ${productId} timed out`));
				}, RELAY_REQUEST_TIMEOUT);

				this.#pendingRequestTimeouts.set(requestId, { timeout, resolve, reject });

				this.#ws.send(encode({
					type,
					originId: this.deviceId,
					targetId: productId,
					requestId,
					payload: encrypted
				}));
			});
		})();

		promise.requestId = requestId;
		return promise;
	}

	on(messageType, handler) {
		if (!this.#handlers.has(messageType)) this.#handlers.set(messageType, []);
		this.#handlers.get(messageType).push(handler);
		return this;
	}

	off(messageType, handler) {
		const handlers = this.#handlers.get(messageType);
		if (!handlers) return this;

		const index = handlers.indexOf(handler);
		if (index > -1) handlers.splice(index, 1);

		if (handlers.length === 0) this.#handlers.delete(messageType);
		return this;
	}

	disconnect() {
		this.#intentionalDisconnect = true;
		this.#muteConnectionErrors = true;
		clearTimeout(this.#reconnectTimeout);

		this.#ws?.close();
		this.#ws = null;
		this.#encryptions.clear();
		this.#renewalPromises.clear();
		this.#handlers.clear();

		// Clear all pending request timeouts
		this.#pendingRequestTimeouts.forEach(({ timeout, reject }) => {
			clearTimeout(timeout);
			reject(new Error(ERR_INTENTIONAL_DISCONNECT));
		});
		this.#pendingRequestTimeouts.clear();
	}
}