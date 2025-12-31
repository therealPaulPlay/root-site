const STORAGE_KEY = "pairedProducts";

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
		!product.keyCreatedAt ||
		!product.model
	) {
		throw new Error("Product must have id, name, productPublicKey, devicePublicKey, devicePrivateKey, keyCreatedAt, and model");
	}

	const products = getAllProducts();
	const index = products.findIndex((p) => p.id === product.id);

	if (index >= 0) {
		products[index] = product;
	} else {
		products.push(product);
	}

	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(products));
	} catch (error) {
		console.error("Failed to save product:", error);
	}
}

export function removeProduct(productId) {
	const products = getAllProducts().filter((p) => p.id !== productId);
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(products));
	} catch (error) {
		console.error("Failed to remove product:", error);
	}
}
