<script lang="ts">
	import type { RemoteTrack } from "livekit-client";
	import { onMount } from "svelte";

	const { kind, track }: { kind: "audio" | "video"; track: RemoteTrack } =
		$props();

	let mediaElement: undefined | HTMLMediaElement = $state();
	onMount(() => {
		if (track.mediaStream === undefined)
			throw new Error(`track has no mediaStream: ${track} `);

		mediaElement!.srcObject = track.mediaStream;
	});
</script>

{#if kind === "audio"}
	<audio bind:this={mediaElement} autoplay controls></audio>
{:else}
	<video bind:this={mediaElement} autoplay controls></video>
{/if}
