export function decodeBitmap(bytes, width, height) {
	const imageData = new ImageData(width, height);
	const data = imageData.data;

	for (let pixelIdx = 0; pixelIdx < width * height; pixelIdx++) {
		const byteIdx = pixelIdx >> 2; // / 4
		const shift = 6 - (pixelIdx & 3) * 2;
		const twoBit = (bytes[byteIdx] >> shift) & 0x03;
		const gray = twoBit * 85; // Map 0-3 to 0-255

		const rgbaIdx = pixelIdx * 4;
		data[rgbaIdx] = gray;
		data[rgbaIdx + 1] = gray;
		data[rgbaIdx + 2] = gray;
		data[rgbaIdx + 3] = 255;
	}

	return imageData;
}
