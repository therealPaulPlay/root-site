import { toast } from "svelte-sonner";
import { Encryption, encodeKey, decodeKey } from "./encryption.js";
import { getProduct, saveProduct } from "./pairedProductsStorage.js";

const RESULT_SUFFIX = "Result";

export class RelayComm {
	#ws = null;
	#encryptions = new Map();
	#renewalPromises = new Map(); // productId -> Promise (for ongoing renewals)
	#handlers = new Map();

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
			this.#ws.onopen = () => resolve();
			this.#ws.onerror = (e) => {
				toast.error("Websocket relay server error: " + e.msg);
				console.error("WebSocket relay server error:", e);
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
				toast.error("Relay connection closed, attempting reconnect.");
				console.warn("Relay connection closed. Attempting to reconnect in 5s...");
				this.#ws = null;
				setTimeout(() => this.connect().catch((e) => { console.error("Reconnecting to the relay failed:", e) }), 5000)
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

		// Check if key needs renewal (>5 minutes old)
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
			encryptedPayload: encrypted
		}));

		return new Promise((resolve, reject) => {
			const timeout = setTimeout(() => {
				this.off("renewKeyResult", handler);
				reject(new Error("Key renewal timeout"));
			}, 10000);

			const handler = (payload) => {
				clearTimeout(timeout);
				this.off("renewKeyResult", handler);
				payload.success ? resolve() : reject(new Error(payload.error || "Key renewal failed"));
			};

			this.on("renewKeyResult", handler);
		});
	}

	async #handleMessage(msg) {
		let payload;

		// Try to parse as unencrypted JSON first (firmware sends encryption-related errors this way)
		try {
			payload = JSON.parse(msg.encryptedPayload);
		} catch {
			// Not plain JSON - decrypt it
			const encryption = await this.#getEncryption(msg.productId);
			payload = JSON.parse(new TextDecoder().decode(await encryption.decrypt(msg.encryptedPayload)));
		}

		// Route to handlers
		const handlers = this.#handlers.get(msg.type);
		if (handlers) handlers.forEach((handler) => handler(payload));
	}

	async send(productId, type, data = {}) {
		if (this.#ws?.readyState !== WebSocket.OPEN) throw new Error("Not connected");
		if (type === "renewKey") throw new Error("Use #renewKey() internally - do not call send() with renewKey type");

		await this.#ensureKeyFresh(productId);

		const encryption = await this.#getEncryption(productId);
		const encrypted = await encryption.encrypt(JSON.stringify(data));

		this.#ws.send(
			JSON.stringify({
				type,
				target: "product",
				productId,
				deviceId: this.deviceId,
				encryptedPayload: encrypted
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
		this.#ws?.close();
		this.#ws = null;
		this.#encryptions.clear();
		this.#renewalPromises.clear();
	}
}
