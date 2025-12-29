import { getProduct } from "./pairedProductsStorage";
import { Encryption, decodeKey } from "./encryption";

export async function encryptPayload(productId, payload) {
	const product = getProduct(productId);
	if (!product) throw new Error("Product not found");

	const sharedSecret = await Encryption.deriveSharedSecret(
		decodeKey(product.devicePrivateKey),
		decodeKey(product.productPublicKey)
	);

	const encryption = new Encryption(sharedSecret);
	return await encryption.encrypt(JSON.stringify(payload));
}
