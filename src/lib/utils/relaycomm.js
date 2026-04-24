import { toast } from "svelte-sonner";
import { Client } from "root-e2ee-protocol";
import { pairedProductsKeyStore } from "./pairedProductsStorage.js";

export class RelayComm {
	#ws = null;
	#client;
	#reconnectTimeout;
	#connectionLostToastTimeout;
	#reconnectAttempt = 0;
	#intentionalDisconnect = false;
	#hasConnected = false;
	#onConnectQueue = [];

	constructor(relayDomain, deviceId) {
		this.relayDomain = relayDomain;
		this.deviceId = deviceId;
		this.#client = new Client({ selfId: deviceId, keyStore: pairedProductsKeyStore });
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
				} catch (error) {
					console.error("onConnected callback error:", error);
				}
			} else {
				this.#onConnectQueue.push(fn);
			}
		}, 250);
	}

	async connect() {
		if (this.#ws?.readyState === WebSocket.OPEN) return;

		if (this.#ws) this.#teardownSocket(); // Clean up existing connection
		this.#intentionalDisconnect = false;

		return new Promise((resolve) => {
			this.#ws = new WebSocket(`wss://${this.relayDomain}/ws?client-id=${this.deviceId}`);
			this.#ws.onopen = () => {
				if (this.#reconnectAttempt > 1) toast.info("Reconnected!");
				this.#hasConnected = true;
				this.#reconnectAttempt = 0;
				console.info("Relay connection opened.");
				for (const fn of this.#onConnectQueue) {
					try { fn(); } catch (error) { console.error("onConnected callback error:", error); }
				}
				this.#onConnectQueue = [];
				resolve();
			};
			this.#ws.onerror = (error) => {
				if (!this.#intentionalDisconnect && !this.#hasConnected && this.#reconnectAttempt === 0)
					toast.error("Relay connection error.");
				console.error("Relay connection error:", error);
			};
			this.#ws.binaryType = "arraybuffer";
			this.#ws.onmessage = (e) => {
				this.#client.receive(new Uint8Array(e.data)).catch((error) => {
					console.error("Failed to handle WebSocket message:", error);
				});
			};
			this.#ws.onclose = () => {
				console.warn("Relay connection closed.");

				if (!this.#intentionalDisconnect) {
					this.#ws = null; // To prevent .disconnect() attempt on .connect() - not needed, since we are already disconnected

					// Reconnect with exponential back-off (first attempt is synchronous)
					const reconnect = () =>
						this.connect().catch((error) => {
							console.error("Reconnecting to the relay failed:", error);
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

	// Send an encrypted request and resolve with the decrypted reply
	// Throws if not connected or the request times out
	async request(productId, type, payload = {}) {
		if (this.#ws?.readyState !== WebSocket.OPEN) throw new Error("Not connected");
		try {
			return await this.#client.request(productId, type, payload, this.#write);
		} catch (error) {
			// disconnect() was called mid-flight; caller cancelled, so never settle
			if (error.message === "Client closed") return new Promise(() => { });
			throw error;
		}
	}

	// Register a handler for server-initiated push messages from a specific product
	onPush(productId, type, handler) {
		this.#client.onPush(productId, type, handler);
	}

	offPush(productId, type, handler) {
		this.#client.offPush(productId, type, handler);
	}

	// Intentional disconnect: tear down the socket and release the underlying client
	// Pending requests are rejected immediately rather than waiting for the request timeout
	disconnect() {
		this.#teardownSocket();
		this.#client.close();
	}

	#teardownSocket() {
		this.#intentionalDisconnect = true;
		clearTimeout(this.#reconnectTimeout);
		clearTimeout(this.#connectionLostToastTimeout);
		this.#reconnectAttempt = 0;

		this.#ws?.close();
		this.#ws = null;
		this.#onConnectQueue = [];
	}

	#write = (bytes) => {
		if (this.#ws?.readyState !== WebSocket.OPEN) throw new Error("Not connected");
		this.#ws.send(bytes);
	};
}