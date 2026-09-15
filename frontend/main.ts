import E2EEWorker from "livekit-client/e2ee-worker?worker&inline";
import { v4 as uuidv4 } from "uuid";
import { isLivekitTransportConfig } from "matrix-js-sdk/lib/matrixrtc/LivekitTransport.js";
import { Room, RoomEvent, Track } from "livekit-client";

import {
	DEFAULT_CONFIG,
	MatrixRTCMode,
} from "element-call/src/config/ConfigOptions.ts";
import { MatrixKeyProvider } from "element-call/src/e2ee/matrixKeyProvider.ts";
import { enterRTCSession } from "element-call/src/state/CallViewModel/localMember/LocalMember.ts";
import { getSFUConfigWithOpenID } from "element-call/src/livekit/openIDSFU.ts";
import { getUrlParams } from "element-call/src/UrlParams.ts";
import { initializeWidget } from "element-call/src/widget.ts";

(async () => {
	console.clear();

	const log = (...args: any[]) => console.warn("[molecule]", ...args);
	const up = (msg: string) => new Error(`molecule: ${msg}`);

	const params = getUrlParams();
	log("PARAMS", params);

	const widget = initializeWidget("m.call", true);
	if (widget === null || widget === undefined)
		throw up("failed to init widget");

	await widget.api.setAlwaysOnScreen(true);
	await widget.api.sendContentLoaded();

	const roomId = params.roomId;
	if (roomId === null) throw up("roomId cannot be null");

	const client = await widget.client;
	await client.waitUntilRoomReadyForGroupCalls(roomId);

	const identity = {
		deviceId: params.deviceId as string,
		memberId: uuidv4(),
		userId: params.userId as string,
	};

	const transports = await client._unstable_getRTCTransports();
	const transport = transports.find(isLivekitTransportConfig);
	if (transport == undefined) throw up("no livekit transport found");

	const room = client.getRoom(roomId);
	if (room === null) throw up(`no room with id ${roomId} found`);

	const rtcSession = client.matrixRTC.getRoomSession(room);

	const keyProvider = new MatrixKeyProvider();
	keyProvider.setRTCSession(rtcSession);

	const matrixRTCMode = MatrixRTCMode.Compatibility;

	enterRTCSession(rtcSession, identity, transport, {
		encryptMedia: true,
		matrixRTCMode,
		delayedLeaveTimings:
			DEFAULT_CONFIG.matrix_rtc_session.delegated_delayed_leave,
		sendNotificationType: "ring",
		callIntent: "audio",
	});

	const lkRoom = new Room({
		adaptiveStream: true,
		dynacast: true,
		stopLocalTrackOnUnpublish: true,
		disconnectOnPageLeave: true,

		audioCaptureDefaults: {
			echoCancellation: false,
			noiseSuppression: false,
		},

		e2ee: {
			keyProvider,
			worker: new E2EEWorker(),
		},
	});

	const tracks = document.getElementById("tracks") as HTMLDivElement;

	lkRoom.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
		log("track subscribed", track, publication, participant);

		const element = track.attach();
		element.setAttribute("controls", "");
		tracks.appendChild(element);
	});

	// lkRoom.on(RoomEvent.EncryptionError, async (e, p) => {
	// 	log("ENC ERROR", e, p);

	// 	const call = client.getGroupCallForRoom(roomId);
	// 	if (call !== null) await call.terminate();

	// 	await rtcSession.leaveRoomSession(1000);

	// 	enterRTCSession(rtcSession, identity, transport, {
	// 		encryptMedia: true,
	// 		matrixRTCMode,
	// 		delayedLeaveTimings:
	// 			DEFAULT_CONFIG.matrix_rtc_session.delegated_delayed_leave,
	// 		sendNotificationType: "ring",
	// 		callIntent: "audio",
	// 	});

	// 	rtcSession.reemitEncryptionKeys();
	// });

	const lkCreds = await getSFUConfigWithOpenID(
		client,
		identity,
		transport.livekit_service_url,
		roomId,
		{ matrixRTCMode },
	);

	await lkRoom.setE2EEEnabled(true);
	await lkRoom.connect(lkCreds.url, lkCreds.jwt);
	log("connected to room", roomId, lkRoom.name);

	// await lkRoom.localParticipant.setMicrophoneEnabled(true);

	//

	(document.getElementById("leave") as HTMLButtonElement).onclick =
		async () => {
			const call = client.getGroupCallForRoom(roomId);
			if (call !== null) await call.terminate();

			await rtcSession.leaveRoomSession(1000);
			await widget.api.setAlwaysOnScreen(false);
			await widget.api.transport.send("io.element.close", {});
		};

	(document.getElementById("startScreenshare") as HTMLButtonElement).onclick =
		async () => {
			await lkRoom.localParticipant.setScreenShareEnabled(
				!lkRoom.localParticipant.isScreenShareEnabled,
			);
		};

	(document.getElementById("startSysAudio") as HTMLButtonElement).onclick =
		async () => {
			const sampleRate = 48000;

			const audioContext = new AudioContext({
				sampleRate,
				latencyHint: "interactive",
			});

			await audioContext.audioWorklet.addModule("/room/processor.js");
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

			const socket = new WebSocket("ws://localhost:37812/audio");
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
					ring.samples[destinationIndex + 1] = payload[
						sourceIndex + 1
					] as number;
				}

				Atomics.store(ring.indexes, 0, write + frames);
			};

			const track = destination.stream.getAudioTracks()[0];
			if (track === undefined) throw up("system audio track is undefined");

			await lkRoom.localParticipant.publishTrack(track, {
				source: Track.Source.ScreenShareAudio,
			});
		};
})();
