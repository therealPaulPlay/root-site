// Captures the current frame of a video element as a canvas and appends it to the given container.
export function snapshotVideo(videoElement, container) {
	if (!videoElement?.videoWidth || !container) return null;
	const canvas = Object.assign(document.createElement("canvas"), {
		width: videoElement.videoWidth,
		height: videoElement.videoHeight,
		className: videoElement.className
	});
	canvas.getContext("2d").drawImage(videoElement, 0, 0);
	container.appendChild(canvas);
	return canvas;
}

// Captures the current frame of a video element and returns it as a low-res data URL.
export function snapshotVideoSrc(videoElement) {
	if (!videoElement?.videoWidth || videoElement.readyState < 2) return null;
	const scale = Math.min(1, 640 / videoElement.videoWidth);
	const canvas = document.createElement("canvas");
	canvas.width = Math.round(videoElement.videoWidth * scale);
	canvas.height = Math.round(videoElement.videoHeight * scale);
	canvas.getContext("2d").drawImage(videoElement, 0, 0, canvas.width, canvas.height);
	return canvas.toDataURL("image/jpeg", 0.65);
}
