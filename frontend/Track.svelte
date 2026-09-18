<script lang="ts">
	import { onMount } from "svelte";
	import { Track } from "./Track";
	const { track }: { track: Track } = $props();

	let mediaElement: undefined | HTMLMediaElement = $state();
	onMount(() => {
		mediaElement!.srcObject = track.stream;
	});
</script>

{track.sender}
{#if track.kind === "audio"}
	<audio bind:this={mediaElement} autoplay controls></audio>
{:else}
	<video bind:this={mediaElement} autoplay controls></video>
{/if}
