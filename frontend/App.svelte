<script lang="ts">
	import ButtonList from "./ButtonList.svelte";
	import LocalNode from "./LocalNode.svelte";
	import Peer from "./Peer.svelte";
	import { Molecule } from "./Molecule.svelte";
	import { Peer as PeerObj } from "./Peer.svelte.ts";
	import { boot } from "./boot";
	import { version } from "./package.json";

	import type { Track } from "livekit-client";

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

	function mirror(camTrack: Track): PeerObj {
		const peer = new PeerObj();
		peer.registerTrack(camTrack);
		return peer;
	}

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
		{#if molecule.camTrack}
			<Peer
				name={molecule.client.getUserId()!}
				peer={mirror(molecule.camTrack)}
			/>
		{/if}
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
