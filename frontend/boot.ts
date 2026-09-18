import { isLivekitTransportConfig } from "matrix-js-sdk/lib/matrixrtc";
import { v4 as uuidv4 } from "uuid";

import { getUrlParams } from "element-call/src/UrlParams";
import {
	DEFAULT_CONFIG,
	MatrixRTCMode,
} from "element-call/src/config/ConfigOptions";
import { MatrixKeyProvider } from "element-call/src/e2ee/matrixKeyProvider";
import { getSFUConfigWithOpenID } from "element-call/src/livekit/openIDSFU";
import { enterRTCSession } from "element-call/src/state/CallViewModel/localMember/LocalMember";
import { initializeWidget } from "element-call/src/widget";

import { Track as LKTrack, Room, RoomEvent } from "livekit-client";
import E2EEWorker from "livekit-client/e2ee-worker?worker&inline";

import { Molecule } from "./Molecule.svelte";
import { Track } from "./Track";

function getBootStage(name: string): HTMLSpanElement {
	return document.querySelector(`#boot-${name} x-tick`) as HTMLSpanElement;
}

export async function boot(status: (value: string) => void) {
	let bootStage = getBootStage("none");

	async function start(name: string) {
		if (bootStage !== null) {
			bootStage.style.setProperty("color", "var(--green)");
			bootStage.textContent = "OK";
		}

		bootStage = getBootStage(name);
	}

	try {
		const up = (msg: string) => new Error(`molecule: ${msg}`);

		await start("userMedia");
		await navigator.mediaDevices.getUserMedia({ audio: true });

		await start("params");
		const params = getUrlParams();

		await start("widget");
		const widget = initializeWidget("m.call", true);
		if (widget === null || widget === undefined)
			throw up("failed to init widget");

		await start("content");
		await widget.api.setAlwaysOnScreen(true);
		await widget.api.sendContentLoaded();

		const roomId = params.roomId;
		if (roomId === null) throw up("roomId cannot be null");

		await start("client");
		const client = await widget.client;
		await client.waitUntilRoomReadyForGroupCalls(roomId);

		const identity = {
			deviceId: params.deviceId as string,
			memberId: uuidv4(),
			userId: params.userId as string,
		};

		await start("transport");
		const transports = await client._unstable_getRTCTransports();
		const transport = transports.find(isLivekitTransportConfig);
		if (transport === undefined) throw up("no livekit transport found");

		await start("room");
		const room = client.getRoom(roomId);
		if (room === null) throw up(`no room with ID ${roomId} found`);

		await start("session");
		const rtcSession = client.matrixRTC.getRoomSession(room);

		await start("keyProvider");
		const keyProvider = new MatrixKeyProvider();
		keyProvider.setRTCSession(rtcSession);

		const matrixRTCMode = MatrixRTCMode.Compatibility;

		await start("enter");
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
				noiseSuppression: true,
				voiceIsolation: true,
				channelCount: 2,
			},

			e2ee: {
				keyProvider,
				worker: new E2EEWorker(),
			},
		});

		await start("sfuConfig");
		const lkCreds = await getSFUConfigWithOpenID(
			client,
			identity,
			transport.livekit_service_url,
			roomId,
			{ matrixRTCMode },
		);

		await start("connect");
		await lkRoom.setE2EEEnabled(true);
		await lkRoom.connect(lkCreds.url, lkCreds.jwt);

		await start("done");
		status("connected!");

		await client.sendEmoteMessage(roomId, "is calling");

		const molecule = new Molecule(
			roomId,
			widget,
			client,
			rtcSession,
			lkRoom.localParticipant,
		);

		lkRoom.on(RoomEvent.TrackSubscribed, (track, _, participant) => {
			if (track.mediaStream === undefined)
				throw up("track has no media stream");

			if (track.kind === LKTrack.Kind.Unknown)
				throw up("track has unknown kind");

			molecule.tracks.set(
				track.mediaStreamID,
				new Track(track.mediaStream, track.kind, participant.identity),
			);
		});

		lkRoom.on(RoomEvent.TrackUnsubscribed, (track) => {
			molecule.tracks.delete(track.mediaStreamID);
		});

		return molecule;
	} catch (e) {
		status("oopsie woopsie!");

		if (bootStage !== null) {
			bootStage.style.setProperty("color", "var(--red)");
			bootStage.textContent = "XX";
		}

		throw e;
	}
}
