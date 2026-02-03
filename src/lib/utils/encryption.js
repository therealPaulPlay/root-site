/**
 * Encryption utility using P-256 (secp256r1) and AES-256-GCM
 */

export class Encryption {
	static async generateKeypair() {
		const keyPair = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, [
			"deriveKey",
			"deriveBits"
		]);

		const publicKey = await crypto.subtle.exportKey("raw", keyPair.publicKey);
		const privateKey = await crypto.subtle.exportKey("pkcs8", keyPair.privateKey);

		return {
			publicKey: new Uint8Array(publicKey),
			privateKey: new Uint8Array(privateKey)
		};
	}

	static async deriveSharedSecret(yourPrivateKey, theirPublicKey) {
		const privateKey = await crypto.subtle.importKey(
			"pkcs8",
			yourPrivateKey,
			{ name: "ECDH", namedCurve: "P-256" },
			false,
			["deriveBits"]
		);

		const publicKey = await crypto.subtle.importKey(
			"raw",
			theirPublicKey,
			{ name: "ECDH", namedCurve: "P-256" },
			false,
			[]
		);

		const sharedSecretBits = await crypto.subtle.deriveBits({ name: "ECDH", public: publicKey }, privateKey, 256);
		const sharedSecret = new Uint8Array(sharedSecretBits);

		const hkdfKey = await crypto.subtle.importKey("raw", sharedSecret, "HKDF", false, ["deriveKey"]);
		const derivedKey = await crypto.subtle.deriveKey(
			{
				name: "HKDF",
				hash: "SHA-256",
				salt: new Uint8Array(0),
				info: new TextEncoder().encode("root-camera-encryption")
			},
			hkdfKey,
			{ name: "AES-GCM", length: 256 },
			true,
			["encrypt", "decrypt"]
		);

		const keyBytes = await crypto.subtle.exportKey("raw", derivedKey);
		return new Uint8Array(keyBytes);
	}

	constructor(sharedSecret) {
		this.ready = crypto.subtle
			.importKey("raw", sharedSecret, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"])
			.then((key) => (this.key = key));
	}

	async encrypt(data) {
		await this.ready;
		const plaintext = typeof data === "string" ? new TextEncoder().encode(data) : data;
		const nonce = crypto.getRandomValues(new Uint8Array(12));

		const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, this.key, plaintext);

		const result = new Uint8Array(nonce.length + ciphertext.byteLength);
		result.set(nonce);
		result.set(new Uint8Array(ciphertext), nonce.length);

		return bytesToBase64(result);
	}

	async decrypt(ciphertextB64) {
		await this.ready;
		const ciphertext = base64ToBytes(ciphertextB64);

		const plaintext = await crypto.subtle.decrypt(
			{ name: "AES-GCM", iv: ciphertext.slice(0, 12) },
			this.key,
			ciphertext.slice(12)
		);

		return new Uint8Array(plaintext);
	}
}

function base64ToBytes(base64) {
	const binString = atob(base64);
	return Uint8Array.from(binString, (m) => m.charCodeAt(0));
}

function bytesToBase64(bytes) {
	return btoa(String.fromCharCode(...bytes));
}

export const encodeKey = (key) => bytesToBase64(key);
export const decodeKey = (str) => base64ToBytes(str);
