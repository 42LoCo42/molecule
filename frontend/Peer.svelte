<script lang="ts">
	import type { Peer } from "./Peer.svelte.ts";
	import Player from "./Player.svelte";

	let { name, peer }: { name: string; peer: Peer } = $props();
</script>

{name}
<Player audio={peer.micTrack} video={peer.camTrack} />
<Player audio={peer.sysaudTrack} video={peer.screenTrack} />
