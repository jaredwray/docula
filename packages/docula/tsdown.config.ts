import { defineConfig } from "tsdown";

export default defineConfig({
	entry: ["src/docula.ts"],
	format: ["esm"],
	dts: true,
	clean: true,
	outExtensions: () => ({
		js: ".js",
		dts: ".d.ts",
	}),
});
