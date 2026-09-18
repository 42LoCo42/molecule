export default {
	plugins: ["@trivago/prettier-plugin-sort-imports", "prettier-plugin-svelte"],

	overrides: [
		{
			files: "*.svelte",
			options: {
				parser: "svelte",
			},
		},
	],

	importOrder: ["^element-call", "^livekit-client", "^[./]"],
	importOrderSeparation: true,
	importOrderSortSpecifiers: true,
};
