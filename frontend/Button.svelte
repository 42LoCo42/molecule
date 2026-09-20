<script lang="ts">
	interface Props {
		on?: string;
		"on-tt"?: string;
		off?: string;
		"off-tt"?: string;
		onclick?: () => Promise<void | boolean>;
		disabled?: undefined | string;
	}

	const {
		on,
		"on-tt": on_tt,
		off = on,
		"off-tt": off_tt = on_tt,
		onclick,
		disabled,
	}: Props = $props();

	let enabled = $state(false);
	async function update() {
		if (onclick === undefined) return;

		const result = await onclick();
		if (typeof result === "boolean") {
			enabled = result;
		}
	}
</script>

<button
	class:enabled
	disabled={disabled !== undefined}
	title={disabled ?? (enabled ? on_tt : off_tt)}
	onclick={update}>{enabled ? on : off}&emsp;</button
>

<style>
	button {
		text-align: center;
		width: 2.4em;

		background-color: inherit;

		margin: 4px;
		margin-bottom: 6px;
		padding: 4px;

		border: 1px solid;

		color: var(--red);
		border-color: var(--gray);

		transition:
			color 0.25s ease-out,
			border-color 0.25s ease-out,
			transform 0.25s ease-out,
			box-shadow 0.25s ease-out;
	}

	button:not([disabled]):hover {
		color: var(--yellow);
		border-color: var(--yellow);

		transform: translate(2.5px, 2.5px);
		box-shadow: -2.5px -2.5px var(--gray);

		transition:
			color 0.25s ease-out,
			border-color 0.25s ease-out,
			transform 0.25s ease-out,
			box-shadow 0.25s ease-out;
	}

	button.enabled {
		color: var(--green) !important;
		border-color: var(--green) !important;

		transform: translate(5px, 5px) !important;
		box-shadow: -5px -5px var(--gray) !important;
	}

	button.enabled:hover {
		color: var(--yellow) !important;
		border-color: var(--yellow) !important;
	}

	button[disabled] {
		color: var(--lgray);
		border-color: var(--gray);
	}
</style>
