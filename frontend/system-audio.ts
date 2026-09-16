import processor from "./processor.js?url";

const audioURL = "ws://localhost:37812/audio";

export async function testSystemAudioSocket(): Promise<boolean> {
	return new Promise((resolve) => {
		const socket = new WebSocket(audioURL);

		socket.onopen = () => {
			socket.close();
			resolve(true);
		};

		socket.onerror = () => {
			resolve(false);
		};
	});
}

export async function getSystemAudioTrack(): Promise<MediaStreamTrack> {
	const sampleRate = 48000;

	const audioContext = new AudioContext({
		sampleRate,
		latencyHint: "interactive",
	});

	await audioContext.audioWorklet.addModule(processor);
	await audioContext.resume();

	const samples = new SharedArrayBuffer(
		sampleRate * 2 * Float32Array.BYTES_PER_ELEMENT,
	);

	const indexes = new SharedArrayBuffer(2 * Int32Array.BYTES_PER_ELEMENT);

	const ring = {
		sampleRate,
		samples: new Float32Array(samples),
		indexes: new Int32Array(indexes),
	};

	const player = new AudioWorkletNode(audioContext, "pcm-player", {
		processorOptions: { sampleRate, samples, indexes },
		numberOfInputs: 0,
		numberOfOutputs: 1,
		outputChannelCount: [2],
	});

	const destination = audioContext.createMediaStreamDestination();
	player.connect(destination);

	const socket = new WebSocket(audioURL);
	socket.binaryType = "arraybuffer";

	socket.onmessage = async (event) => {
		const payload = new Float32Array(event.data);
		const frames = payload.length / 2;

		const write = Atomics.load(ring.indexes, 0);
		let read = Atomics.load(ring.indexes, 1);
		const avail = write - read;

		if (avail + frames > ring.sampleRate) {
			const drop = avail + frames - ring.sampleRate;
			read += drop;
			Atomics.store(ring.indexes, 1, read);
		}

		for (let i = 0; i < frames; i++) {
			const frameIndex = (write + i) % ring.sampleRate;
			const sourceIndex = i * 2;
			const destinationIndex = frameIndex * 2;

			ring.samples[destinationIndex] = payload[sourceIndex] as number;
			ring.samples[destinationIndex + 1] = payload[sourceIndex + 1] as number;
		}

		Atomics.store(ring.indexes, 0, write + frames);
	};

	const track = destination.stream.getAudioTracks()[0];
	if (track === undefined) throw new Error("system audio track is undefined");

	return track;
}
