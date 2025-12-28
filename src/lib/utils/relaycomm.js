/**
 * RelayComm WebSocket client with automatic key renewal
 */

import { Encryption, encodePublicKey } from './encryption.js';

export class RelayComm {
  #ws = null;
  #encryption = null;
  #pendingMessages = [];
  #handlers = new Map();

  constructor(relayDomain, deviceId, privateKey, cameraPublicKey) {
    this.relayDomain = relayDomain;
    this.deviceId = deviceId;
    this.privateKey = privateKey;
    this.cameraPublicKey = cameraPublicKey;
  }

  async connect() {
    if (this.#ws?.readyState === WebSocket.OPEN) return;

    await this.#updateEncryption();

    return new Promise((resolve, reject) => {
      this.#ws = new WebSocket(`wss://${this.relayDomain}/ws?device-id=${this.deviceId}`);
      this.#ws.onopen = () => resolve();
      this.#ws.onerror = reject;
      this.#ws.onmessage = (e) => this.#handleMessage(JSON.parse(e.data));
      this.#ws.onclose = () => setTimeout(() => this.connect().catch(() => {}), 5000);
    });
  }

  async #updateEncryption() {
    const secret = await Encryption.deriveSharedSecret(this.privateKey, this.cameraPublicKey);
    this.#encryption = new Encryption(secret);
    await this.#encryption.ready;
  }

  async #handleMessage(msg) {
    const payload = JSON.parse(
      new TextDecoder().decode(await this.#encryption.decrypt(msg.encryptedPayload))
    );

    if (!payload.success && payload.error?.includes('expired')) {
      const newKeypair = await Encryption.generateKeypair();

      await this.send('renewKey', { newPublicKey: encodePublicKey(newKeypair.publicKey) });

      this.privateKey = newKeypair.privateKey;
      await this.#updateEncryption();

      // Retry all pending messages after key renewal
      const messagesToRetry = [...this.#pendingMessages];
      this.#pendingMessages = [];
      for (const { type, data } of messagesToRetry) {
        await this.send(type, data);
      }
      return;
    }

    // Clear pending messages on successful response
    this.#pendingMessages = [];

    const handlers = this.#handlers.get(msg.type);
    if (handlers) handlers.forEach(handler => handler(payload));
  }

  async send(type, data = {}) {
    if (this.#ws?.readyState !== WebSocket.OPEN) throw new Error('Not connected');

    this.#pendingMessages.push({ type, data });
    const encrypted = await this.#encryption.encrypt(JSON.stringify(data));

    this.#ws.send(JSON.stringify({
      type,
      target: 'product',
      deviceId: this.deviceId,
      encryptedPayload: encrypted
    }));
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
  }
}
