<script lang="ts">
	import type { Peer } from "./Peer.svelte.ts";
	import Player from "./Player.svelte";

	let { name, peer }: { name: string; peer: Peer } = $props();

	// svelte-ignore state_referenced_locally
	let color = peer.getColor(name);
</script>

<fieldset style:border-color={color}>
	<legend>{name}</legend>
	<Player store="{name}/mic" audio={peer.micTrack} video={peer.camTrack} />
	<Player
		store="{name}/sysaud"
		audio={peer.sysaudTrack}
		video={peer.screenTrack}
	/>
</fieldset>

<style>
	fieldset {
		border-style: dashed;
		border-width: 2px;
		display: inline;
		padding: 4px;
	}
</style>
