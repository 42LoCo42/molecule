import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig, searchForWorkspaceRoot } from "vite";
import generateFile from "vite-plugin-generate-file";

const isolationHeaders = {
	"Cross-Origin-Embedder-Policy": "credentialless",
	"Cross-Origin-Opener-Policy": "same-origin",
};

export default defineConfig({
	base: "/room/",

	define: {
		global: "globalThis",
	},

	plugins: [
		svelte({}),
		generateFile([
			{
				type: "json",
				output: "./config.json",
				data: {},
			},
		]),
		{
			name: "redirect-room",
			configureServer(server) {
				server.middlewares.use((req, res, next) => {
					if (!req.originalUrl) {
						next();
						return;
					}

					const url = new URL(req.originalUrl, "http://localhost");

					if (url.pathname === "/room") {
						res.statusCode = 302;
						res.setHeader("Location", `/room/${url.search}`);
						res.end();
						return;
					}

					next();
				});
			},
		},
	],

	server: {
		proxy: {
			"^/(?!room)": {
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
