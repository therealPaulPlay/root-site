import { toast } from "svelte-sonner";
import { encode, decode } from "cbor-x";
import { Encryption, encodeKey, computeAAD } from "./encryption.js";
import { getProduct, saveProduct } from "./pairedProductsStorage.js";

export const RELAY_REQUEST_TIMEOUT = 10_000;
const KEY_RENEWAL_MSG_TYPES = ["renewKey", "renewKeyAck"];
const ERR_INTENTIONAL_DISCONNECT = "Intentional disconnect";

export class RelayComm {
	#ws = null;
	#encryptions = new Map();
	#prevEncryptions = new Map(); // productId -> previous encryption (temporary during key renewal)
	#renewalPromises = new Map(); // productId -> Promise (for ongoing renewals)
	#handlers = new Map();
	#pendingRequestTimeouts = new Map(); // requestId -> timeout handle
	#reconnectTimeout;
	#connectionLostToastTimeout;
	#reconnectAttempt = 0;
	#intentionalDisconnect = false;
	#hasConnected = false;
	#onConnectQueue = [];

	constructor(relayDomain, deviceId) {
		this.relayDomain = relayDomain;
		this.deviceId = deviceId;
	}

	get connected() {
		return this.#ws?.readyState === WebSocket.OPEN;
	}

	// Run fn when the WebSocket is confirmed open, otherwise queue it for when the connection opens
	// Brief delay lets stale connections close first (e.g. mobile app resume)
	// On iOS, at least ~90ms are required for WebKit to update the WebSocket state
	onConnected(fn) {
		setTimeout(() => {
			if (this.#ws?.readyState === WebSocket.OPEN) {
				try { fn(); } catch (e) { console.error("onConnected callback error:", e); }
			} else {
				this.#onConnectQueue.push(fn);
			}
		}, 250);
	}

	async connect() {
		if (this.#ws?.readyState === WebSocket.OPEN) return;

		// Clean up any existing connection
		if (this.#ws) this.disconnect();

		this.#intentionalDisconnect = false;

		return new Promise((resolve, reject) => {
			this.#ws = new WebSocket(`wss://${this.relayDomain}/ws?client-id=${this.deviceId}`);
			this.#ws.onopen = () => {
				if (this.#reconnectAttempt > 1) toast.info("Reconnected!");
				this.#hasConnected = true;
				this.#reconnectAttempt = 0;
				console.info("Relay connection opened.");
				for (const fn of this.#onConnectQueue) {
					try { fn(); } catch (e) { console.error("onConnected callback error:", e); }
				}
				this.#onConnectQueue = [];
				resolve();
			}
			this.#ws.onerror = (e) => {
				if (!this.#intentionalDisconnect && !this.#hasConnected && this.#reconnectAttempt === 0) toast.error("Relay connection error.");
				console.error("Relay connection error:", e);
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
				console.warn("Relay connection closed.");

				// Only attempt reconnect if this was not an intentional disconnect
				if (!this.#intentionalDisconnect) {
					this.#ws = null; // To prevent .disconnect() attempt on .connect() - not needed, since we are already disconnected

					// Reconnect with exponential back-off (first attempt is synchronous)
					const reconnect = () => this.connect().catch((e) => {
						console.error("Reconnecting to the relay failed:", e);
					});
					this.#reconnectAttempt++;
					if (this.#reconnectAttempt === 1) {
						this.#connectionLostToastTimeout = setTimeout(() => {
							if (!this.connected) toast.error("Relay connection lost, reconnecting...");
						}, 1500);
						reconnect().finally(() => clearTimeout(this.#connectionLostToastTimeout));
					} else {
						this.#reconnectTimeout = setTimeout(reconnect, Math.min(this.#reconnectAttempt - 1, 5) * 1000);
					}
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
		clearTimeout(this.#reconnectTimeout);
		clearTimeout(this.#connectionLostToastTimeout);
		this.#reconnectAttempt = 0;

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
		this.#onConnectQueue = [];
	}
}