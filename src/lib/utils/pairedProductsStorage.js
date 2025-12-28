const STORAGE_KEY = "pairedProducts";

export function getAllProducts() {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
}

export function getProduct(productId) {
    return getAllProducts().find(p => p.id === productId) || null;
}

export function saveProduct(product) {
    if (!product.id || !product.name || !product.productPublicKey || !product.devicePublicKey || !product.type) {
        throw new Error("Product must have id, name, productPublicKey, devicePublicKey, and type");
    }

    const products = getAllProducts();
    const index = products.findIndex(p => p.id === product.id);

    if (index >= 0) {
        products[index] = product;
    } else {
        products.push(product);
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(products));
}

export function removeProduct(productId) {
    const products = getAllProducts().filter(p => p.id !== productId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(products));
}
