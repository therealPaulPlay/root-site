import * as MP4Box from "mp4box";

// codec config children inside a sample entry (avcC, esds, ...) — preserved verbatim
const DESCRIPTION_BOXES = new Set(["avcC", "hvcC", "esds", "pasp", "colr", "btrt", "vpcC", "av1C"]);

// parse a complete fMP4 buffer, return its single track + extracted samples
function extract(bytes) {
	// keepMdatData=true, otherwise sample bytes get dropped during parse
	const file = MP4Box.createFile(true);
	const samples = [];
	let trak;

	file.onReady = (info) => {
		trak = file.getTrackById(info.tracks[0].id);
		file.setExtractionOptions(info.tracks[0].id);
		file.start();
	};
	file.onSamples = (_id, _user, out) => samples.push(...out);

	const ab = bytes.buffer;
	ab.fileStart = 0;
	file.appendBuffer(ab);

	if (!trak) throw new Error("Failed to parse MP4: no track found");
	return { trak, samples };
}

function trackOptions(trak) {
	const entry = trak.mdia.minf.stbl.stsd.entries[0];
	const opts = {
		type: entry.type,
		timescale: trak.mdia.mdhd.timescale,
		description_boxes: entry.boxes.filter((b) => DESCRIPTION_BOXES.has(b.type))
	};
	if (trak.mdia.hdlr.handler === "soun") {
		opts.hdlr = "soun";
		opts.channel_count = entry.channel_count;
		opts.samplerate = entry.samplerate;
		opts.samplesize = entry.samplesize;
	} else {
		opts.width = entry.width;
		opts.height = entry.height;
	}
	return opts;
}

// combine video-only fMP4 + audio-only fMP4 into one MP4 (no re-encoding)
export function muxVideoAndAudio(videoBytes, audioBytes) {
	const video = extract(videoBytes);
	const audio = extract(audioBytes);
	const out = MP4Box.createFile();
	const videoId = out.addTrack(trackOptions(video.trak));
	const audioId = out.addTrack(trackOptions(audio.trak));

	const copy = (id, samples) => {
		for (const s of samples) {
			out.addSample(id, s.data, { duration: s.duration, dts: s.dts, cts: s.cts, is_sync: s.is_sync });
		}
	};
	copy(videoId, video.samples);
	copy(audioId, audio.samples);

	const stream = new MP4Box.DataStream();
	out.write(stream);
	return new Uint8Array(stream.buffer);
}
