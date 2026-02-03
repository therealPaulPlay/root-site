export const CODEC = 'video/mp4; codecs="avc1.640028"';

export class MediaSourceManager {
	mediaSource = null;
	sourceBuffer = null;
	pendingChunks = [];
	blobUrl = null;
	isLive = false;
	duration = 0;
	onChunkAppended = null;

	constructor(options = {}) {
		this.isLive = options.isLive ?? false;
		this.duration = options.duration ?? 0;
		this.onChunkAppended = options.onChunkAppended ?? null;
	}

	setup() {
		this.mediaSource = new MediaSource();
		this.blobUrl = URL.createObjectURL(this.mediaSource);

		this.mediaSource.addEventListener("sourceopen", () => {
			if (!this.isLive && this.duration > 0) this.mediaSource.duration = this.duration;
			this.sourceBuffer = this.mediaSource.addSourceBuffer(CODEC);
			this.sourceBuffer.mode = this.isLive ? "sequence" : "segments";
			this.processChunks();
			this.sourceBuffer.addEventListener("updateend", () => {
				this.processChunks();
				this.onChunkAppended?.();
			});
		});

		return this.blobUrl;
	}

	appendChunk(chunk) {
		this.pendingChunks.push(chunk);
		this.processChunks();
	}

	processChunks() {
		if (!this.mediaSource || this.mediaSource.readyState !== "open") return;
		if (!this.sourceBuffer || this.sourceBuffer.updating || this.pendingChunks.length === 0) return;
		try {
			this.sourceBuffer.appendBuffer(this.pendingChunks.shift());
		} catch (err) {
			console.error("Failed to append buffer:", err);
		}
	}

	finalize() {
		if (!this.mediaSource || this.mediaSource.readyState !== "open") return;
		if (this.sourceBuffer?.updating) {
			this.sourceBuffer.addEventListener("updateend", () => this.finalize(), { once: true });
			return;
		}
		try {
			this.mediaSource.endOfStream();
		} catch (err) {
			console.error("Failed to end stream:", err);
		}
	}

	cleanup() {
		if (this.blobUrl) {
			URL.revokeObjectURL(this.blobUrl);
			this.blobUrl = null;
		}
		this.mediaSource = null;
		this.sourceBuffer = null;
		this.pendingChunks = [];
	}
}
