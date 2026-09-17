import E2EEWorker from "livekit-client/e2ee-worker?worker&inline";
import { v4 as uuidv4 } from "uuid";
import { isLivekitTransportConfig } from "matrix-js-sdk/lib/matrixrtc/LivekitTransport.js";
import {
	AudioPresets,
	LocalTrack,
	Room,
	RoomEvent,
	Track,
} from "livekit-client";

import {
	DEFAULT_CONFIG,
	MatrixRTCMode,
} from "element-call/src/config/ConfigOptions.ts";
import { MatrixKeyProvider } from "element-call/src/e2ee/matrixKeyProvider.ts";
import { enterRTCSession } from "element-call/src/state/CallViewModel/localMember/LocalMember.ts";
import { getSFUConfigWithOpenID } from "element-call/src/livekit/openIDSFU.ts";
import { getUrlParams } from "element-call/src/UrlParams.ts";
import { initializeWidget } from "element-call/src/widget.ts";

import {
	getSystemAudio,
	SystemAudio,
	Target,
	testSystemAudioDaemon,
} from "./system-audio";

function sleep(ms: number): Promise<unknown> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function getCheckbox(name: string): HTMLSpanElement {
	return document.querySelector(`#loading #${name} x-tick`) as HTMLSpanElement;
}

function setBtnState(
	btn: HTMLButtonElement,
	on: boolean,
	offText: string,
	onText: string = offText,
) {
	btn.textContent = on ? onText : offText;

	if (on) {
		btn.classList.add("enabled");
	} else {
		btn.classList.remove("enabled");
	}
}

const decoder = new TextDecoder();

window.onload = async () => {
	const status = document.getElementById("status") as HTMLHeadingElement;
	let checkbox: HTMLSpanElement = getCheckbox("none");

	async function boot(name: string) {
		if (checkbox !== null) {
			checkbox.style.setProperty("color", "var(--green)");
			checkbox.textContent = "OK";

			await sleep(10);
		}

		checkbox = getCheckbox(name);
	}

	try {
		console.clear();

		const log = (...args: any[]) => console.warn("[molecule]", ...args);
		const up = (msg: string) => new Error(`molecule: ${msg}`);

		await boot("params");
		const params = getUrlParams();
		log("PARAMS", params);

		await boot("widget");
		const widget = initializeWidget("m.call", true);
		if (widget === null || widget === undefined)
			throw up("failed to init widget");

		await boot("content");
		await widget.api.setAlwaysOnScreen(true);
		await widget.api.sendContentLoaded();

		const roomId = params.roomId;
		if (roomId === null) throw up("roomId cannot be null");

		await boot("client");
		const client = await widget.client;
		await client.waitUntilRoomReadyForGroupCalls(roomId);

		const identity = {
			deviceId: params.deviceId as string,
			memberId: uuidv4(),
			userId: params.userId as string,
		};

		await boot("transport");
		const transports = await client._unstable_getRTCTransports();
		const transport = transports.find(isLivekitTransportConfig);
		if (transport == undefined) throw up("no livekit transport found");

		await boot("room");
		const room = client.getRoom(roomId);
		if (room === null) throw up(`no room with id ${roomId} found`);

		await boot("session");
		const rtcSession = client.matrixRTC.getRoomSession(room);

		await boot("keyProvider");
		const keyProvider = new MatrixKeyProvider();
		keyProvider.setRTCSession(rtcSession);

		const matrixRTCMode = MatrixRTCMode.Compatibility;

		await boot("enter");
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
				voiceIsolation: false,
				channelCount: 2,
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

		await boot("sfuConfig");
		const lkCreds = await getSFUConfigWithOpenID(
			client,
			identity,
			transport.livekit_service_url,
			roomId,
			{ matrixRTCMode },
		);

		await boot("userMedia");
		await navigator.mediaDevices.getUserMedia({ audio: true });

		await boot("connect");
		await lkRoom.setE2EEEnabled(true);
		await lkRoom.connect(lkCreds.url, lkCreds.jwt);
		log("connected to room", roomId, lkRoom.name);

		const me = lkRoom.localParticipant;

		(document.getElementById("leave") as HTMLButtonElement).onclick =
			async () => {
				const call = client.getGroupCallForRoom(roomId);
				if (call !== null) await call.terminate();

				await rtcSession.leaveRoomSession(1000);
				await widget.api.setAlwaysOnScreen(false);
				await widget.api.transport.send("io.element.close", {});
			};

		const micBtn = document.getElementById("mic") as HTMLButtonElement;
		micBtn.onclick = async () => {
			const active = !me.isMicrophoneEnabled;
			await me.setMicrophoneEnabled(active, undefined, {
				forceStereo: true,
				audioPreset: AudioPresets.musicHighQualityStereo,
			});

			setBtnState(micBtn, active, "Unmute", "Mute");
		};

		const camBtn = document.getElementById("cam") as HTMLButtonElement;
		camBtn.onclick = async () => {
			const active = !me.isCameraEnabled;
			await me.setCameraEnabled(active);

			setBtnState(camBtn, active, "Start webcam", "Stop webcam");
		};

		const screenBtn = document.getElementById("screen") as HTMLButtonElement;
		screenBtn.onclick = async () => {
			const active = !me.isScreenShareEnabled;
			await me.setScreenShareEnabled(active);

			setBtnState(screenBtn, active, "Share screen", "Stop sharing screen");
		};

		const sysaudBtn = document.getElementById("sysaud") as HTMLButtonElement;
		const systemAudioSection = document.getElementById(
			"systemAudio",
		) as HTMLDivElement;
		const systemAudioAutoBtn = document.getElementById(
			"systemAudioAuto",
		) as HTMLButtonElement;
		const systemAudioTargets = document.getElementById(
			"systemAudioTargets",
		) as HTMLDivElement;

		if (typeof SharedArrayBuffer === "undefined") {
			sysaudBtn.disabled = true;
			sysaudBtn.title = "SharedArrayBuffer is undefined, check your URLs!";
		} else if (!(await testSystemAudioDaemon())) {
			sysaudBtn.disabled = true;
			sysaudBtn.title = "Can't connect to molecule daemon!";
		} else {
			let systemAudio: SystemAudio;
			let publication: LocalTrack | undefined;
			let autoAdd: boolean = false;
			const targets = new Map<number, Target>();

			sysaudBtn.onclick = async () => {
				if (publication === undefined) {
					systemAudio = await getSystemAudio();

					systemAudio.controlSocket.onmessage = async (event) => {
						targets.forEach((it) => (it.expire = true));

						const targetList: [Target] = JSON.parse(decoder.decode(event.data));
						for (const src of targetList) {
							let dst = targets.get(src.node);
							if (dst === undefined) {
								src.mainEl = document.createElement("div");

								src.linkEl = document.createElement("input");
								src.linkEl.setAttribute("type", "checkbox");
								src.linkEl.style.setProperty("margin-right", "8px");
								src.linkEl.checked = src.linked;
								src.linkEl.onclick = () => {
									systemAudio.setLink(src.node, src.linkEl.checked);
								};
								src.mainEl.appendChild(src.linkEl);

								src.nameEl = document.createElement("span");
								src.nameEl.textContent = src.name;
								if (!src.running) src.nameEl.classList.add("paused");
								src.mainEl.appendChild(src.nameEl);

								systemAudioTargets.appendChild(src.mainEl);

								src.expire = false;
								targets.set(src.node, src);

								if (autoAdd) {
									systemAudio.setLink(src.node, true);
								}
							} else {
								dst.nameEl.textContent = src.name;
								log(src, dst);

								if (src.running) {
									dst.nameEl.classList.remove("paused");
								} else {
									dst.nameEl.classList.add("paused");
								}

								dst.linkEl.checked = src.linked;
								dst.expire = false;
							}
						}

						targets.forEach((it) => {
							if (it.expire) {
								targets.delete(it.node);
								systemAudioTargets.removeChild(it.mainEl);
							}
						});

						log(targets);
					};

					publication = (
						await me.publishTrack(systemAudio.track, {
							source: Track.Source.ScreenShareAudio,
							forceStereo: true,
							audioPreset: AudioPresets.musicHighQualityStereo,
						})
					).track;

					systemAudioSection.hidden = false;
				} else {
					await me.unpublishTrack(publication);
					publication = undefined;

					systemAudio.audioSocket.close();
					systemAudio.controlSocket.close();

					systemAudioSection.hidden = true;
				}

				setBtnState(
					sysaudBtn,
					publication !== undefined,
					"Share system audio",
					"Stop sharing system audio",
				);
			};

			systemAudioAutoBtn.onclick = () => {
				autoAdd = !autoAdd;
				setBtnState(systemAudioAutoBtn, autoAdd, "Auto add");
			};
		}

		boot("done");
		await sleep(250);

		status.textContent = "connected!";

		const loading = document.getElementById("loading") as HTMLDivElement;
		loading.remove();

		const main = document.getElementById("main") as HTMLDivElement;
		main.hidden = false;

		await client.sendEmoteMessage(roomId, "is calling!");
		micBtn.click();
	} catch (e) {
		console.error(e);

		status.textContent = "oopsie woopsie!";

		if (checkbox !== null) {
			checkbox.style.setProperty("color", "var(--red)");
			checkbox.textContent = "XX";
		}
	}
};
