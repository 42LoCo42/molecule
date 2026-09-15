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

	server: {
		proxy: {
			"^/(?!room(?:/|$))": {
				target: "http://localhost:29325",
				changeOrigin: true,
				ws: true,

				configure: (proxy) => {
					proxy.on("proxyRes", (proxyRes) => {
						for (const [k, v] of Object.entries(isolationHeaders)) {
							proxyRes.headers[k] = v;
						}
					});
				},
			},
		},

		headers: isolationHeaders,
	},
});
