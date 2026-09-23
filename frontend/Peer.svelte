<script lang="ts">
	import type { Peer } from "./Peer.svelte.ts";
	import Player from "./Player.svelte";

	let { name, peer }: { name: string; peer: Peer } = $props();
</script>

{name}
{#if peer.micTrack}
	<Player kind="audio" track={peer.micTrack} /><br />
{/if}
{#if peer.camTrack}
	<Player kind="video" track={peer.camTrack} /><br />
{/if}
{#if peer.screenTrack}
	<Player kind="video" track={peer.screenTrack} /><br />
{/if}
{#if peer.sysaudTrack}
	<Player kind="audio" track={peer.sysaudTrack} /><br />
{/if}
