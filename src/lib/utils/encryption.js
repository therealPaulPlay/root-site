/**
 * Encryption utility using Curve25519 (X25519) and AES-256-GCM
 */

export class Encryption {
  static async generateKeypair() {
    const keyPair = await crypto.subtle.generateKey(
      { name: 'ECDH', namedCurve: 'X25519' },
      true,
      ['deriveKey', 'deriveBits']
    );

    const publicKey = await crypto.subtle.exportKey('raw', keyPair.publicKey);
    const privateKeyPKCS8 = await crypto.subtle.exportKey('pkcs8', keyPair.privateKey);

    // Extract raw 32-byte key from PKCS#8 wrapper with validation
    const privateKeyBytes = new Uint8Array(privateKeyPKCS8);
    if (privateKeyBytes.length !== 48) {
      throw new Error('Unexpected PKCS#8 private key length');
    }
    const privateKey = privateKeyBytes.slice(-32);

    return {
      publicKey: new Uint8Array(publicKey),
      privateKey
    };
  }

  static async deriveSharedSecret(yourPrivateKey, theirPublicKey) {
    if (yourPrivateKey.length !== 32) {
      throw new Error('Private key must be 32 bytes');
    }

    const privateKey = await crypto.subtle.importKey(
      'pkcs8',
      addPKCS8Wrapper(yourPrivateKey),
      { name: 'ECDH', namedCurve: 'X25519' },
      false,
      ['deriveBits']
    );

    const publicKey = await crypto.subtle.importKey(
      'raw',
      theirPublicKey,
      { name: 'ECDH', namedCurve: 'X25519' },
      false,
      []
    );

    const sharedSecretBits = await crypto.subtle.deriveBits(
      { name: 'ECDH', public: publicKey },
      privateKey,
      256
    );

    const sharedSecret = new Uint8Array(sharedSecretBits);

    // Check for all-zero shared secret (weak key)
    if (sharedSecret.every(b => b === 0)) {
      throw new Error('Weak shared secret detected');
    }

    const hkdfKey = await crypto.subtle.importKey(
      'raw',
      sharedSecret,
      'HKDF',
      false,
      ['deriveKey']
    );

    const derivedKey = await crypto.subtle.deriveKey(
      {
        name: 'HKDF',
        hash: 'SHA-256',
        salt: new Uint8Array(0),
        info: new TextEncoder().encode('root-camera-encryption')
      },
      hkdfKey,
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );

    const keyBytes = await crypto.subtle.exportKey('raw', derivedKey);
    return new Uint8Array(keyBytes);
  }

  constructor(sharedSecret) {
    this.ready = crypto.subtle.importKey(
      'raw',
      sharedSecret,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    ).then(key => this.key = key);
  }

  async encrypt(data) {
    await this.ready;
    const plaintext = typeof data === 'string' ? new TextEncoder().encode(data) : data;
    const nonce = crypto.getRandomValues(new Uint8Array(12));

    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: nonce },
      this.key,
      plaintext
    );

    const result = new Uint8Array(nonce.length + ciphertext.byteLength);
    result.set(nonce);
    result.set(new Uint8Array(ciphertext), nonce.length);

    return btoa(String.fromCharCode(...result));
  }

  async decrypt(ciphertextB64) {
    await this.ready;
    const ciphertext = Uint8Array.from(atob(ciphertextB64), c => c.charCodeAt(0));

    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: ciphertext.slice(0, 12) },
      this.key,
      ciphertext.slice(12)
    );

    return new Uint8Array(plaintext);
  }
}

export const encodePublicKey = (key) => btoa(String.fromCharCode(...key));
export const decodePublicKey = (str) => Uint8Array.from(atob(str), c => c.charCodeAt(0));

function addPKCS8Wrapper(rawKey) {
  const prefix = new Uint8Array([
    0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06,
    0x03, 0x2b, 0x65, 0x6e, 0x04, 0x22, 0x04, 0x20
  ]);
  const result = new Uint8Array(prefix.length + rawKey.length);
  result.set(prefix);
  result.set(rawKey, prefix.length);
  return result;
}
