<script lang="ts">
	import Button from "./Button.svelte";
	import { Molecule } from "./Molecule.svelte";
	import { testSystemAudioDaemon } from "./SystemAudio.svelte";

	let { molecule }: { molecule: Molecule } = $props();

	const systemAudioError = new Promise<string | undefined>(async (resolve) => {
		if (typeof SharedArrayBuffer === "undefined")
			return resolve("SharedArrayBuffer is undefined, check your URLs!");

		if (!(await testSystemAudioDaemon()))
			return resolve("Can't connect to molecule daemon!");

		resolve(undefined);
	});

	let micBtn: undefined | Button = $state();
	$effect(() => {
		if (micBtn) micBtn.click();
	});

	async function toggleAutoAdd() {
		return (molecule!.systemAudio!.autoAdd = !molecule!.systemAudio!.autoAdd);
	}
</script>

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
	{#await systemAudioError then err}
		<Button
			off="󰖁"
			off-tt="Share system audio"
			on="󰕾"
			on-tt="Stop sharing system audio"
			onclick={molecule.toggleSysAudio}
			disabled={err}
		/>
	{/await}
	{#if molecule.systemAudio}
		<Button
			off="󱧧"
			off-tt="Enable auto-add"
			on="󰁪"
			on-tt="Disable auto-add"
			onclick={toggleAutoAdd}
		/>
	{/if}
</div>

<style>
	div {
		display: inline-grid;
		grid-auto-flow: column;
		grid-auto-columns: minmax(max-content, 1fr);
		gap: 0.75em;
		margin-bottom: 4px;
	}
</style>
