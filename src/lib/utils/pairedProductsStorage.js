import { Capacitor, registerPlugin } from "@capacitor/core";
import { deriveSession } from "root-e2ee-protocol";

const STORAGE_KEY = "pairedProducts";

// Native storage plugin for syncing product keys to iOS/Android native layer
// so notification service extensions can access them for decryption
const NativeStorage = Capacitor.isNativePlatform() ? registerPlugin("NativeStorage") : null;

function syncToNative(products) {
	// Only sync the fields needed for notification decryption
	const minimal = products.map((p) => ({
		id: p.id,
		productPublicKey: p.productPublicKey,
		devicePrivateKey: p.devicePrivateKey,
		previousDevicePrivateKey: p.previousDevicePrivateKey
	}));
	NativeStorage?.sync({ products: JSON.stringify(minimal) }).catch((error) =>
		console.error("Failed to sync products to native storage:", error)
	);
}

export function getAllProducts() {
	const data = localStorage.getItem(STORAGE_KEY);
	try {
		return data ? JSON.parse(data) : [];
	} catch (error) {
		console.error("Error getting all products:", error);
		return [];
	}
}

export function getProduct(productId) {
	return getAllProducts().find((p) => p.id === productId) || null;
}

export function saveProduct(product) {
	if (
		!product.id ||
		!product.name ||
		!product.productPublicKey ||
		!product.devicePublicKey ||
		!product.devicePrivateKey ||
		product.previousDevicePrivateKey === undefined || // Can explicitly be null
		!product.keyCreatedAt ||
		!product.model
	) {
		throw new Error(
			"Product must have id, name, productPublicKey, devicePublicKey, devicePrivateKey, previousDevicePrivateKey, keyCreatedAt, and model"
		);
	}

	const products = getAllProducts();
	const index = products.findIndex((p) => p.id === product.id);

	if (index >= 0) products[index] = product;
	else products.push(product);

	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(products));
		syncToNative(products);
	} catch (error) {
		console.error("Failed to save product:", error);
	}
}

export function removeProduct(productId) {
	const products = getAllProducts().filter((p) => p.id !== productId);
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(products));
		syncToNative(products);
	} catch (error) {
		console.error("Failed to remove product:", error);
	}
}

// Keys on disk are base64-encoded; the library works in raw Uint8Array at the boundary
export function b64ToBytes(s) {
	const binary = atob(s);
	return Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
}

export function bytesToB64(bytes) {
	let binary = "";
	for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
	return btoa(binary);
}

// Derive an AES-GCM session for talking to a paired product (e.g. over Bluetooth)
export async function sessionFromProduct(productId) {
	const p = getProduct(productId);
	if (!p) throw new Error(`Product ${productId} not paired`);
	return deriveSession(b64ToBytes(p.devicePrivateKey), b64ToBytes(p.productPublicKey));
}

// KeyStore adapter for root-e2ee-protocol
export const pairedProductsKeyStore = {
	async getServerPublicKey(productId) {
		const p = getProduct(productId);
		if (!p?.productPublicKey) return null;
		return b64ToBytes(p.productPublicKey);
	},
	async getCurrentPrivateKey(productId) {
		const p = getProduct(productId);
		if (!p?.devicePrivateKey) return null;
		return {
			privateKey: b64ToBytes(p.devicePrivateKey),
			createdAt: p.keyCreatedAt
		};
	},
	async getPreviousPrivateKey(productId) {
		const p = getProduct(productId);
		if (!p?.previousDevicePrivateKey) return null;
		return {
			privateKey: b64ToBytes(p.previousDevicePrivateKey)
		};
	},
	async commitNewPrivateKey(productId, newPrivateKey) {
		const p = getProduct(productId);
		if (!p) throw new Error(`Product ${productId} not found`);
		p.previousDevicePrivateKey = p.devicePrivateKey;
		p.devicePrivateKey = bytesToB64(newPrivateKey);
		p.keyCreatedAt = Date.now();
		saveProduct(p);
	},
	async revertToPreviousPrivateKey(productId) {
		const p = getProduct(productId);
		if (!p?.previousDevicePrivateKey) return;
		p.devicePrivateKey = p.previousDevicePrivateKey;
		p.previousDevicePrivateKey = null;
		p.keyCreatedAt = Date.now();
		saveProduct(p);
	}
};
