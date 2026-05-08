import { defineConfig } from "tsdown";

const NODE_VERSION = "26.1.0";

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
	exe: {
		fileName: "docula",
		targets: [
			{ platform: "linux", arch: "x64", nodeVersion: NODE_VERSION },
			{ platform: "darwin", arch: "arm64", nodeVersion: NODE_VERSION },
			{ platform: "darwin", arch: "x64", nodeVersion: NODE_VERSION },
			{ platform: "win", arch: "x64", nodeVersion: NODE_VERSION },
		],
		seaConfig: {
			disableExperimentalSEAWarning: true,
			useCodeCache: false,
			useSnapshot: false,
		},
	},
});
