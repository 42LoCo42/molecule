<script lang="ts">
	import ButtonList from "./ButtonList.svelte";
	import LocalNode from "./LocalNode.svelte";
	import Peer from "./Peer.svelte";
	import { Molecule } from "./Molecule.svelte";
	import { boot } from "./boot";
	import { version } from "./package.json";

	const bootStages = [
		"userMedia",
		"params",
		"widget",
		"content",
		"client",
		"transport",
		"room",
		"session",
		"keyProvider",
		"enter",
		"sfuConfig",
		"connect",
	];

	let status = $state("now booting...");

	const molecule = new Promise<Molecule>(async (resolve) => {
		resolve(
			await boot((s) => {
				status = s;
			}),
		);
	});

	document.onkeydown = (event) => {
		if (event.key === "f") {
			if (document.fullscreenElement) {
				document.exitFullscreen();
			} else {
				document.body.requestFullscreen();
			}
		}
	};
</script>

<x-logo>
	<h1>molecule<sup>v{version}</sup></h1>
	<h3>{status}</h3>
</x-logo>
<hr />

<main>
	{#await molecule}
		{#each bootStages as stage}
			<div id="boot-{stage}">[ <x-tick>&nbsp;&nbsp;</x-tick> ] {stage}</div>
		{/each}
	{:then molecule}
		<ButtonList {molecule} />
		{#if molecule.systemAudio}
			<br />
			{#each molecule.systemAudio.nodes as [_, node]}
				<LocalNode {node} systemAudio={molecule.systemAudio} /><br />
			{/each}
		{/if}
		<br />
		{#each molecule.peers as [name, peer]}
			<Peer {name} {peer} /><br />
		{/each}
	{/await}
</main>

<style>
	:global(body) {
		display: unset !important;
	}

	:global(body > *) {
		margin: 8px;
	}

	x-logo {
		display: inline-block;
		padding: 32px;
		background: url("estradiol.svg") no-repeat;
	}

	sup {
		font-size: 14px;
		color: var(--lgray);
		vertical-align: top;
		position: relative;
		top: 0.5em;
	}

	hr {
		border-style: dashed;
	}
</style>
