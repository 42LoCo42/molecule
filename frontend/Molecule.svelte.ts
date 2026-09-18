import type { MatrixClient } from "matrix-js-sdk";
import type { MatrixRTCSession } from "matrix-js-sdk/lib/matrixrtc";
import { SvelteMap } from "svelte/reactivity";

import type { WidgetHelpers } from "element-call/src/widget";

import {
	AudioPresets,
	Track as LKTrack,
	type LocalParticipant,
} from "livekit-client";

import { type SystemAudio, getSystemAudio } from "./SystemAudio.svelte";
import { Track } from "./Track";

export class Molecule {
	constructor(
		public roomId: string,
		public widget: WidgetHelpers,
		public client: MatrixClient,
		public rtcSession: MatrixRTCSession,
		public participant: LocalParticipant,
	) {}

	systemAudio: undefined | SystemAudio = $state();

	tracks = new SvelteMap<string, Track>();

	leave = async () => {
		const call = this.client.getGroupCallForRoom(this.roomId);
		if (call !== null) await call.terminate();

		await this.rtcSession.leaveRoomSession(1000);
		await this.widget.api.setAlwaysOnScreen(false);
		await this.widget.api.transport.send("io.element.close", {});
	};

	toggleMute = async () => {
		const active = !this.participant.isMicrophoneEnabled;
		if (active) {
			await this.participant.setMicrophoneEnabled(active, undefined, {
				forceStereo: true,
				audioPreset: AudioPresets.musicHighQualityStereo,
			});
		} else {
			const track = this.participant.getTrackPublication(
				LKTrack.Source.Microphone,
			)?.track;
			if (track) this.participant.unpublishTrack(track);
		}

		return active;
	};

	toggleCam = async () => {
		const active = !this.participant.isCameraEnabled;
		if (active) {
			await this.participant.setCameraEnabled(active);
		} else {
			const track = this.participant.getTrackPublication(
				LKTrack.Source.Camera,
			)?.track;
			if (track) this.participant.unpublishTrack(track);
		}
		return active;
	};

	toggleScreen = async () => {
		const active = !this.participant.isScreenShareEnabled;
		await this.participant.setScreenShareEnabled(active);
		return active;
	};

	toggleSysAudio = async () => {
		if (this.systemAudio === undefined) {
			this.systemAudio = await getSystemAudio(this.participant);
		} else {
			await this.participant.unpublishTrack(this.systemAudio.publication);

			this.systemAudio.audioSocket.close();
			this.systemAudio.controlSocket.close();
			this.systemAudio = undefined;
		}

		return this.systemAudio !== undefined;
	};
}
