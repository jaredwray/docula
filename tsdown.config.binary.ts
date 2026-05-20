import { defineConfig } from "tsdown";

export default defineConfig({
	entry: ["src/sea-entry.ts"],
	format: ["esm"],
	clean: true,
	deps: {
		alwaysBundle: [/.*/],
		neverBundle: ["jiti"],
	},
	outputOptions: {
		codeSplitting: false,
	},
	exe: {
		fileName: "docula",
		outDir: "dist",
		seaConfig: {
			disableExperimentalSEAWarning: true,
		},
	},
});
