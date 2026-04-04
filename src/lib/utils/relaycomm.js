import { toast } from "svelte-sonner";
import { Encoder } from "cbor-x";
import { Encryption, encodeKey, computeAAD } from "./encryption.js";
import { getProduct, saveProduct } from "./pairedProductsStorage.js";

// int64AsNumber avoids BigInt values that break Date() and other JS APIs
const cbor = new Encoder({ useRecords: false, mapsAsObjects: true, int64AsNumber: true });

export const RELAY_REQUEST_TIMEOUT = 10_000;
const KEY_RENEWAL_MSG_TYPES = ["renewKey", "renewKeyAck"];
const ERR_INTENTIONAL_DISCONNECT = "INTENTIONAL_DISCONNECT";
const ERR_DECRYPTION_FAILED = "DECRYPTION_FAILED";

export class RelayComm {
	#ws = null;
	#encryptions = new Map();
	#renewalPromises = new Map(); // productId -> Promise (for ongoing renewals)
	#handlers = new Map();
	#pendingRequestTimeouts = new Map(); // requestId -> timeout handle
	#surfaceDecryptionError = new Set(); // Controls retry gating in #send and error suppression + promise resolution deferral in #handleMessage
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
				try {
					fn();
				} catch (e) {
					console.error("onConnected callback error:", e);
				}
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

		return new Promise((resolve) => {
			this.#ws = new WebSocket(`wss://${this.relayDomain}/ws?client-id=${this.deviceId}`);
			this.#ws.onopen = () => {
				if (this.#reconnectAttempt > 1) toast.info("Reconnected!");
				this.#hasConnected = true;
				this.#reconnectAttempt = 0;
				console.info("Relay connection opened.");
				for (const fn of this.#onConnectQueue) {
					try {
						fn();
					} catch (e) {
						console.error("onConnected callback error:", e);
					}
				}
				this.#onConnectQueue = [];
				resolve();
			};
			this.#ws.onerror = (e) => {
				if (!this.#intentionalDisconnect && !this.#hasConnected && this.#reconnectAttempt === 0)
					toast.error("Relay connection error.");
				console.error("Relay connection error:", e);
			};
			this.#ws.binaryType = "arraybuffer";
			this.#ws.onmessage = async (e) => {
				try {
					const msg = cbor.decode(new Uint8Array(e.data));
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
					const reconnect = () =>
						this.connect().catch((e) => {
							console.error("Reconnecting to the relay failed:", e);
						});
					this.#reconnectAttempt++;
					if (this.#reconnectAttempt === 1) {
						this.#connectionLostToastTimeout = setTimeout(() => {
							if (!this.connected)
								toast.error(
									this.#hasConnected ? "Relay connection lost, reconnecting..." : "Waiting for connection..."
								);
						}, 1500);
						reconnect().finally(() => clearTimeout(this.#connectionLostToastTimeout));
					} else {
						this.#reconnectTimeout = setTimeout(reconnect, Math.min(this.#reconnectAttempt - 1, 3) * 1000);
					}
				}
			};
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
			this.#renewalPromises.set(
				productId,
				this.#renewKey(productId).finally(() => {
					this.#renewalPromises.delete(productId);
				})
			);
		}
		await this.#renewalPromises.get(productId);
	}

	async #renewKey(productId) {
		try {
			const newKeypair = await Encryption.generateKeypair();

			// Step 1: Send renewal request (encrypted with OLD key), wait for camera to confirm
			const renewResult = await this.#send(productId, "renewKey", { newPublicKey: newKeypair.publicKey });

			if (!renewResult.payload.success) {
				throw new Error(
					`Key renewal for product ${productId} failed: ` + (renewResult.payload.error || "Unknown error")
				);
			}

			// Step 2: Commit new key optimistically, persist old key for divergence recovery
			const product = getProduct(productId);
			product.previousDevicePrivateKey = product.devicePrivateKey;
			product.devicePrivateKey = encodeKey(newKeypair.privateKey);
			product.keyCreatedAt = Date.now();
			saveProduct(product);
			this.#encryptions.delete(productId); // Clear cache so next call derives from new key

			// Step 3: Send ACK (encrypted with NEW key), await so no messages are sent before the product switches keys
			// Non-fatal if it fails — mismatch will be detected and reverted on the next firmware-side decryption failure
			try {
				await this.#send(productId, "renewKeyAck", { ack: true });
			} catch {
				console.warn(`Key renewal ACK for product ${productId} not confirmed (will reconcile on next message).`);
			}

			console.log(`Key renewed for product: ${productId}`);
		} catch (e) {
			if (e.message !== ERR_INTENTIONAL_DISCONNECT) throw e;
			else console.warn("Key renewal aborted due to intentional disconnect.");
		}
	}

	async #handleMessage(msg) {
		// Payload should be CBOR bytes — decrypt first if encrypted, then decode
		if (!(msg.payload instanceof Uint8Array)) {
			console.warn("Received non-CBOR payload, ignoring:", msg);
			return;
		}
		msg.payload = cbor.decode(await this.#decryptPayload(msg) ?? msg.payload);

		// Suppress decryption errors unless explicitly marked to surface (after retry or no previous key)
		const suppressDecryptionError = msg.payload?.errorCode === ERR_DECRYPTION_FAILED && !this.#surfaceDecryptionError.has(msg.requestId);
		if (!suppressDecryptionError) {
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
			return await encryption.decrypt(msg.payload, aad);
		} catch {
			// Retry with previous key if available (for in-flight messages after key renewal)
			try {
				console.warn("Failed to decrypt, retrying with previous key.");
				const prevEncryption = await Encryption.initForProduct(msg.originId, true);
				return await prevEncryption.decrypt(msg.payload, aad);
			} catch {
				console.warn("Failed to decrypt with previous key.");
				return null; // Not encrypted (e.g. unencrypted error response) or both keys failed
			}
		}
	}

	send(...args) {
		if (KEY_RENEWAL_MSG_TYPES.includes(args[1])) throw new Error("Reserved message type");
		const inner = this.#send(...args);
		const promise = inner
			.then(() => { })
			.catch((e) => {
				if (e.message !== ERR_INTENTIONAL_DISCONNECT) throw e;
			}); // Discard resolve value + intentional errors
		promise.requestId = inner.requestId;
		return promise;
	}

	#revertToPreviousKey(productId) {
		const product = getProduct(productId);
		if (!product?.previousDevicePrivateKey) return;
		console.warn(`Product ${productId} reports decryption failure, reverting to previous key.`);
		product.devicePrivateKey = product.previousDevicePrivateKey;
		product.previousDevicePrivateKey = null;
		product.keyCreatedAt = Date.now();
		saveProduct(product);
		this.#encryptions.delete(productId);  // Delete cached encryption so that it's re-created using the previous key
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
			const encrypted = await encryption.encrypt(cbor.encode(data), aad);

			// Check again after encryption awaits — disconnect() may have been called
			if (this.#intentionalDisconnect) throw new Error(ERR_INTENTIONAL_DISCONNECT);

			const msg = await new Promise((resolve, reject) => {
				const timeout = setTimeout(() => {
					this.#pendingRequestTimeouts.delete(requestId);
					reject(new Error(`Request ${type} to product ${productId} timed out`));
				}, RELAY_REQUEST_TIMEOUT);

				this.#pendingRequestTimeouts.set(requestId, { timeout, resolve, reject });

				this.#ws.send(
					cbor.encode({
						type,
						originId: this.deviceId,
						targetId: productId,
						requestId,
						payload: encrypted
					})
				);
			});

			// On decryption failure: revert to previous key if available, then retry once
			if (msg?.payload?.errorCode === ERR_DECRYPTION_FAILED && !this.#surfaceDecryptionError.has(requestId)) {
				this.#revertToPreviousKey(productId);
				const retry = this.#send(productId, type, data);
				this.#surfaceDecryptionError.add(retry.requestId);
				return retry.finally(() => this.#surfaceDecryptionError.delete(retry.requestId));
			}

			return msg;
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
		this.#surfaceDecryptionError.clear();
		this.#onConnectQueue = [];
	}
}
