<script lang="ts">
	import Button from "./Button.svelte";
	import LocalNode from "./LocalNode.svelte";
	import Peer from "./Peer.svelte";
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
	let micBtn: undefined | Button = $state();

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

	$effect(() => {
		if (micBtn) micBtn.click();
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
	<h1>molecule</h1>
	<h3>{status}</h3>
</x-logo>
<hr />

<main>
	{#if molecule}
		<div>
			<Button on="&hairsp;󰩈" on-tt="Leave call" onclick={molecule.leave} />
			<Button
				bind:this={micBtn}
				off=""
				off-tt="Unmute"
				on="&hairsp;"
				on-tt="Mute"
				onclick={molecule.toggleMute}
			/>
			<Button
				off=""
				off-tt="Share webcam"
				on=""
				on-tt="Stop sharing webcam"
				onclick={molecule.toggleCam}
			/>
			<Button
				off="󰶐"
				off-tt="Share screen"
				on="󰍹"
				on-tt="Stop sharing screen"
				onclick={molecule.toggleScreen}
			/>
			<Button
				off="󰖁"
				off-tt="Share system audio"
				on="󰕾"
				on-tt="Stop sharing system audio"
				onclick={molecule.toggleSysAudio}
				disabled={systemAudioError}
			/>
			{#if molecule.systemAudio}
				<Button
					off="󱧧"
					off-tt="Enable auto-add"
					on="󰁪"
					on-tt="Disable auto-add"
					onclick={toggleAutoAdd}
				/><br />
				{#each molecule.systemAudio.nodes as [_, node]}
					<LocalNode {node} systemAudio={molecule.systemAudio} /><br />
				{/each}
			{/if}
		</div>
		<br />
		{#each molecule.peers as [name, peer]}
			<Peer {name} {peer} /><br />
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
