import { defineConfig } from "tsdown";

export default defineConfig({
	entry: ["src/sea-entry.ts"],
	format: ["cjs"],
	clean: true,
	deps: {
		alwaysBundle: [/.*/],
		neverBundle: ["jiti"],
	},
	outputOptions: {
		codeSplitting: false,
	},
});
