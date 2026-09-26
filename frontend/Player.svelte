<script lang="ts">
	import type { RemoteTrack } from "livekit-client";

	const {
		audio,
		video,
	}: { audio: undefined | RemoteTrack; video: undefined | RemoteTrack } =
		$props();

	let muted = $state(false);
	let volume = $state(1);

	let audioElement: undefined | HTMLMediaElement = $state();
	let videoElement: undefined | HTMLMediaElement = $state();

	$effect(() => {
		if (audio?.mediaStream) audioElement!.srcObject = audio.mediaStream;
	});

	$effect(() => {
		if (video?.mediaStream) videoElement!.srcObject = video.mediaStream;
	});
</script>

{#if audio}
	<audio bind:this={audioElement} bind:muted bind:volume autoplay controls
	></audio>
{/if}

{#if video}
	<video bind:this={videoElement} bind:muted bind:volume autoplay controls
	></video>
{/if}
