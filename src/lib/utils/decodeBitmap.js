export function decodeBitmap(bytes, width, height) {
	const imageData = new ImageData(width, height);
	const data = imageData.data;

	let byteIdx = 0;
	let bitBuf = 0;
	let bitCount = 0;

	for (let pixelIdx = 0; pixelIdx < width * height; pixelIdx++) {
		while (bitCount < 3) {
			bitBuf = (bitBuf << 8) | bytes[byteIdx++];
			bitCount += 8;
		}

		bitCount -= 3;
		const threeBit = (bitBuf >> bitCount) & 0x07;
		const gray = threeBit * 36; // Map 0-7 to 0-252

		const rgbaIdx = pixelIdx * 4;
		data[rgbaIdx] = gray;
		data[rgbaIdx + 1] = gray;
		data[rgbaIdx + 2] = gray;
		data[rgbaIdx + 3] = 255;
	}

	return imageData;
}
