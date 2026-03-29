import fs from "node:fs";
import path from "node:path";
import { CacheableNet } from "@cacheable/net";
import { vi } from "vitest";
import githubMockContributors from "./fixtures/data-mocks/github-contributors.json";
import githubMockReleases from "./fixtures/data-mocks/github-releases.json";

/**
 * All fixture directories that may produce `.cache/build` artifacts during tests.
 * Used by {@link cleanFixtureBuildCaches} to prevent differential-build interference
 * between parallel test files.
 */
const ALL_FIXTURE_PATHS = [
	"test/fixtures/single-page-site",
	"test/fixtures/single-page-site-ts",
	"test/fixtures/single-page-site-onprepare",
	"test/fixtures/single-page-site-ts-onprepare",
	"test/fixtures/multi-page-site",
	"test/fixtures/mega-page-site",
	"test/fixtures/mega-page-site-no-home-page",
	"test/fixtures/changelog-site",
	"test/fixtures/announcement-site",
	"test/fixtures/mega-custom-template",
	"test/fixtures/auto-readme-site",
	"test/fixtures/api-only-site",
	"test/fixtures/empty-site",
	"test/fixtures/multi-api-site",
] as const;

/**
 * Fixtures where builds may auto-generate a README.md or copy site assets
 * that need to be cleaned up after tests.
 */
const FIXTURES_WITH_GENERATED_ASSETS = [
	"test/fixtures/api-only-site",
	"test/fixtures/auto-readme-site",
	"test/fixtures/empty-site",
	"test/fixtures/mega-page-site",
	"test/fixtures/mega-page-site-no-home-page",
] as const;

/**
 * Remove `.cache/build` directories from all known fixture paths.
 * Wrapped in try/catch per fixture because parallel test files may be
 * writing to the same directories, causing ENOTEMPTY races.
 */
export function cleanFixtureBuildCaches(): void {
	for (const fixture of ALL_FIXTURE_PATHS) {
		try {
			fs.rmSync(`${fixture}/.cache/build`, { recursive: true, force: true });
		} catch {
			// ignore race conditions with parallel test files
		}
	}
}

/**
 * Remove auto-generated README.md and copied `site/` directories from
 * fixtures that should not retain them between tests.
 */
export function cleanFixtureGeneratedAssets(): void {
	for (const fixture of FIXTURES_WITH_GENERATED_ASSETS) {
		try {
			fs.rmSync(`${fixture}/README.md`, { force: true });
			fs.rmSync(`${fixture}/site`, { recursive: true, force: true });
		} catch {
			// ignore if files do not exist
		}
	}
}

/**
 * Standard afterEach cleanup for test suites that build sites.
 * Resets mocks, cleans fixture build caches, and removes generated assets.
 */
export function cleanupAfterEach(): void {
	vi.resetAllMocks();
	cleanFixtureBuildCaches();
	cleanFixtureGeneratedAssets();
}

/**
 * Standard afterEach cleanup for test suites that only need mock resets
 * and build cache cleanup (no generated asset cleanup).
 */
export function cleanupAfterEachBuildOnly(): void {
	vi.resetAllMocks();
	cleanFixtureBuildCaches();
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
 * Recursively remove a temporary directory, tolerating non-existence.
 */
export function removeTempDir(dirPath: string): void {
	if (fs.existsSync(dirPath)) {
		fs.rmSync(dirPath, { recursive: true, force: true });
	}
}

/**
 * Recursively remove a temporary directory (async), tolerating non-existence.
 */
export async function removeTempDirAsync(dirPath: string): Promise<void> {
	if (fs.existsSync(dirPath)) {
		await fs.promises.rm(dirPath, { recursive: true, force: true });
	}
}

/**
 * Create a temporary directory under `test/temp/` by copying a fixture.
 * Returns the created path. The caller is responsible for cleanup via
 * {@link removeTempDir} or a try/finally block.
 */
export function cloneFixture(fixturePath: string, tempName: string): string {
	const dest = `test/temp/${tempName}`;
	fs.mkdirSync(path.dirname(dest), { recursive: true });
	fs.cpSync(fixturePath, dest, { recursive: true });
	return dest;
}

/**
 * Ensure a temporary directory exists under `test/temp/`.
 * Returns the full path.
 */
export function ensureTempDir(tempName: string): string {
	const dest = `test/temp/${tempName}`;
	fs.mkdirSync(dest, { recursive: true });
	return dest;
}
