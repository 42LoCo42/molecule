<script lang="ts">
	import type { RemoteTrack } from "livekit-client";

	const {
		store,
		audio,
		video,
	}: {
		store: string;
		audio: undefined | RemoteTrack;
		video: undefined | RemoteTrack;
	} = $props();

	let muted = $state(false);

	// svelte-ignore state_referenced_locally
	const volkey = `molecule/audio/${store}`;
	let volume = $state(parseFloat(window.localStorage.getItem(volkey) || "1"));

	let audioElement: undefined | HTMLMediaElement = $state();
	let videoElement: undefined | HTMLMediaElement = $state();

	$effect(() => {
		if (audio?.mediaStream) audioElement!.srcObject = audio.mediaStream;
	});

	$effect(() => {
		if (video?.mediaStream) videoElement!.srcObject = video.mediaStream;
	});

	$effect(() => {
		window.localStorage.setItem(volkey, volume.toString());
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
