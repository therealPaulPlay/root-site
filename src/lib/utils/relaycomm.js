import { Encryption, encodeKey, decodeKey } from './encryption.js';
import { getProduct, saveProduct } from './pairedProductsStorage.js';

export class RelayComm {
  #ws = null;
  #encryptions = new Map();
  #pendingMessages = new Map(); // productId -> single message to retry
  #renewingKeys = new Set(); // Track which products are currently renewing keys
  #handlers = new Map();

  constructor(relayDomain, deviceId) {
    this.relayDomain = relayDomain;
    this.deviceId = deviceId;
  }

  async connect() {
    if (this.#ws?.readyState === WebSocket.OPEN) return;

    return new Promise((resolve, reject) => {
      this.#ws = new WebSocket(`wss://${this.relayDomain}/ws?device-id=${this.deviceId}`);
      this.#ws.onopen = () => resolve();
      this.#ws.onerror = reject;
      this.#ws.onmessage = (e) => this.#handleMessage(JSON.parse(e.data));
      this.#ws.onclose = () => setTimeout(() => this.connect().catch(() => {}), 5000);
    });
  }

  async #getEncryption(productId) {
    if (this.#encryptions.has(productId)) return this.#encryptions.get(productId);

    const product = getProduct(productId);
    if (!product) throw new Error('Product not found');

    const secret = await Encryption.deriveSharedSecret(
      decodeKey(product.devicePrivateKey),
      decodeKey(product.productPublicKey)
    );

    const encryption = new Encryption(secret);
    await encryption.ready;
    this.#encryptions.set(productId, encryption);
    return encryption;
  }

  async #handleMessage(msg) {
    const encryption = await this.#getEncryption(msg.productId);
    const payload = JSON.parse(
      new TextDecoder().decode(await encryption.decrypt(msg.encryptedPayload))
    );

    if (!payload.success && payload.error?.includes('expired')) {
      // If already renewing keys for this product, skip
      if (this.#renewingKeys.has(msg.productId)) return;
      this.#renewingKeys.add(msg.productId);

      const newKeypair = await Encryption.generateKeypair();

      // Get the pending message if any
      const pendingMessage = this.#pendingMessages.get(msg.productId);
      this.#pendingMessages.delete(msg.productId);

      // Renew the key
      await this.send(msg.productId, 'renewKey', { newPublicKey: encodeKey(newKeypair.publicKey) });

      const product = getProduct(msg.productId);
      product.devicePrivateKey = encodeKey(newKeypair.privateKey);
      saveProduct(product);

      this.#encryptions.delete(msg.productId);
      this.#renewingKeys.delete(msg.productId);

      // Retry the pending message if there was one
      if (pendingMessage) await this.send(msg.productId, pendingMessage.type, pendingMessage.data);
      return;
    }

    // Check if this message is a response to our pending request
    const pendingMessage = this.#pendingMessages.get(msg.productId);
    if (pendingMessage && msg.type === pendingMessage.type + 'Result') {
      this.#pendingMessages.delete(msg.productId);
    }

    const handlers = this.#handlers.get(msg.type);
    if (handlers) handlers.forEach(handler => handler(payload));
  }

  async send(productId, type, data = {}) {
    if (this.#ws?.readyState !== WebSocket.OPEN) throw new Error('Not connected');

    // Store message in pending
    this.#pendingMessages.set(productId, { type, data });

    const encryption = await this.#getEncryption(productId);
    const encrypted = await encryption.encrypt(JSON.stringify(data));

    this.#ws.send(JSON.stringify({
      type,
      target: 'product',
      productId,
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
    this.#encryptions.clear();
    this.#pendingMessages.clear();
    this.#renewingKeys.clear();
  }
}