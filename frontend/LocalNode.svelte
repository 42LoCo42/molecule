<script lang="ts">
	import { Msg, SystemAudio } from "./SystemAudio.svelte";
	const { node, systemAudio }: { node: Msg.Node; systemAudio: SystemAudio } =
		$props();
</script>

<input
	type="checkbox"
	bind:checked={node.linked}
	onchange={() => systemAudio.setLink(node.node, node.linked)}
/>
<span class:paused={!node.running}>{node.name}</span>

<style>
	.paused {
		color: var(--lgray);
		font-style: italic;
	}
</style>
