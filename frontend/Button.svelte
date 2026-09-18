<script lang="ts">
	interface Props {
		on?: string;
		off?: string;
		onclick?: () => Promise<void | boolean>;
		disabled?: string;
	}

	const { on, off = on, onclick, disabled }: Props = $props();

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
	title={disabled}
	onclick={update}>{enabled ? on : off}</button
>

<style>
	button {
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

		transform: translate(3px, 3px);
		box-shadow: -3px -3px var(--gray);

		transition:
			color 0.25s ease-out,
			border-color 0.25s ease-out,
			transform 0.25s ease-out,
			box-shadow 0.25s ease-out;
	}

	button.enabled {
		color: var(--green) !important;
		border-color: var(--green) !important;

		transform: translate(6px, 6px) !important;
		box-shadow: -6px -6px var(--gray) !important;
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
