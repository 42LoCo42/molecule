import processor from "./processor.js?url";

const baseURL = "ws://localhost:37812";
const audioURL = `${baseURL}/audio`;
const controlURL = `${baseURL}/control`;

export class SystemAudio {
	track!: MediaStreamTrack;
	audioSocket!: WebSocket;
	controlSocket!: WebSocket;

	constructor(
		track: MediaStreamTrack,
		audioSocket: WebSocket,
		controlSocket: WebSocket,
	) {
		this.track = track;
		this.audioSocket = audioSocket;
		this.controlSocket = controlSocket;
	}

	public setLink(node: number, link: boolean) {
		const msg: Control = { node, link };
		this.controlSocket.send(JSON.stringify(msg));
	}
}

export class Target {
	node!: number;
	name!: string;
	running!: boolean;
	linked!: boolean;

	mainEl!: HTMLDivElement;
	nameEl!: HTMLSpanElement;
	linkEl!: HTMLInputElement;
	expire!: boolean;
}

export class Control {
	node!: number;
	link!: boolean;
}

async function testWebsocket(url: string): Promise<boolean> {
	return new Promise((resolve) => {
		const socket = new WebSocket(url);

		socket.onopen = () => {
			socket.close();
			resolve(true);
		};

		socket.onerror = () => {
			resolve(false);
		};
	});
}

export async function testSystemAudioDaemon(): Promise<boolean> {
	const audioOK = await testWebsocket(audioURL);
	const controlOK = await testWebsocket(controlURL);
	return audioOK && controlOK;
}

export async function getSystemAudio(): Promise<SystemAudio> {
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

	const audioSocket = new WebSocket(audioURL);
	audioSocket.binaryType = "arraybuffer";

	audioSocket.onmessage = async (event) => {
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

	const controlSocket = new WebSocket(controlURL);
	controlSocket.binaryType = "arraybuffer";

	return new SystemAudio(track, audioSocket, controlSocket);
}
