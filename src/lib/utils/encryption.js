import { getProduct } from "./pairedProductsStorage.js";

/**
 * Encryption utility using P-256 (secp256r1) and AES-256-GCM
 */

export class Encryption {
	#key;

	static async initForProduct(productId) {
		const product = getProduct(productId);
		if (!product) throw new Error("Product not found!");

		const encryption = new Encryption();
		encryption.#key = await Encryption.#deriveKey(
			decodeKey(product.devicePrivateKey),
			decodeKey(product.productPublicKey)
		);
		return encryption;
	}

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

	static async #deriveKey(yourPrivateKey, theirPublicKey) {
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
		const hkdfKey = await crypto.subtle.importKey("raw", new Uint8Array(sharedSecretBits), "HKDF", false, [
			"deriveKey"
		]);

		return crypto.subtle.deriveKey(
			{
				name: "HKDF",
				hash: "SHA-256",
				salt: new Uint8Array(0),
				info: new TextEncoder().encode("root-camera-encryption")
			},
			hkdfKey,
			{ name: "AES-GCM", length: 256 },
			false,
			["encrypt", "decrypt"]
		);
	}

	async encrypt(data, aad) {
		const nonce = crypto.getRandomValues(new Uint8Array(12));

		const params = { name: "AES-GCM", iv: nonce };
		if (aad) params.additionalData = aad; // If AAD is provided, add it to params

		const ciphertext = await crypto.subtle.encrypt(
			params,
			this.#key,
			data
		);

		const result = new Uint8Array(nonce.length + ciphertext.byteLength);
		result.set(nonce);
		result.set(new Uint8Array(ciphertext), nonce.length);

		return result;
	}

	async decrypt(ciphertext, aad) {
		const params = { name: "AES-GCM", iv: ciphertext.slice(0, 12) };
		if (aad) params.additionalData = aad; // If AAD is provided, add it to params

		const plaintext = await crypto.subtle.decrypt(
			params,
			this.#key,
			ciphertext.slice(12)
		);

		return new Uint8Array(plaintext);
	}
}

function decodeKey(base64) {
	const binString = atob(base64);
	return Uint8Array.from(binString, (m) => m.charCodeAt(0));
}

export function encodeKey(bytes) {
	return btoa(String.fromCharCode(...bytes));
}

// Compute AAD (Additional Authenticated Data) as SHA256 hash of type|originId|targetId
export async function computeAAD(msgType, originId, targetId) {
	const data = new TextEncoder().encode(`${msgType}|${originId}|${targetId}`);
	const hash = await crypto.subtle.digest("SHA-256", data);
	return new Uint8Array(hash);
}
