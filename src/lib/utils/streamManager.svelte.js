import { MediaSourceManager } from "./mediaSourceManager";

export class StreamManager {
	// Reactive state (read-only via getters)
	#loading = $state(true);
	#ended = $state(false);
	#audioActive = $state(false);
	#audioMuted = $state(true);
	#videoStarted = false;
	#initReceived = false;

	// Internal
	#relay;
	#productId;
	#options;
	#videoElement = null;
	#mediaSourceManager = null;
	#heartbeatInterval = null;
	#videoStaleTimeout = null;
	#audioTimeout = null;
	#audioContext = null;
	#audioGainNode = null;
	#nextAudioTime = 0;
	#bufferedChunks = [];

	get loading() {
		return this.#loading;
	}
	get ended() {
		return this.#ended;
	}
	get audioActive() {
		return this.#audioActive;
	}
	get audioMuted() {
		return this.#audioMuted;
	}
	set audioMuted(v) {
		this.#audioMuted = v;
		if (this.#audioGainNode) this.#audioGainNode.gain.value = v ? 0 : 1;
	}

	constructor(productId, relayCommInstance, options = {}) {
		this.#relay = relayCommInstance;
		this.#productId = productId;
		this.#options = options;

		// Chunks arrive as server pushes, dispatched by type
		relayCommInstance.onPush(productId, "streamVideoChunk", this.#handleVideoChunk);
		relayCommInstance.onPush(productId, "streamAudioChunk", this.#handleAudioChunk);

		// Start stream
		this.#startStream();
	}

	async #startStream() {
		try {
			const response = await this.#relay.request(this.#productId, "startStream");
			if (!response.success) return this.#endWithError(new Error(response.error || "Failed to start stream"));
			if (this.#ended) return;
			if (!this.#mediaSourceManager) this.#setupMediaSource();
			this.#startHeartbeat();
			this.#resetVideoStaleTimeout();
		} catch (error) {
			this.#endWithError(error);
		}
	}

	bindVideo(el) {
		this.#videoElement = el;
	}

	// Set up audio context on user interaction for working playback
	// audioUnlockEl is an optional silent <audio> element to unlock iOS audio session
	setupAudio(audioUnlockEl) {
		if (this.#audioContext) return;
		audioUnlockEl?.play()?.catch(() => { });
		this.#audioContext = new AudioContext();
		this.#audioGainNode = this.#audioContext.createGain();
		this.#audioGainNode.gain.value = this.#audioMuted ? 0 : 1;
		this.#audioGainNode.connect(this.#audioContext.destination);
		this.#nextAudioTime = this.#audioContext.currentTime;

		// Convert any pre-buffered raw PCM to AudioBuffers and start immediately
		if (this.#bufferedChunks.length > 0) {
			this.#audioStarted = true;
			this.#nextAudioTime = this.#audioContext.currentTime;
			this.#bufferedChunks = this.#bufferedChunks.map((data) => {
				const buf = this.#audioContext.createBuffer(1, data.length, 48000);
				buf.getChannelData(0).set(data);
				return buf;
			});
			this.#playAudioChunks();
		}
	}

	cleanup() {
		if (this.#ended) return;
		this.#ended = true;
		this.#loading = false;

		// Clear timeouts and intervals
		clearTimeout(this.#videoStaleTimeout);
		clearTimeout(this.#audioTimeout);
		if (this.#heartbeatInterval) {
			clearInterval(this.#heartbeatInterval);
			this.#heartbeatInterval = null;
		}

		// Unregister push handlers
		this.#relay.offPush(this.#productId, "streamVideoChunk", this.#handleVideoChunk);
		this.#relay.offPush(this.#productId, "streamAudioChunk", this.#handleAudioChunk);

		// Media source and video
		if (this.#mediaSourceManager) {
			this.#mediaSourceManager.cleanup();
			this.#mediaSourceManager = null;
		}
		if (this.#videoElement) {
			this.#videoElement.src = "";
			this.#videoElement.load();
		}

		// Audio
		if (this.#audioContext) {
			this.#audioContext.close();
			this.#audioContext = null;
			this.#audioGainNode = null;
		}
		this.#bufferedChunks = [];
		this.#nextAudioTime = 0;
		this.#audioActive = false;
		this.#audioStarted = false;
	}

	// Private --------------------

	#endWithError(error) {
		if (this.#ended) return;
		this.cleanup();
		this.#options.onError?.(error);
	}

	#resetVideoStaleTimeout() {
		clearTimeout(this.#videoStaleTimeout);
		this.#videoStaleTimeout = setTimeout(() => this.#endWithError(new Error("Stream stale")), 10_000);
	}

	#setupMediaSource() {
		const manager = new MediaSourceManager({
			isLive: true,
			onChunkAppended: () => {
				// Buffer ~1s before starting playback
				if (!this.#videoStarted && this.#videoElement?.buffered.length > 0 && this.#videoElement.buffered.end(0) >= 0.9) {
					this.#videoStarted = true;
					this.#loading = false;
					this.#videoElement.play().catch(console.error);
					this.#options.onVideoReady?.(this.#videoElement);
				}
			}
		});
		this.#mediaSourceManager = manager;
		if (this.#videoElement) this.#videoElement.src = manager.setup();
		else manager.setup();
	}

	#handleVideoChunk = (payload, error) => {
		if (error) return console.error("Protocol error for video chunk:", error.message);
		if (!payload.success) return this.#endWithError(new Error(payload.error));
		if (!this.#initReceived && payload.chunkIndex !== 0) return;
		if (payload.chunkIndex === 0) this.#initReceived = true;
		if (this.#videoElement?.error) return this.#endWithError(new Error("Video element error"));

		this.#resetVideoStaleTimeout();
		this.#mediaSourceManager?.appendChunk(payload.chunk);
		this.#correctVideoDrift();
	};

	#handleAudioChunk = (payload, error) => {
		if (error) return console.error("Protocol error for audio chunk:", error.message);
		if (!payload.success) return console.error("Audio stream error:", payload.error);
		if (!this.#audioActive) this.#audioActive = true;

		// Audio timeout to evaluate whether or not audio is active
		clearTimeout(this.#audioTimeout);
		this.#audioTimeout = setTimeout(() => {
			this.#audioActive = false;
		}, 3000);

		// Decode PCM data from chunk field (slice creates aligned copy for Int16Array)
		const pcmData = new Int16Array(payload.chunk.slice().buffer);

		// Convert Int16 PCM to Float32
		const float32Data = new Float32Array(pcmData.length);
		for (let i = 0; i < pcmData.length; i++) {
			float32Data[i] = pcmData[i] / 32768.0;
		}

		// Store raw float data if AudioContext isn't ready yet (keep only latest 2)
		if (!this.#audioContext) {
			this.#bufferedChunks.push(float32Data);
			if (this.#bufferedChunks.length > 2) this.#bufferedChunks.shift();
			return;
		}

		// Create audio buffer (48kHz mono)
		const audioBuffer = this.#audioContext.createBuffer(1, float32Data.length, 48000);
		audioBuffer.getChannelData(0).set(float32Data);
		this.#bufferedChunks.push(audioBuffer);
		this.#scheduleAudio();
	};

	#startHeartbeat() {
		if (this.#heartbeatInterval) return;
		this.#heartbeatInterval = setInterval(async () => {
			try {
				const response = await this.#relay.request(this.#productId, "continueStream");
				if (!response.success) this.#options.onError?.(new Error(response.error || "Stream heartbeat failed"));
			} catch (error) {
				console.error("Failed to send heartbeat:", error);
			}
		}, 2000);
	}

	#correctVideoDrift() {
		if (!this.#videoElement || !this.#videoStarted || this.#videoElement.buffered.length === 0) return;
		const bufferEnd = this.#videoElement.buffered.end(this.#videoElement.buffered.length - 1);
		const buffer = bufferEnd - this.#videoElement.currentTime;

		// Keep buffer around 1s — seek to correct in either direction
		if (buffer > 1.2 || buffer < 0.6) this.#videoElement.currentTime = bufferEnd - 1;
	}

	#audioStarted = false;

	#scheduleAudio() {
		// Wait for 2 chunks (~1s) to arrive, then start scheduling from now
		if (!this.#audioStarted) {
			if (this.#bufferedChunks.length < 2) return;
			this.#audioStarted = true;
			this.#nextAudioTime = this.#audioContext.currentTime;
			this.#playAudioChunks();
			return;
		}

		const now = this.#audioContext.currentTime;
		const audioAhead = this.#nextAudioTime - now;

		// Keep audio ~1s ahead
		if (audioAhead > 1.2 || audioAhead < 0.6) {
			this.#bufferedChunks = this.#bufferedChunks.slice(-1);
			this.#nextAudioTime = now + 1;
		}

		this.#playAudioChunks();
	}

	#playAudioChunks() {
		while (this.#bufferedChunks.length > 0) {
			const chunk = this.#bufferedChunks.shift();
			const source = this.#audioContext.createBufferSource();
			source.buffer = chunk;
			source.connect(this.#audioGainNode);
			source.start(this.#nextAudioTime);
			this.#nextAudioTime += chunk.duration;
		}
	}
}
