import { defineConfig } from "vite";
import generateFile from "vite-plugin-generate-file";

const isolationHeaders = {
	"Cross-Origin-Opener-Policy": "same-origin",
	"Cross-Origin-Embedder-Policy": "require-corp",
};

export default defineConfig({
	base: "/room",

	publicDir: "public",

	define: {
		global: "globalThis",
	},

	plugins: [
		generateFile([
			{
				type: "json",
				output: "./config.json",
				data: {},
			},
		]),
	],

	// server: {
	// 	headers: isolationHeaders,
	// },

	// preview: {
	// 	headers: isolationHeaders,
	// },
});
