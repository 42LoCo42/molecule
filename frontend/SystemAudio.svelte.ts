import { SvelteMap } from "svelte/reactivity";

import {
	AudioPresets,
	type LocalParticipant,
	type LocalTrack,
	Track,
} from "livekit-client";

import processor from "./processor.js?url";

const baseURL = "ws://localhost:37812";
const audioURL = `${baseURL}/audio`;
const controlURL = `${baseURL}/control`;

export namespace Msg {
	export class Node {
		node!: number;
		name!: string;
		running!: boolean;
		linked!: boolean;

		expired: boolean = false;

		constructor(
			node: number,
			name: string,
			running: boolean = false,
			linked: boolean = false,
		) {
			this.node = node;
			this.name = $state(name);
			this.running = $state(running);
			this.linked = $state(linked);
		}
	}

	export class Control {
		constructor(
			public node: number,
			public link: boolean,
		) {}
	}
}

export class SystemAudio {
	constructor(
		public audioSocket: WebSocket,
		public controlSocket: WebSocket,
		public publication: LocalTrack,
	) {}

	autoAdd = false;
	nodes = new SvelteMap<number, Msg.Node>();

	public setLink(node: number, link: boolean) {
		const msg: Msg.Control = { node, link };
		this.controlSocket.send(JSON.stringify(msg));
	}
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

export async function testSystemAudioDaemon() {
	const audioOK = await testWebsocket(audioURL);
	const controlOK = await testWebsocket(controlURL);
	return audioOK && controlOK;
}

export async function getSystemAudio(
	localParticipant: LocalParticipant,
): Promise<SystemAudio> {
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
	audioSocket.onmessage = (event) => {
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

	const decoder = new TextDecoder();

	const track = destination.stream.getAudioTracks()[0];
	if (track === undefined) throw new Error("failed to get system audio track");

	const publication = (
		await localParticipant.publishTrack(track, {
			source: Track.Source.ScreenShareAudio,
			forceStereo: true,
			audioPreset: AudioPresets.musicHighQualityStereo,
		})
	).track;
	if (publication === undefined)
		throw new Error("failed to publish system audio");

	const controlSocket = new WebSocket(controlURL);
	controlSocket.binaryType = "arraybuffer";

	const systemAudio = new SystemAudio(audioSocket, controlSocket, publication);

	controlSocket.onmessage = async (event) => {
		systemAudio.nodes.forEach((n) => (n.expired = true));

		const nodes: [Msg.Node] = JSON.parse(decoder.decode(event.data));
		for (const node of nodes) {
			const current = systemAudio.nodes.get(node.node);
			if (current === undefined) {
				systemAudio.nodes.set(
					node.node,
					new Msg.Node(
						//
						node.node,
						node.name,
						node.running,
						node.linked,
					),
				);

				if (systemAudio.autoAdd) systemAudio.setLink(node.node, true);
			} else {
				current.expired = false;
				current.name = node.name;
				current.running = node.running;
				current.linked = node.linked;
			}
		}

		systemAudio.nodes.forEach((n, i) => {
			if (n.expired) systemAudio.nodes.delete(i);
		});
	};

	return systemAudio;
}
