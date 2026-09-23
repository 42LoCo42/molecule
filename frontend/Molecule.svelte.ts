import type { MatrixClient } from "matrix-js-sdk";
import type { MatrixRTCSession } from "matrix-js-sdk/lib/matrixrtc";
import { SvelteMap } from "svelte/reactivity";

import type { WidgetHelpers } from "element-call/src/widget";

import {
	AudioPresets,
	type LocalParticipant,
	LocalTrack,
} from "livekit-client";

import type { Peer } from "./Peer.svelte.ts";
import { type SystemAudio, getSystemAudio } from "./SystemAudio.svelte";

export class Molecule {
	constructor(
		public roomId: string,
		public widget: WidgetHelpers,
		public client: MatrixClient,
		public rtcSession: MatrixRTCSession,
		public participant: LocalParticipant,
	) {}

	micTrack: undefined | LocalTrack;
	camTrack: undefined | LocalTrack;
	screenTrack: undefined | LocalTrack;
	systemAudio: undefined | SystemAudio = $state();

	peers = new SvelteMap<string, Peer>();

	leave = async () => {
		this.participant.getTrackPublications().forEach((pub) => {
			if (pub.track)
				this.participant.unpublishTrack(pub.track.mediaStreamTrack);
		});

		const call = this.client.getGroupCallForRoom(this.roomId);
		if (call !== null) await call.terminate();

		await this.rtcSession.leaveRoomSession(1000);
		await this.widget.api.setAlwaysOnScreen(false);
		await this.widget.api.transport.send("io.element.close", {});
	};

	toggleMute = async () => {
		if (this.micTrack !== undefined) {
			this.participant.unpublishTrack(this.micTrack, true);
			this.micTrack = undefined;
		} else {
			this.micTrack = (
				await this.participant.setMicrophoneEnabled(true, undefined, {
					forceStereo: true,
					audioPreset: AudioPresets.musicHighQualityStereo,
				})
			)?.track;
		}
		return this.micTrack !== undefined;
	};

	toggleCam = async () => {
		if (this.camTrack !== undefined) {
			this.participant.unpublishTrack(this.camTrack, true);
			this.camTrack = undefined;
		} else {
			this.camTrack = (await this.participant.setCameraEnabled(true))?.track;
		}
		return this.camTrack !== undefined;
	};

	toggleScreen = async () => {
		if (this.screenTrack !== undefined) {
			this.participant.unpublishTrack(this.screenTrack, true);
			this.screenTrack = undefined;
		} else {
			this.screenTrack = (await this.participant.setScreenShareEnabled(true))
				?.track;
		}
		return this.screenTrack !== undefined;
	};

	toggleSysAudio = async () => {
		if (this.systemAudio !== undefined) {
			await this.participant.unpublishTrack(this.systemAudio.publication);

			this.systemAudio.audioSocket.close();
			this.systemAudio.controlSocket.close();
			this.systemAudio = undefined;
		} else {
			this.systemAudio = await getSystemAudio(this.participant);
		}

		return this.systemAudio !== undefined;
	};
}
