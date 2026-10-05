import dts from "unplugin-dts/vite";
import { defineConfig } from "vite";

export default defineConfig({
	input: "src/lib.ts",
	build: {
		lib: {
			name: "gomado",
		},
	},
	plugins: [dts({ bundleTypes: true })],
});
