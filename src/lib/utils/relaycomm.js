import { toast } from "svelte-sonner";
import { Encryption, encodeKey, decodeKey } from "./encryption.js";
import { getProduct, saveProduct } from "./pairedProductsStorage.js";

export const RELAY_REQUEST_TIMEOUT = 10_000;

export class RelayComm {
	#ws = null;
	#encryptions = new Map();
	#renewalPromises = new Map(); // productId -> Promise (for ongoing renewals)
	#handlers = new Map();
	#pendingRequestTimeouts = new Map(); // requestId -> timeout handle
	#muteConnectionErrors = false;
	#reconnectTimeout;

	constructor(relayDomain, deviceId) {
		this.relayDomain = relayDomain;
		this.deviceId = deviceId;
	}

	async connect() {
		if (this.#ws?.readyState === WebSocket.OPEN) return;

		// Clean up any existing connection
		if (this.#ws) this.disconnect();

		return new Promise((resolve, reject) => {
			this.#ws = new WebSocket(`wss://${this.relayDomain}/ws?device-id=${this.deviceId}`);
			this.#ws.onopen = () => {
				this.#muteConnectionErrors = false;
				resolve();
			}
			this.#ws.onerror = (e) => {
				if (!this.#muteConnectionErrors) toast.error("Websocket relay connection error.");
				console.error("WebSocket relay connection error:", e);
			}
			this.#ws.onmessage = async (e) => {
				try {
					const msg = JSON.parse(e.data);
					await this.#handleMessage(msg);
				} catch (err) {
					if (err.name === "OperationError") return; // Ignore decryption errors (common on hot reload with stale messages)
					console.error("Failed to handle WebSocket message:", err);
				}
			};
			this.#ws.onclose = () => {
				if (!this.#muteConnectionErrors) toast.error("Relay connection closed, attempting reconnect.");
				console.warn("Relay connection closed.");
				this.#muteConnectionErrors = true;
				this.#ws = null;
				this.#reconnectTimeout = setTimeout(() => this.connect().catch((e) => { console.error("Reconnecting to the relay failed – retrying in 5s:", e) }), 5000); // Attempt reconnect
			}
		});
	}

	async #getEncryption(productId) {
		if (this.#encryptions.has(productId)) return this.#encryptions.get(productId);

		const product = getProduct(productId);
		if (!product) throw new Error("Product not found");

		const secret = await Encryption.deriveSharedSecret(
			decodeKey(product.devicePrivateKey),
			decodeKey(product.productPublicKey)
		);

		const encryption = new Encryption(secret);
		await encryption.ready;
		this.#encryptions.set(productId, encryption);
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
		const newKeypair = await Encryption.generateKeypair();

		// Encrypt with OLD key, then immediately switch to NEW key
		const oldEncryption = await this.#getEncryption(productId);
		const encrypted = await oldEncryption.encrypt(JSON.stringify({ newPublicKey: encodeKey(newKeypair.publicKey) }));

		const product = getProduct(productId);
		product.devicePrivateKey = encodeKey(newKeypair.privateKey);
		product.keyCreatedAt = Date.now();
		saveProduct(product);
		this.#encryptions.delete(productId); // Clear cache so next call uses new key for session

		// Send and wait for confirmation
		this.#ws.send(JSON.stringify({
			type: "renewKey",
			target: "product",
			productId,
			deviceId: this.deviceId,
			payload: encrypted
		}));

		return new Promise((resolve, reject) => {
			const timeout = setTimeout(() => {
				this.off("renewKeyResult", onRenewHandler);
				reject(new Error(`Key renewal for product ${productId} timed out`));
			}, RELAY_REQUEST_TIMEOUT);

			const onRenewHandler = (msg) => {
				clearTimeout(timeout);
				this.off("renewKeyResult", onRenewHandler);
				msg.payload.success ? resolve() : reject(new Error(`Key renewal for product ${productId} failed: ` + (msg.payload.error || "Unknown error")));
			};

			this.on("renewKeyResult", onRenewHandler);
		});
	}

	async #handleMessage(msg) {
		// Decrypt payload
		try {
			msg.payload = JSON.parse(msg.payload);
		} catch {
			const encryption = await this.#getEncryption(msg.productId);
			msg.payload = JSON.parse(new TextDecoder().decode(await encryption.decrypt(msg.payload)));
		}

		// Clear pending request timeout if exists
		if (msg.requestId && this.#pendingRequestTimeouts.has(msg.requestId)) {
			clearTimeout(this.#pendingRequestTimeouts.get(msg.requestId));
			this.#pendingRequestTimeouts.delete(msg.requestId);
		}

		// Route to handlers
		const handlers = this.#handlers.get(msg.type);
		if (handlers) handlers.forEach((handler) => handler(msg));
	}

	async send(productId, type, data = {}) {
		if (this.#ws?.readyState !== WebSocket.OPEN) throw new Error("Not connected");
		if (type === "renewKey") throw new Error("Use #renewKey() internally - do not call send() with renewKey type");

		await this.#ensureKeyFresh(productId);

		const encryption = await this.#getEncryption(productId);
		const encrypted = await encryption.encrypt(JSON.stringify(data));

		const requestId = crypto.randomUUID();
		const timeout = setTimeout(() => {
			this.#pendingRequestTimeouts.delete(requestId);
			const errorMsg = `Request ${type} to product ${productId} timed out`;
			console.error(errorMsg);
			toast.error(errorMsg);
		}, RELAY_REQUEST_TIMEOUT);

		this.#pendingRequestTimeouts.set(requestId, timeout);

		this.#ws.send(
			JSON.stringify({
				type,
				target: "product",
				productId,
				deviceId: this.deviceId,
				requestId,
				payload: encrypted
			})
		);
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
		this.#muteConnectionErrors = true; // Do not toast the close event
		this.#ws?.close();
		this.#ws = null;
		this.#encryptions.clear();
		this.#renewalPromises.clear();

		// Clear all pending request timeouts
		this.#pendingRequestTimeouts.forEach(timeout => clearTimeout(timeout));
		this.#pendingRequestTimeouts.clear();
		clearTimeout(this.#reconnectTimeout);
	}
}
