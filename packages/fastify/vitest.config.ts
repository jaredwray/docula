import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		globalSetup: ["test/global-setup.ts"],
		coverage: {
			reporter: ["text", "json", "lcov"],
			include: ["src/**"],
			exclude: ["dist/**", "test/**"],
		},
	},
});
