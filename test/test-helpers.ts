import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { CacheableNet } from "@cacheable/net";
import { vi } from "vitest";
import githubMockContributors from "./fixtures/data-mocks/github-contributors.json";
import githubMockReleases from "./fixtures/data-mocks/github-releases.json";

/**
 * Registry of every temp directory created during the current worker's run.
 * Each Vitest worker imports this module once, so the registry is scoped to a
 * single worker process. {@link cleanupTempDirs} (wired up as a global
 * `afterEach` in `test/setup.ts`) drains it after every test, guaranteeing
 * cleanup even when a test throws.
 */
const tempDirs = new Set<string>();

/**
 * Root for all docula test temp directories. Lives under the OS temp dir so it
 * never pollutes the repo and is isolated from concurrent Vitest processes
 * (every directory name is made unique with `fs.mkdtempSync`).
 */
const TEMP_ROOT = path.join(os.tmpdir(), "docula-tests");

/**
 * Create a unique, empty temporary directory and register it for automatic
 * cleanup after the current test. Safe to call any number of times per test.
 *
 * @param prefix - Human-readable hint included in the directory name.
 * @returns Absolute path to the freshly created directory.
 */
export function makeTempDir(prefix = "docula"): string {
	fs.mkdirSync(TEMP_ROOT, { recursive: true });
	const safePrefix = prefix.replace(/[^a-zA-Z0-9._-]/g, "-");
	const dir = fs.mkdtempSync(path.join(TEMP_ROOT, `${safePrefix}-`));
	tempDirs.add(dir);
	return dir;
}

/**
 * Copy a fixture directory into a fresh, unique temp directory so that builds
 * (which write `.cache`, `.gitignore`, generated README files, etc.) never
 * mutate the shared fixture or race with other test files.
 *
 * The cloned copy always starts without a `.cache` directory so differential
 * build behaviour is deterministic.
 *
 * @param fixturePath - Path to the source fixture (relative to repo root).
 * @param prefix - Optional directory-name hint (defaults to the fixture name).
 * @returns Absolute path to the cloned fixture.
 */
export function cloneFixture(fixturePath: string, prefix?: string): string {
	const dir = makeTempDir(prefix ?? path.basename(fixturePath));
	fs.cpSync(fixturePath, dir, { recursive: true });
	fs.rmSync(path.join(dir, ".cache"), { recursive: true, force: true });
	return dir;
}

/**
 * Like {@link cloneFixture}, but also neutralizes any self-referential
 * `sitePath`/`output` entries in the cloned `docula.config.*` file.
 *
 * Several fixtures ship a config that hard-codes `sitePath`/`output` back to the
 * original fixture location (e.g. `"./test/fixtures/<name>"` or `"./site"`).
 * When such a config is loaded by `docula.execute()`/`loadConfigFile()`, those
 * values would override the cloned `sitePath`, causing the build (and its
 * persistent `.cache`) to land in the shared fixture or the repo's real `site/`
 * directory — a cross-run, cross-file flake. Stripping them keeps every build
 * fully contained inside the unique clone.
 *
 * Use this for tests that build through the config-loading code path; use
 * {@link cloneFixture} when calling builder methods directly with explicit
 * options.
 */
export function cloneSite(fixturePath: string, prefix?: string): string {
	const dir = cloneFixture(fixturePath, prefix);
	for (const entry of fs.readdirSync(dir)) {
		if (!/^docula\.config\.(mjs|cjs|js|ts|json)$/.test(entry)) {
			continue;
		}
		const configPath = path.join(dir, entry);
		if (entry.endsWith(".json")) {
			try {
				const data = JSON.parse(fs.readFileSync(configPath, "utf8"));
				delete data.sitePath;
				delete data.output;
				fs.writeFileSync(configPath, JSON.stringify(data, null, 2));
			} catch {
				// Leave a non-parseable config untouched.
			}
			continue;
		}
		const original = fs.readFileSync(configPath, "utf8");
		// Strip simple single-line string-valued `sitePath:`/`output:` entries —
		// the only form docula's fixtures use.
		const stripped = original.replace(
			/^[ \t]*(?:sitePath|output)[ \t]*:[ \t]*(?:"[^"]*"|'[^']*'|`[^`]*`)[ \t]*,?[ \t]*\r?\n/gm,
			"",
		);
		fs.writeFileSync(configPath, stripped);
		// Fail loud if a `sitePath`/`output` key remains in a form this helper
		// can't strip (e.g. a multi-line or object value). That would silently
		// redirect a build out of the clone — the exact flake we're preventing —
		// so surface it immediately instead of using a heavyweight AST transform.
		if (/^[ \t]*(?:sitePath|output)[ \t]*:/m.test(stripped)) {
			throw new Error(
				`cloneSite: ${entry} declares "sitePath"/"output" in a form cloneSite cannot neutralize. ` +
					"Use a single-line string value in the fixture config, or extend cloneSite to handle it.",
			);
		}
	}
	return dir;
}

/**
 * Remove a single temp directory and stop tracking it. Tolerates a missing
 * directory. Prefer relying on the automatic {@link cleanupTempDirs} hook; use
 * this only when a test needs to delete a directory mid-test.
 */
export function removeTempDir(dirPath: string): void {
	fs.rmSync(dirPath, { recursive: true, force: true, maxRetries: 5 });
	tempDirs.delete(dirPath);
}

/**
 * Async variant of {@link removeTempDir}.
 */
export async function removeTempDirAsync(dirPath: string): Promise<void> {
	await fs.promises.rm(dirPath, {
		recursive: true,
		force: true,
		maxRetries: 5,
	});
	tempDirs.delete(dirPath);
}

/**
 * Remove every temp directory created since the last cleanup. Errors per
 * directory are swallowed so one stuck directory cannot fail a test, but each
 * removal uses retries to ride out transient filesystem contention. Wired up as
 * a global `afterEach` in `test/setup.ts`.
 */
export function cleanupTempDirs(): void {
	for (const dir of tempDirs) {
		try {
			fs.rmSync(dir, {
				recursive: true,
				force: true,
				maxRetries: 5,
				retryDelay: 25,
			});
		} catch {
			// Best-effort: a failed removal must never fail a test. The OS temp
			// dir is reclaimed by the platform, so a leaked directory is benign.
		}
	}
	tempDirs.clear();
}

/**
 * Set up the standard CacheableNet mock that returns fixture GitHub data.
 * Call this in a `beforeEach` block.
 */
export function setupGithubMock(): void {
	// biome-ignore lint/suspicious/noExplicitAny: test file
	(CacheableNet.prototype.get as any) = vi.fn(async (url: string) => {
		if (url.endsWith("releases")) {
			return { data: githubMockReleases };
		}

		if (url.endsWith("contributors")) {
			return { data: githubMockContributors };
		}

		return { data: {} };
	});
}

/**
 * Standard `afterEach` cleanup: reset mocks and remove temp directories.
 * Temp-dir removal also happens automatically via `test/setup.ts`, so calling
 * this is optional; it remains for suites that want an explicit mock reset.
 */
export function cleanupAfterEach(): void {
	vi.resetAllMocks();
	cleanupTempDirs();
}

/**
 * Alias of {@link cleanupAfterEach}; kept as a distinct name for suites that
 * previously distinguished "build only" cleanup.
 */
export function cleanupAfterEachBuildOnly(): void {
	cleanupAfterEach();
}
