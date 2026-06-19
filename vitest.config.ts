import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		exclude: ["**/node_modules/**", "**/dist/**", "**/*.spec.ts"],
		setupFiles: ["test/setup.ts"],
		// Generous timeout so genuinely slow builds never present as flaky
		// timeouts on loaded CI machines. We do NOT use test retries, which
		// would only mask real flakiness.
		testTimeout: 30000,
		hookTimeout: 30000,
		coverage: {
			provider: "v8",
			all: true,
			include: ["src/**/*.ts"],
			reporter: ["text", "json", "lcov"],
			exclude: [
				// Entry shim executed only inside a Single Executable App.
				"src/sea-entry.ts",
				// Generated at build time; not part of the tested source.
				"src/embedded-templates.ts",
				// Type-only module (no executable code).
				"src/types.ts",
				// CLI bootstrap covered by the e2e/playwright suite.
				"src/init.ts",
			],
			thresholds: {
				statements: 100,
				branches: 100,
				functions: 100,
				lines: 100,
			},
		},
	},
});
