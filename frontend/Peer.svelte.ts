import { hash as h64 } from "@intrnl/xxhash64";
import { SvelteMap } from "svelte/reactivity";

import { type RemoteTrack, Track } from "livekit-client";

const colors = new SvelteMap<string, string>();

export class Peer {
	micTrack: undefined | RemoteTrack = $state();
	camTrack: undefined | RemoteTrack = $state();
	screenTrack: undefined | RemoteTrack = $state();
	sysaudTrack: undefined | RemoteTrack = $state();

	public getColor(name: string): string {
		return colors.getOrInsertComputed(
			name,
			(x) => `hsl(${h64(x) % 360n}, 100%, 60%)`,
		);
	}

	public registerTrack(track: RemoteTrack) {
		if (track.source === Track.Source.Unknown)
			throw new Error(`track has unknown source: ${track}`);

		switch (track.source) {
			case Track.Source.Microphone:
				this.micTrack = track;
				break;

			case Track.Source.Camera:
				this.camTrack = track;
				break;

			case Track.Source.ScreenShare:
				this.screenTrack = track;
				break;

			case Track.Source.ScreenShareAudio:
				this.sysaudTrack = track;
				break;
		}
	}

	public unregisterTrack(track: RemoteTrack) {
		if (track.source === Track.Source.Unknown)
			throw new Error(`track has unknown source: ${track}`);

		switch (track.source) {
			case Track.Source.Microphone:
				if (track.mediaStreamID == this.micTrack?.mediaStreamID)
					this.micTrack = undefined;
				break;

			case Track.Source.Camera:
				if (track.mediaStreamID == this.camTrack?.mediaStreamID)
					this.camTrack = undefined;
				break;

			case Track.Source.ScreenShare:
				if (track.mediaStreamID == this.screenTrack?.mediaStreamID)
					this.screenTrack = undefined;
				break;

			case Track.Source.ScreenShareAudio:
				if (track.mediaStreamID == this.sysaudTrack?.mediaStreamID)
					this.sysaudTrack = undefined;
				break;
		}

		return (
			this.micTrack === undefined &&
			this.camTrack === undefined &&
			this.screenTrack === undefined &&
			this.sysaudTrack === undefined
		);
	}
}
