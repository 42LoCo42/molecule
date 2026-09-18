<script lang="ts">
	import Button from "./Button.svelte";
	import LocalNode from "./LocalNode.svelte";
	import Track from "./Track.svelte";
	import { Molecule } from "./Molecule.svelte";
	import { boot } from "./boot";
	import { onMount } from "svelte";
	import { testSystemAudioDaemon } from "./SystemAudio.svelte";

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
	let molecule: undefined | Molecule = $state();
	onMount(async () => {
		molecule = await boot((s) => {
			status = s;
		});
	});

	const systemAudioError =
		typeof SharedArrayBuffer === "undefined"
			? "SharedArrayBuffer is undefined, check your URLs!"
			: !(await testSystemAudioDaemon())
				? "Can't connect to molecule daemon!"
				: undefined;

	async function toggleAutoAdd() {
		return (molecule!.systemAudio!.autoAdd = !molecule!.systemAudio!.autoAdd);
	}
</script>

<x-logo>
	<h1>molecule</h1>
	<h3>{status}</h3>
</x-logo>
<hr />

<main>
	{#if molecule}
		<div>
			<Button on="Leave" onclick={molecule.leave} />
			<Button off="Unmute" on="Mute" onclick={molecule.toggleMute} />
			<Button
				off="Start webcam"
				on="Stop webcam"
				onclick={molecule.toggleCam}
			/>
		</div>
		<div>
			<Button
				off="Share screen"
				on="Stop sharing screen"
				onclick={molecule.toggleScreen}
			/>
			<Button
				off="Share system audio"
				on="Stop sharing system audio"
				onclick={molecule.toggleSysAudio}
				disabled={systemAudioError}
			/>
		</div>
		{#if molecule.systemAudio}
			<Button on="Auto add" onclick={toggleAutoAdd} /><br />
			{#each molecule.systemAudio.nodes as [_, node]}
				<LocalNode {node} systemAudio={molecule.systemAudio} /><br />
			{/each}
		{/if}
		<br />
		{#each molecule.tracks as [_, track]}
			<Track {track} /><br />
		{/each}
	{:else}
		{#each bootStages as stage}
			<div id="boot-{stage}">[ <x-tick>&nbsp;&nbsp;</x-tick> ] {stage}</div>
		{/each}
	{/if}
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

	hr {
		border-style: dashed;
	}
</style>
