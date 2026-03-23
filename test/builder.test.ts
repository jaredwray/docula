import fs from "node:fs";
import path from "node:path";
import { CacheableNet } from "@cacheable/net";
import { Hashery } from "hashery";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DoculaBuilder, type DoculaData } from "../src/builder.js";
import {
	hasAssetsChanged,
	hashFile as hashFileUtil,
	hashOptions as hashOptionsUtil,
	loadBuildManifest,
	loadCachedChangelog,
	recordsEqual,
	saveBuildManifest,
} from "../src/builder-cache.js";
import {
	copyPublicDirectory,
	mergeTemplateOverrides,
} from "../src/builder-files.js";
import { escapeXml } from "../src/builder-utils.js";
import { DoculaOptions } from "../src/options.js";

const testHash = new Hashery();

// biome-ignore lint/suspicious/noControlCharactersInRegex: needed to strip ANSI escape codes
const ansiRegex = /\u001B\[[0-9;]*m/g;
function stripAnsi(str: string): string {
	return str.replace(ansiRegex, "");
}

import githubMockContributors from "./fixtures/data-mocks/github-contributors.json";
import githubMockReleases from "./fixtures/data-mocks/github-releases.json";

vi.mock("@cacheable/net");

const defaultPathFields = {
	baseUrl: "",
	docsPath: "docs",
	apiPath: "api",
	changelogPath: "changelog",
	docsUrl: "/docs",
	apiUrl: "/api",
	changelogUrl: "/changelog",
};

describe("DoculaBuilder", () => {
	afterEach(() => {
		// Reset the mock after each test
		vi.resetAllMocks();
		// Clean build manifests to prevent differential build interference between tests.
		// Wrapped in try/catch because docula.test.ts runs in parallel and may be
		// writing to .cache/build at the same time, causing ENOTEMPTY races.
		for (const fixture of [
			"test/fixtures/single-page-site",
			"test/fixtures/multi-page-site",
			"test/fixtures/mega-page-site",
			"test/fixtures/changelog-site",
			"test/fixtures/announcement-site",
			"test/fixtures/mega-custom-template",
			"test/fixtures/auto-readme-site",
			"test/fixtures/api-only-site",
			"test/fixtures/empty-site",
			"test/fixtures/mega-page-site-no-home-page",
		]) {
			try {
				fs.rmSync(`${fixture}/.cache/build`, { recursive: true, force: true });
			} catch {
				// ignore race conditions with parallel test files
			}
		}

		// Clean up auto-generated README.md and copied assets in fixtures that should not have them
		for (const fixture of [
			"test/fixtures/api-only-site",
			"test/fixtures/auto-readme-site",
			"test/fixtures/empty-site",
			"test/fixtures/mega-page-site",
			"test/fixtures/mega-page-site-no-home-page",
		]) {
			try {
				fs.rmSync(`${fixture}/README.md`, { force: true });
				// Remove asset directories that autoReadme may have copied
				fs.rmSync(`${fixture}/site`, { recursive: true, force: true });
			} catch {
				// ignore if files do not exist
			}
		}
	});
	beforeEach(() => {
		// biome-ignore lint/suspicious/noExplicitAny: test file
		(CacheableNet.prototype.get as any) = vi.fn(async (url: string) => {
			if (url.endsWith("releases")) {
				return { data: githubMockReleases };
			}

			if (url.endsWith("contributors")) {
				return { data: githubMockContributors };
			}

			// Default response or throw an error if you prefer
			return { data: {} };
		});
	});

	describe("Docula Builder", () => {
		it("should initiate", () => {
			const builder = new DoculaBuilder();
			expect(builder).toBeTruthy();
		});

		it("should initiate with options", () => {
			const options = new DoculaOptions();
			const builder = new DoculaBuilder(options);
			expect(builder).toBeTruthy();
			expect(builder.options).toBe(options);
		});
	});

	describe("Docula Builder - Build", () => {
		it("should build single page", async () => {
			const options = new DoculaOptions();
			options.output = "test/temp/build-test";
			const builder = new DoculaBuilder(options);
			const consoleLog = console.log;
			let consoleMessage = "";
			console.log = (message) => {
				consoleMessage = message as string;
			};

			try {
				await builder.build();
			} finally {
				await fs.promises.rm(builder.options.output, { recursive: true });
			}

			expect(consoleMessage).toContain("Build");

			console.log = consoleLog;
		});
		it("should use first doc as index.html when no README.md exists", async () => {
			const options = new DoculaOptions();
			options.output = "test/temp/build-test";
			options.sitePath = "test/fixtures/mega-page-site-no-home-page";
			options.autoReadme = false;
			const builder = new DoculaBuilder(options);
			const consoleLog = console.log;
			let consoleMessage = "";
			console.log = (message) => {
				consoleMessage = message as string;
			};

			try {
				await builder.build();
				const indexHtml = await fs.promises.readFile(
					`${options.output}/index.html`,
					"utf8",
				);
				expect(indexHtml).toContain("<title>docula -");
			} finally {
				await fs.promises.rm(builder.options.output, { recursive: true });
			}

			expect(consoleMessage).toContain("Build");

			console.log = consoleLog;
		});
		it("should log error when no README.md, no docs, and no API exist", async () => {
			const options = new DoculaOptions();
			options.output = "test/temp/build-no-content";
			options.sitePath = "test/fixtures/empty-site";
			options.autoReadme = false;
			const builder = new DoculaBuilder(options);
			builder.console.quiet = true;
			const consoleError = console.error;
			const errors: string[] = [];
			console.error = (message) => {
				errors.push(message as string);
			};

			try {
				await builder.build();
				expect(
					errors.some((e) =>
						stripAnsi(e).includes("No content found for the home page"),
					),
				).toBe(true);
			} finally {
				await fs.promises.rm(options.output, { recursive: true, force: true });
				console.error = consoleError;
			}
		});
		it("should build multi page", async () => {
			const options = new DoculaOptions();
			options.output = "test/temp/build-test";
			options.sitePath = "test/fixtures/multi-page-site";
			const builder = new DoculaBuilder(options);
			const consoleLog = console.log;
			let consoleMessage = "";
			console.log = (message) => {
				consoleMessage = message as string;
			};

			try {
				await builder.build();
			} finally {
				await fs.promises.rm(builder.options.output, { recursive: true });
			}

			expect(consoleMessage).toContain("Build");

			console.log = consoleLog;
		});
		it("should not build changelog.json when changelog-entry template is missing", async () => {
			const options = new DoculaOptions();
			options.output = "test/temp/build-no-changelog-entry-test";
			options.sitePath = "test/fixtures/changelog-site";
			options.templatePath = path.join(
				process.cwd(),
				"test/fixtures/template-no-changelog-entry",
			);
			const builder = new DoculaBuilder(options);

			try {
				await builder.build();
				expect(fs.existsSync(`${options.output}/changelog.json`)).toBe(false);
				expect(fs.existsSync(`${options.output}/changelog-latest.json`)).toBe(
					false,
				);
			} finally {
				await fs.promises.rm(options.output, { recursive: true, force: true });
			}
		});
	});

	describe("Docula Builder - Template Overrides", () => {
		it("should return original path when no override directory exists", () => {
			const options = new DoculaOptions();
			options.sitePath = "test/fixtures/single-page-site";
			const builder = new DoculaBuilder(options);
			const result = mergeTemplateOverrides(
				options,
				builder.console,
				testHash,
				"templates/modern",
				options.sitePath,
				"modern",
			);
			expect(result).toBe("templates/modern");
		});

		it("should return original path when templatePath is set", () => {
			const options = new DoculaOptions();
			options.templatePath = "test/fixtures/template-example";
			const builder = new DoculaBuilder(options);
			const result = mergeTemplateOverrides(
				options,
				builder.console,
				testHash,
				"test/fixtures/template-example",
				options.sitePath,
				"modern",
			);
			expect(result).toBe("test/fixtures/template-example");
		});

		it("should return original path when templateName contains path traversal", () => {
			const options = new DoculaOptions();
			options.sitePath = "test/fixtures/single-page-site";
			const builder = new DoculaBuilder(options);
			const result = mergeTemplateOverrides(
				options,
				builder.console,
				testHash,
				"templates/modern",
				options.sitePath,
				"../../../../etc",
			);
			expect(result).toBe("templates/modern");
		});

		it("should merge template overrides and log overridden files", async () => {
			const sitePath = "test/temp/override-log-test";
			const overrideDir = `${sitePath}/templates/modern/includes`;

			// Create override directory with a custom footer
			fs.mkdirSync(overrideDir, { recursive: true });
			fs.writeFileSync(
				`${overrideDir}/footer.hbs`,
				"<footer>Custom Footer</footer>",
			);

			const consoleLog = console.log;
			const messages: string[] = [];
			console.log = (message) => {
				messages.push(stripAnsi(message as string));
			};

			try {
				const options = new DoculaOptions();
				options.sitePath = sitePath;
				const builder = new DoculaBuilder(options);
				const result = mergeTemplateOverrides(
					options,
					builder.console,
					testHash,
					"templates/modern",
					sitePath,
					"modern",
				);

				// Should return cache dir path
				expect(result).toBe(`${sitePath}/.cache/templates/modern`);

				// Cache dir should exist with merged files
				expect(fs.existsSync(result)).toBe(true);

				// Override file should be in cache
				const cachedFooter = fs.readFileSync(
					`${result}/includes/footer.hbs`,
					"utf8",
				);
				expect(cachedFooter).toBe("<footer>Custom Footer</footer>");

				// Built-in files should also be in cache
				expect(fs.existsSync(`${result}/home.hbs`)).toBe(true);
				expect(fs.existsSync(`${result}/docs.hbs`)).toBe(true);

				// Should have logged the override
				expect(
					messages.some((m) =>
						m.includes("Template override: includes/footer.hbs"),
					),
				).toBe(true);
				expect(
					messages.some((m) => m.includes("Applying template overrides")),
				).toBe(true);
			} finally {
				console.log = consoleLog;
				fs.rmSync(sitePath, { recursive: true, force: true });
			}
		});

		it("should build with template overrides applied", async () => {
			const sitePath = "test/fixtures/multi-page-site";
			const overrideDir = `${sitePath}/templates/modern/includes`;
			const outputDir = "test/temp/build-override-test";
			const cacheDir = `${sitePath}/.cache`;

			// Create override with a custom footer containing a marker
			fs.mkdirSync(overrideDir, { recursive: true });
			fs.writeFileSync(
				`${overrideDir}/footer.hbs`,
				'<footer id="custom-override-footer">Custom Override Footer</footer>',
			);

			try {
				const options = new DoculaOptions();
				options.sitePath = sitePath;
				options.output = outputDir;
				const builder = new DoculaBuilder(options);
				builder.console.quiet = true;
				await builder.build();

				// Check the built index.html contains the custom footer
				const indexHtml = fs.readFileSync(`${outputDir}/index.html`, "utf8");
				expect(indexHtml).toContain("custom-override-footer");
			} finally {
				fs.rmSync(`${sitePath}/templates`, { recursive: true, force: true });
				fs.rmSync(cacheDir, { recursive: true, force: true });
				fs.rmSync(outputDir, { recursive: true, force: true });
			}
		});

		it("should update cache when override file content changes", () => {
			const sitePath = "test/temp/override-update-cache-test";
			const overrideDir = `${sitePath}/templates/modern/includes`;
			const cachePath = `${sitePath}/.cache/templates/modern`;

			fs.mkdirSync(overrideDir, { recursive: true });
			fs.writeFileSync(`${overrideDir}/footer.hbs`, "<footer>First</footer>");

			const consoleLog = console.log;
			const messages: string[] = [];
			console.log = (message) => {
				messages.push(stripAnsi(message as string));
			};

			try {
				const options = new DoculaOptions();
				options.sitePath = sitePath;
				const builder = new DoculaBuilder(options);

				// First merge
				mergeTemplateOverrides(
					options,
					builder.console,
					testHash,
					"templates/modern",
					sitePath,
					"modern",
				);

				// Update override content — hash change triggers incremental update
				fs.writeFileSync(
					`${overrideDir}/footer.hbs`,
					"<footer>Second</footer>",
				);

				messages.length = 0;

				// Second merge should detect changed content and update
				mergeTemplateOverrides(
					options,
					builder.console,
					testHash,
					"templates/modern",
					sitePath,
					"modern",
				);

				const cachedFooter = fs.readFileSync(
					`${cachePath}/includes/footer.hbs`,
					"utf8",
				);
				expect(cachedFooter).toBe("<footer>Second</footer>");
				expect(
					messages.some((m) => m.includes("Updating template overrides")),
				).toBe(true);
				expect(
					messages.some((m) =>
						m.includes("Template override changed: includes/footer.hbs"),
					),
				).toBe(true);
			} finally {
				console.log = consoleLog;
				fs.rmSync(sitePath, { recursive: true, force: true });
			}
		});

		it("should reuse cache when override files have not changed", () => {
			const sitePath = "test/temp/override-reuse-cache-test";
			const overrideDir = `${sitePath}/templates/modern/includes`;
			const cachePath = `${sitePath}/.cache/templates/modern`;

			fs.mkdirSync(overrideDir, { recursive: true });
			fs.writeFileSync(`${overrideDir}/footer.hbs`, "<footer>Cached</footer>");

			const consoleLog = console.log;
			const messages: string[] = [];
			console.log = (message) => {
				messages.push(stripAnsi(message as string));
			};

			try {
				const options = new DoculaOptions();
				options.sitePath = sitePath;
				const builder = new DoculaBuilder(options);

				// First merge — builds the cache
				mergeTemplateOverrides(
					options,
					builder.console,
					testHash,
					"templates/modern",
					sitePath,
					"modern",
				);

				messages.length = 0;

				// Second merge — should reuse cache
				const result = mergeTemplateOverrides(
					options,
					builder.console,
					testHash,
					"templates/modern",
					sitePath,
					"modern",
				);

				expect(result).toBe(cachePath);
				expect(
					messages.some((m) => m.includes("Using cached template overrides")),
				).toBe(true);
				expect(
					messages.some((m) => m.includes("Applying template overrides")),
				).toBe(false);
			} finally {
				console.log = consoleLog;
				fs.rmSync(sitePath, { recursive: true, force: true });
			}
		});

		it("should invalidate cache when an override file is deleted", () => {
			const sitePath = "test/temp/override-invalidate-cache-test";
			const overrideDir = `${sitePath}/templates/modern/includes`;

			fs.mkdirSync(overrideDir, { recursive: true });
			fs.writeFileSync(`${overrideDir}/footer.hbs`, "<footer>A</footer>");
			fs.writeFileSync(`${overrideDir}/header.hbs`, "<header>B</header>");

			const consoleLog = console.log;

			try {
				const options = new DoculaOptions();
				options.sitePath = sitePath;
				const builder = new DoculaBuilder(options);
				builder.console.quiet = true;

				// First merge — builds cache with two override files
				mergeTemplateOverrides(
					options,
					builder.console,
					testHash,
					"templates/modern",
					sitePath,
					"modern",
				);

				// Delete one override file
				fs.unlinkSync(`${overrideDir}/header.hbs`);

				builder.console.quiet = false;
				const messages: string[] = [];
				console.log = (message) => {
					messages.push(stripAnsi(message as string));
				};

				// Second merge — should detect removal and update incrementally
				mergeTemplateOverrides(
					options,
					builder.console,
					testHash,
					"templates/modern",
					sitePath,
					"modern",
				);

				expect(
					messages.some((m) => m.includes("Using cached template overrides")),
				).toBe(false);
				expect(
					messages.some((m) => m.includes("Updating template overrides")),
				).toBe(true);
				expect(
					messages.some((m) =>
						m.includes("Template override removed: includes/header.hbs"),
					),
				).toBe(true);
			} finally {
				console.log = consoleLog;
				fs.rmSync(sitePath, { recursive: true, force: true });
			}
		});

		it("should rebuild when manifest is missing or corrupt", () => {
			const sitePath = "test/temp/override-manifest-rebuild-test";
			const overrideDir = `${sitePath}/templates/modern/includes`;
			const cachePath = `${sitePath}/.cache/templates/modern`;

			fs.mkdirSync(overrideDir, { recursive: true });
			fs.writeFileSync(`${overrideDir}/footer.hbs`, "<footer>X</footer>");

			const consoleLog = console.log;

			try {
				const options = new DoculaOptions();
				options.sitePath = sitePath;
				const builder = new DoculaBuilder(options);
				builder.console.quiet = true;

				// First merge — builds cache
				mergeTemplateOverrides(
					options,
					builder.console,
					testHash,
					"templates/modern",
					sitePath,
					"modern",
				);

				// Corrupt the manifest
				fs.writeFileSync(`${cachePath}/.manifest.json`, "not json");

				builder.console.quiet = false;
				const messages: string[] = [];
				console.log = (message) => {
					messages.push(stripAnsi(message as string));
				};

				// Should rebuild due to corrupt manifest
				mergeTemplateOverrides(
					options,
					builder.console,
					testHash,
					"templates/modern",
					sitePath,
					"modern",
				);

				expect(
					messages.some((m) => m.includes("Using cached template overrides")),
				).toBe(false);

				// Now delete the manifest entirely
				fs.unlinkSync(`${cachePath}/.manifest.json`);
				messages.length = 0;

				mergeTemplateOverrides(
					options,
					builder.console,
					testHash,
					"templates/modern",
					sitePath,
					"modern",
				);

				expect(
					messages.some((m) => m.includes("Using cached template overrides")),
				).toBe(false);
			} finally {
				console.log = consoleLog;
				fs.rmSync(sitePath, { recursive: true, force: true });
			}
		});

		it("should only replace changed override files and preserve unchanged ones", () => {
			const sitePath = "test/temp/override-partial-update-test";
			const overrideDir = `${sitePath}/templates/modern/includes`;
			const cachePath = `${sitePath}/.cache/templates/modern`;

			fs.mkdirSync(overrideDir, { recursive: true });
			fs.writeFileSync(`${overrideDir}/footer.hbs`, "<footer>A</footer>");
			fs.writeFileSync(`${overrideDir}/header.hbs`, "<header>B</header>");

			const consoleLog = console.log;
			const messages: string[] = [];
			console.log = (message) => {
				messages.push(stripAnsi(message as string));
			};

			try {
				const options = new DoculaOptions();
				options.sitePath = sitePath;
				const builder = new DoculaBuilder(options);

				// First merge — builds cache
				mergeTemplateOverrides(
					options,
					builder.console,
					testHash,
					"templates/modern",
					sitePath,
					"modern",
				);

				// Record mtime of unchanged file
				const headerMtime = fs.statSync(
					`${cachePath}/includes/header.hbs`,
				).mtimeMs;

				// Only change footer
				fs.writeFileSync(
					`${overrideDir}/footer.hbs`,
					"<footer>Updated</footer>",
				);

				messages.length = 0;

				// Second merge — should only update footer
				mergeTemplateOverrides(
					options,
					builder.console,
					testHash,
					"templates/modern",
					sitePath,
					"modern",
				);

				// Footer should be updated
				const cachedFooter = fs.readFileSync(
					`${cachePath}/includes/footer.hbs`,
					"utf8",
				);
				expect(cachedFooter).toBe("<footer>Updated</footer>");

				// Header mtime should be unchanged (not re-copied)
				const headerMtimeAfter = fs.statSync(
					`${cachePath}/includes/header.hbs`,
				).mtimeMs;
				expect(headerMtimeAfter).toBe(headerMtime);

				// Only footer should be reported as changed
				expect(
					messages.some((m) =>
						m.includes("Template override changed: includes/footer.hbs"),
					),
				).toBe(true);
				expect(messages.some((m) => m.includes("includes/header.hbs"))).toBe(
					false,
				);
			} finally {
				console.log = consoleLog;
				fs.rmSync(sitePath, { recursive: true, force: true });
			}
		});

		it("should create .gitignore with .cache when it does not exist", () => {
			const sitePath = "test/temp/gitignore-create";
			const overrideDir = `${sitePath}/templates/modern/includes`;

			fs.mkdirSync(overrideDir, { recursive: true });
			fs.writeFileSync(`${overrideDir}/footer.hbs`, "<footer>test</footer>");

			const consoleLog = console.log;
			const messages: string[] = [];
			console.log = (message) => {
				messages.push(stripAnsi(message as string));
			};

			try {
				const options = new DoculaOptions();
				options.sitePath = sitePath;
				const builder = new DoculaBuilder(options);
				mergeTemplateOverrides(
					options,
					builder.console,
					testHash,
					"templates/modern",
					sitePath,
					"modern",
				);

				// .gitignore should be created with .cache entry
				expect(fs.existsSync(`${sitePath}/.gitignore`)).toBe(true);
				const content = fs.readFileSync(`${sitePath}/.gitignore`, "utf8");
				expect(content).toContain(".cache");
				expect(
					messages.some((m) => m.includes("Created .gitignore with .cache")),
				).toBe(true);
			} finally {
				console.log = consoleLog;
				fs.rmSync(sitePath, { recursive: true, force: true });
			}
		});

		it("should append .cache to existing .gitignore", () => {
			const sitePath = "test/temp/gitignore-append";
			const overrideDir = `${sitePath}/templates/modern/includes`;

			fs.mkdirSync(overrideDir, { recursive: true });
			fs.writeFileSync(`${overrideDir}/footer.hbs`, "<footer>test</footer>");
			fs.writeFileSync(`${sitePath}/.gitignore`, "dist\nnode_modules\n");

			const consoleLog = console.log;
			const messages: string[] = [];
			console.log = (message) => {
				messages.push(stripAnsi(message as string));
			};

			try {
				const options = new DoculaOptions();
				options.sitePath = sitePath;
				const builder = new DoculaBuilder(options);
				mergeTemplateOverrides(
					options,
					builder.console,
					testHash,
					"templates/modern",
					sitePath,
					"modern",
				);

				const content = fs.readFileSync(`${sitePath}/.gitignore`, "utf8");
				expect(content).toContain("dist");
				expect(content).toContain(".cache");
				expect(
					messages.some((m) => m.includes("Added .cache to .gitignore")),
				).toBe(true);
			} finally {
				console.log = consoleLog;
				fs.rmSync(sitePath, { recursive: true, force: true });
			}
		});

		it("should not modify .gitignore when .cache entry already exists", () => {
			const sitePath = "test/temp/gitignore-exists";
			const overrideDir = `${sitePath}/templates/modern/includes`;

			fs.mkdirSync(overrideDir, { recursive: true });
			fs.writeFileSync(`${overrideDir}/footer.hbs`, "<footer>test</footer>");
			fs.writeFileSync(`${sitePath}/.gitignore`, "dist\n.cache\n");

			const consoleLog = console.log;
			const messages: string[] = [];
			console.log = (message) => {
				messages.push(stripAnsi(message as string));
			};

			try {
				const options = new DoculaOptions();
				options.sitePath = sitePath;
				const builder = new DoculaBuilder(options);
				mergeTemplateOverrides(
					options,
					builder.console,
					testHash,
					"templates/modern",
					sitePath,
					"modern",
				);

				const content = fs.readFileSync(`${sitePath}/.gitignore`, "utf8");
				expect(content).toBe("dist\n.cache\n");
				expect(messages.some((m) => m.includes("Added .cache"))).toBe(false);
				expect(messages.some((m) => m.includes("Created .gitignore"))).toBe(
					false,
				);
			} finally {
				console.log = consoleLog;
				fs.rmSync(sitePath, { recursive: true, force: true });
			}
		});

		it("should not modify .gitignore when autoUpdateIgnores is false", () => {
			const sitePath = "test/temp/gitignore-disabled";
			const overrideDir = `${sitePath}/templates/modern/includes`;

			fs.mkdirSync(overrideDir, { recursive: true });
			fs.writeFileSync(`${overrideDir}/footer.hbs`, "<footer>test</footer>");

			try {
				const options = new DoculaOptions();
				options.sitePath = sitePath;
				options.autoUpdateIgnores = false;
				const builder = new DoculaBuilder(options);
				builder.console.quiet = true;
				mergeTemplateOverrides(
					options,
					builder.console,
					testHash,
					"templates/modern",
					sitePath,
					"modern",
				);

				// .gitignore should NOT be created
				expect(fs.existsSync(`${sitePath}/.gitignore`)).toBe(false);
			} finally {
				fs.rmSync(sitePath, { recursive: true, force: true });
			}
		});

		it("should not modify .gitignore when .cache already exists", () => {
			const sitePath = "test/temp/gitignore-cache-exists";
			const overrideDir = `${sitePath}/templates/modern/includes`;

			fs.mkdirSync(overrideDir, { recursive: true });
			fs.writeFileSync(`${overrideDir}/footer.hbs`, "<footer>test</footer>");
			// Create .cache before merge
			fs.mkdirSync(`${sitePath}/.cache`, { recursive: true });

			try {
				const options = new DoculaOptions();
				options.sitePath = sitePath;
				const builder = new DoculaBuilder(options);
				builder.console.quiet = true;
				mergeTemplateOverrides(
					options,
					builder.console,
					testHash,
					"templates/modern",
					sitePath,
					"modern",
				);

				// .gitignore should NOT be created since .cache already existed
				expect(fs.existsSync(`${sitePath}/.gitignore`)).toBe(false);
			} finally {
				fs.rmSync(sitePath, { recursive: true, force: true });
			}
		});

		it("should add new override files to an existing cache", () => {
			const sitePath = "test/temp/override-add-files-test";
			const overrideDir = `${sitePath}/templates/modern/includes`;
			const cachePath = `${sitePath}/.cache/templates/modern`;

			fs.mkdirSync(overrideDir, { recursive: true });
			fs.writeFileSync(
				`${overrideDir}/footer.hbs`,
				"<footer>Original</footer>",
			);

			const consoleLog = console.log;

			try {
				const options = new DoculaOptions();
				options.sitePath = sitePath;
				const builder = new DoculaBuilder(options);
				builder.console.quiet = true;

				// First merge — builds cache with one override file
				mergeTemplateOverrides(
					options,
					builder.console,
					testHash,
					"templates/modern",
					sitePath,
					"modern",
				);

				// Add a new override file
				fs.writeFileSync(
					`${overrideDir}/sidebar.hbs`,
					"<aside>Custom sidebar</aside>",
				);

				builder.console.quiet = false;
				const messages: string[] = [];
				console.log = (message) => {
					messages.push(stripAnsi(message as string));
				};

				// Second merge — should detect the added file
				mergeTemplateOverrides(
					options,
					builder.console,
					testHash,
					"templates/modern",
					sitePath,
					"modern",
				);

				expect(
					messages.some((m) => m.includes("Updating template overrides")),
				).toBe(true);
				expect(
					messages.some((m) =>
						m.includes("Template override added: includes/sidebar.hbs"),
					),
				).toBe(true);

				// Verify the new file was copied into the cache
				const cachedSidebar = fs.readFileSync(
					`${cachePath}/includes/sidebar.hbs`,
					"utf8",
				);
				expect(cachedSidebar).toBe("<aside>Custom sidebar</aside>");
			} finally {
				console.log = consoleLog;
				fs.rmSync(sitePath, { recursive: true, force: true });
			}
		});

		it("should delete cached file when removed override has no original template", () => {
			const sitePath = "test/temp/override-delete-cached-test";
			const overrideDir = `${sitePath}/templates/modern`;
			const cachePath = `${sitePath}/.cache/templates/modern`;

			// Create an override file that does NOT exist in the original template
			fs.mkdirSync(`${overrideDir}/includes`, { recursive: true });
			fs.writeFileSync(`${overrideDir}/custom-widget.hbs`, "<div>Widget</div>");

			const consoleLog = console.log;

			try {
				const options = new DoculaOptions();
				options.sitePath = sitePath;
				const builder = new DoculaBuilder(options);
				builder.console.quiet = true;

				// First merge — builds cache with the custom override
				mergeTemplateOverrides(
					options,
					builder.console,
					testHash,
					"templates/modern",
					sitePath,
					"modern",
				);

				// Verify the file exists in cache
				expect(fs.existsSync(`${cachePath}/custom-widget.hbs`)).toBe(true);

				// Delete the override file
				fs.unlinkSync(`${overrideDir}/custom-widget.hbs`);

				builder.console.quiet = false;
				const messages: string[] = [];
				console.log = (message) => {
					messages.push(stripAnsi(message as string));
				};

				// Second merge — should detect removal and delete from cache
				mergeTemplateOverrides(
					options,
					builder.console,
					testHash,
					"templates/modern",
					sitePath,
					"modern",
				);

				expect(
					messages.some((m) => m.includes("Updating template overrides")),
				).toBe(true);
				expect(
					messages.some((m) =>
						m.includes("Template override removed: custom-widget.hbs"),
					),
				).toBe(true);

				// The file should be gone from the cache since it has no original
				expect(fs.existsSync(`${cachePath}/custom-widget.hbs`)).toBe(false);
			} finally {
				console.log = consoleLog;
				fs.rmSync(sitePath, { recursive: true, force: true });
			}
		});
	});

	describe("Docula Builder - Differential Builds", () => {
		it("should write build manifest after first build", async () => {
			const sitePath = "test/temp/diff-build-manifest";
			const output = `${sitePath}/dist`;

			fs.cpSync("test/fixtures/single-page-site", sitePath, {
				recursive: true,
				// Exclude transient output/cache dirs written by parallel docula.test.ts tests
				filter: (src) => {
					const base = path.basename(src);
					return !base.startsWith("dist") && base !== ".cache";
				},
			});

			try {
				const options = new DoculaOptions();
				options.sitePath = sitePath;
				options.output = output;
				options.templatePath = "test/fixtures/template-example/";
				const builder = new DoculaBuilder(options);
				builder.console.quiet = true;
				await builder.build();

				const manifestPath = `${sitePath}/.cache/build/manifest.json`;
				expect(fs.existsSync(manifestPath)).toBe(true);

				const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
				expect(manifest.version).toBe(1);
				expect(manifest.configHash).toBeDefined();
				expect(manifest.templateHash).toBeDefined();
				expect(manifest.docs).toBeDefined();
				expect(manifest.assets).toBeDefined();

				// Should also write cached documents
				expect(fs.existsSync(`${sitePath}/.cache/build/documents.json`)).toBe(
					true,
				);
			} finally {
				fs.rmSync(sitePath, { recursive: true, force: true });
			}
		});

		it("should skip build when nothing has changed", async () => {
			const sitePath = "test/temp/diff-build-skip";
			const output = `${sitePath}/dist`;

			fs.cpSync("test/fixtures/single-page-site", sitePath, {
				recursive: true,
				filter: (src) => {
					const base = path.basename(src);
					return !base.startsWith("dist") && base !== ".cache";
				},
			});

			const consoleLog = console.log;

			try {
				const options = new DoculaOptions();
				options.sitePath = sitePath;
				options.output = output;
				options.templatePath = "test/fixtures/template-example/";
				const builder = new DoculaBuilder(options);
				builder.console.quiet = true;

				// First build
				await builder.build();

				// Second build should skip
				builder.console.quiet = false;
				const messages: string[] = [];
				console.log = (message) => {
					messages.push(stripAnsi(message as string));
				};

				await builder.build();

				expect(
					messages.some((m) =>
						m.includes("No changes detected, skipping build"),
					),
				).toBe(true);
			} finally {
				console.log = consoleLog;
				fs.rmSync(sitePath, { recursive: true, force: true });
			}
		});

		it("should rebuild when openGraph config changes", async () => {
			const sitePath = "test/temp/diff-build-og-change";
			const output = `${sitePath}/dist`;

			fs.cpSync("test/fixtures/single-page-site", sitePath, {
				recursive: true,
				filter: (src) => {
					const base = path.basename(src);
					return !base.startsWith("dist") && base !== ".cache";
				},
			});

			const consoleLog = console.log;

			try {
				const options = new DoculaOptions();
				options.sitePath = sitePath;
				options.output = output;
				options.templatePath = "test/fixtures/template-example/";
				const builder = new DoculaBuilder(options);
				builder.console.quiet = true;

				// First build without openGraph
				await builder.build();

				// Enable openGraph
				options.openGraph = { title: "OG Title" };
				const builder2 = new DoculaBuilder(options);

				const messages: string[] = [];
				console.log = (message) => {
					messages.push(stripAnsi(message as string));
				};

				// Second build should NOT skip (config hash changed)
				await builder2.build();

				expect(
					messages.some((m) =>
						m.includes("No changes detected, skipping build"),
					),
				).toBe(false);
				expect(messages.some((m) => m.includes("Build completed"))).toBe(true);
			} finally {
				console.log = consoleLog;
				fs.rmSync(sitePath, { recursive: true, force: true });
			}
		});

		it("should rebuild when a document changes", async () => {
			const sitePath = "test/temp/diff-build-doc-change";
			const output = `${sitePath}/dist`;

			fs.cpSync("test/fixtures/multi-page-site", sitePath, {
				recursive: true,
			});

			const consoleLog = console.log;

			try {
				const options = new DoculaOptions();
				options.sitePath = sitePath;
				options.output = output;
				options.templatePath = "test/fixtures/template-example/";
				const builder = new DoculaBuilder(options);
				builder.console.quiet = true;

				// First build
				await builder.build();

				// Modify a document
				const docPath = `${sitePath}/docs/index.md`;
				fs.writeFileSync(
					docPath,
					"---\ntitle: Changed\norder: 1\n---\n# Changed content\nNew text here.",
				);

				builder.console.quiet = false;
				const messages: string[] = [];
				console.log = (message) => {
					messages.push(stripAnsi(message as string));
				};

				// Second build should NOT skip
				await builder.build();

				expect(
					messages.some((m) =>
						m.includes("No changes detected, skipping build"),
					),
				).toBe(false);
				expect(messages.some((m) => m.includes("Build completed"))).toBe(true);
			} finally {
				console.log = consoleLog;
				fs.rmSync(sitePath, { recursive: true, force: true });
			}
		});

		it("should use cached documents for unchanged files", async () => {
			const sitePath = "test/temp/diff-build-cached-docs";
			const output = `${sitePath}/dist`;

			fs.cpSync("test/fixtures/multi-page-site", sitePath, { recursive: true });

			try {
				const options = new DoculaOptions();
				options.sitePath = sitePath;
				options.output = output;
				options.templatePath = "test/fixtures/template-example/";
				const builder = new DoculaBuilder(options);
				builder.console.quiet = true;

				// First build
				await builder.build();

				// Add a new document (forces rebuild, but cached docs should be used for unchanged ones)
				fs.writeFileSync(
					`${sitePath}/docs/new-doc.md`,
					"---\ntitle: New Doc\norder: 99\n---\n# New Document\nContent.",
				);

				// Second build
				await builder.build();

				// Verify the new document exists in output
				expect(fs.existsSync(`${output}/docs/new-doc/index.html`)).toBe(true);

				// Verify cached documents file was updated
				const cachedDocs = JSON.parse(
					fs.readFileSync(`${sitePath}/.cache/build/documents.json`, "utf8"),
				);
				expect(Object.keys(cachedDocs).length).toBeGreaterThan(1);
			} finally {
				fs.rmSync(sitePath, { recursive: true, force: true });
			}
		});

		it("should force full rebuild when config changes", async () => {
			const sitePath = "test/temp/diff-build-config-change";
			const output = `${sitePath}/dist`;

			fs.cpSync("test/fixtures/single-page-site", sitePath, {
				recursive: true,
				filter: (src) => {
					const base = path.basename(src);
					return !base.startsWith("dist") && base !== ".cache";
				},
			});

			const consoleLog = console.log;

			try {
				const options = new DoculaOptions();
				options.sitePath = sitePath;
				options.output = output;
				options.templatePath = "test/fixtures/template-example/";
				const builder = new DoculaBuilder(options);
				builder.console.quiet = true;

				// First build
				await builder.build();

				// Change config (different site title)
				options.siteTitle = "Changed Title";
				const builder2 = new DoculaBuilder(options);

				const messages: string[] = [];
				console.log = (message) => {
					messages.push(stripAnsi(message as string));
				};

				// Second build should do a full build (not skip)
				await builder2.build();

				expect(
					messages.some((m) =>
						m.includes("No changes detected, skipping build"),
					),
				).toBe(false);
				expect(messages.some((m) => m.includes("Build completed"))).toBe(true);
			} finally {
				console.log = consoleLog;
				fs.rmSync(sitePath, { recursive: true, force: true });
			}
		});

		it("should load and save build manifest correctly", () => {
			const sitePath = "test/temp/diff-manifest-io";

			try {
				const options = new DoculaOptions();
				options.sitePath = sitePath;
				const _builder = new DoculaBuilder(options);

				// No manifest initially
				expect(loadBuildManifest(sitePath)).toBeUndefined();

				// Save a manifest
				const manifest = {
					version: 1 as const,
					configHash: "abc",
					templateHash: "def",
					docs: { "docs/index.md": "hash1" },
					changelog: {},
					assets: { "favicon.ico": "hash2" },
				};
				saveBuildManifest(sitePath, manifest);

				// Load it back
				const loaded = loadBuildManifest(sitePath);
				expect(loaded).toBeDefined();
				expect(loaded?.version).toBe(1);
				expect(loaded?.configHash).toBe("abc");
				expect(loaded?.docs["docs/index.md"]).toBe("hash1");
			} finally {
				fs.rmSync(sitePath, { recursive: true, force: true });
			}
		});

		it("should return undefined for corrupt or wrong-version manifest", () => {
			const sitePath = "test/temp/diff-manifest-corrupt";

			try {
				const options = new DoculaOptions();
				options.sitePath = sitePath;
				const _builder = new DoculaBuilder(options);

				const dir = `${sitePath}/.cache/build`;
				fs.mkdirSync(dir, { recursive: true });

				// Corrupt JSON
				fs.writeFileSync(`${dir}/manifest.json`, "not json");
				expect(loadBuildManifest(sitePath)).toBeUndefined();

				// Wrong version
				fs.writeFileSync(
					`${dir}/manifest.json`,
					JSON.stringify({ version: 99 }),
				);
				expect(loadBuildManifest(sitePath)).toBeUndefined();
			} finally {
				fs.rmSync(sitePath, { recursive: true, force: true });
			}
		});

		it("should skip unchanged asset copies", async () => {
			const sitePath = "test/temp/diff-build-asset-skip";
			const output = `${sitePath}/dist`;

			fs.cpSync("test/fixtures/multi-page-site", sitePath, {
				recursive: true,
			});

			try {
				const options = new DoculaOptions();
				options.sitePath = sitePath;
				options.output = output;
				options.templatePath = "test/fixtures/template-example/";
				const builder = new DoculaBuilder(options);
				builder.console.quiet = true;

				// First build
				await builder.build();

				// Record mtime of a copied asset
				const faviconPath = `${output}/favicon.ico`;
				const mtime1 = fs.statSync(faviconPath).mtimeMs;

				// Wait a small amount to ensure mtime would differ if re-copied
				await new Promise((resolve) => {
					setTimeout(resolve, 50);
				});

				// Change a doc to force rebuild but not asset change
				fs.writeFileSync(
					`${sitePath}/docs/index.md`,
					"---\ntitle: Changed\norder: 1\n---\n# Changed\nNew.",
				);
				await builder.build();

				const mtime2 = fs.statSync(faviconPath).mtimeMs;
				// Asset should NOT have been re-copied
				expect(mtime2).toBe(mtime1);
			} finally {
				fs.rmSync(sitePath, { recursive: true, force: true });
			}
		});

		it("should detect asset changes", () => {
			const sitePath = "test/temp/diff-assets-changed";

			try {
				const options = new DoculaOptions();
				options.sitePath = sitePath;
				const _builder = new DoculaBuilder(options);

				fs.mkdirSync(sitePath, { recursive: true });
				fs.writeFileSync(`${sitePath}/favicon.ico`, "icon-data");

				const previousAssets: Record<string, string> = {
					"favicon.ico": "old-hash",
				};
				expect(hasAssetsChanged(testHash, sitePath, previousAssets)).toBe(true);

				// Hash the file and set as previous — should report no change
				const currentHash: string = hashFileUtil(
					testHash,
					`${sitePath}/favicon.ico`,
				);
				previousAssets["favicon.ico"] = currentHash;
				expect(hasAssetsChanged(testHash, sitePath, previousAssets)).toBe(
					false,
				);

				// Test deleted asset detection
				previousAssets["logo.svg"] = "some-hash";
				expect(hasAssetsChanged(testHash, sitePath, previousAssets)).toBe(true);
			} finally {
				fs.rmSync(sitePath, { recursive: true, force: true });
			}
		});

		it("should handle cached changelog entries", async () => {
			const sitePath = "test/temp/diff-build-changelog-cache";
			const output = `${sitePath}/dist`;

			fs.cpSync("test/fixtures/changelog-site", sitePath, { recursive: true });

			const consoleLog = console.log;

			try {
				const options = new DoculaOptions();
				options.sitePath = sitePath;
				options.output = output;
				options.templatePath = "test/fixtures/template-example/";
				const builder = new DoculaBuilder(options);
				builder.console.quiet = true;

				// First build
				await builder.build();

				// Verify changelog cache was written
				expect(fs.existsSync(`${sitePath}/.cache/build/changelog.json`)).toBe(
					true,
				);

				// Second build — should use cache
				builder.console.quiet = false;
				const messages: string[] = [];
				console.log = (message) => {
					messages.push(stripAnsi(message as string));
				};

				await builder.build();

				expect(
					messages.some((m) =>
						m.includes("No changes detected, skipping build"),
					),
				).toBe(true);
			} finally {
				console.log = consoleLog;
				fs.rmSync(sitePath, { recursive: true, force: true });
			}
		});

		it("should handle corrupt cached changelog gracefully", () => {
			const sitePath = "test/temp/diff-corrupt-changelog";

			try {
				const options = new DoculaOptions();
				options.sitePath = sitePath;
				const _builder = new DoculaBuilder(options);

				const dir = `${sitePath}/.cache/build`;
				fs.mkdirSync(dir, { recursive: true });
				fs.writeFileSync(`${dir}/changelog.json`, "not json");

				const result = loadCachedChangelog(sitePath);
				expect(result.size).toBe(0);
			} finally {
				fs.rmSync(sitePath, { recursive: true, force: true });
			}
		});

		it("should detect public folder asset changes", () => {
			const sitePath = "test/temp/diff-public-assets";

			try {
				const options = new DoculaOptions();
				options.sitePath = sitePath;
				const _builder = new DoculaBuilder(options);

				fs.mkdirSync(`${sitePath}/public`, { recursive: true });
				fs.writeFileSync(`${sitePath}/public/test.txt`, "hello");

				// Previous assets have a different hash for the public file
				const previousAssets: Record<string, string> = {
					"public/test.txt": "old-hash",
				};
				expect(hasAssetsChanged(testHash, sitePath, previousAssets)).toBe(true);

				// Now set correct hash — should report no change
				const currentHash: string = hashFileUtil(
					testHash,
					`${sitePath}/public/test.txt`,
				);
				previousAssets["public/test.txt"] = currentHash;
				expect(hasAssetsChanged(testHash, sitePath, previousAssets)).toBe(
					false,
				);
			} finally {
				fs.rmSync(sitePath, { recursive: true, force: true });
			}
		});

		it("should return false from recordsEqual when values differ for the same key", () => {
			const _builder = new DoculaBuilder();
			const a: Record<string, string> = { foo: "abc", bar: "def" };
			const b: Record<string, string> = { foo: "abc", bar: "xyz" };
			expect(recordsEqual(a, b)).toBe(false);
		});
	});

	describe("Docula Builder - Validate Options", () => {
		it("should allow empty githubPath", () => {
			const builder = new DoculaBuilder();
			const options = new DoculaOptions();
			options.githubPath = "";
			expect(() => builder.validateOptions(options)).not.toThrow();
		});
		it("should reject malformed githubPath without slash", () => {
			const builder = new DoculaBuilder();
			const options = new DoculaOptions();
			options.githubPath = "invalid";
			expect(() => builder.validateOptions(options)).toThrow(
				"githubPath must be in 'owner/repo' format",
			);
		});
		it("should validate siteDescription options", async () => {
			const builder = new DoculaBuilder();
			const options = new DoculaOptions();
			try {
				options.siteDescription = "";
				builder.validateOptions(options);
			} catch (error) {
				expect((error as Error).message).toBe(
					"No site description options provided",
				);
			}
		});
		it("should validate site title options", async () => {
			const builder = new DoculaBuilder();
			const options = new DoculaOptions();
			try {
				options.siteTitle = "";
				builder.validateOptions(options);
			} catch (error) {
				expect((error as Error).message).toBe("No site title options provided");
			}
		});
		it("should validate site url options", async () => {
			const builder = new DoculaBuilder();
			const options = new DoculaOptions();
			try {
				options.siteUrl = "";
				builder.validateOptions(options);
			} catch (error) {
				expect((error as Error).message).toBe("No site url options provided");
			}
		});
	});

	describe("Docula Builder - Get Data", () => {
		it("should get github data", async () => {
			const builder = new DoculaBuilder();
			CacheableNet.prototype.get = vi.fn().mockResolvedValue({ data: {} });
			const githubData = await builder.getGithubData("jaredwray/docula");
			expect(githubData).toBeTruthy();
			vi.resetAllMocks();
		});
	});

	describe("Docula Builder - Get Templates", () => {
		it("should get the file without extension", async () => {
			const builder = new DoculaBuilder();
			const file = await builder.getTemplateFile(
				"test/fixtures/template-example/",
				"home",
			);
			expect(file).toBe("home.hbs");
		});
		it("should not get the file without extension", async () => {
			const builder = new DoculaBuilder();
			const file = await builder.getTemplateFile(
				"test/fixtures/template-example/",
				"foo",
			);
			expect(file).toBe(undefined);
		});
		it("should get the template data", async () => {
			const builder = new DoculaBuilder();
			const templateData = await builder.getTemplates(
				"test/fixtures/template-example/",
				false,
			);
			expect(templateData).not.toHaveProperty("releases");
		});
		it("should throw error when template path doesnt exist", async () => {
			const builder = new DoculaBuilder();
			try {
				await builder.getTemplates("test/fixtures/template-example1/", false);
			} catch (error) {
				expect((error as Error).message).toContain("No template path found");
			}
		});
	});

	describe("Docula Builder - Public Folder", () => {
		it("should copy public folder contents to dist", async () => {
			const options = new DoculaOptions();
			options.output = "test/temp/public-folder-test";
			options.sitePath = "test/fixtures/single-page-site";
			const builder = new DoculaBuilder(options);
			const consoleLog = console.log;
			const consoleMessages: string[] = [];
			console.log = (message) => {
				consoleMessages.push(message as string);
			};

			try {
				await builder.build();

				// Verify public folder message was logged
				expect(
					consoleMessages.some((msg) =>
						stripAnsi(msg).includes("Copying public folder"),
					),
				).toBe(true);

				// Verify files were copied
				expect(fs.existsSync(`${options.output}/images/test.png`)).toBe(true);
				expect(fs.existsSync(`${options.output}/sample.pdf`)).toBe(true);

				// Verify copied file contents
				const testPngContent = await fs.promises.readFile(
					`${options.output}/images/test.png`,
					"utf8",
				);
				expect(testPngContent).toBe("test image content\n");

				const samplePdfContent = await fs.promises.readFile(
					`${options.output}/sample.pdf`,
					"utf8",
				);
				expect(samplePdfContent).toBe("test pdf content\n");

				// Verify dotfiles are also copied
				expect(fs.existsSync(`${options.output}/.nojekyll`)).toBe(true);
				expect(
					fs.existsSync(`${options.output}/.well-known/security.txt`),
				).toBe(true);
			} finally {
				await fs.promises.rm(builder.options.output, { recursive: true });
				console.log = consoleLog;
			}
		});

		it("should skip copying unchanged public folder files when hashes match", () => {
			const sitePath = "test/temp/public-diff-skip";
			const publicPath = `${sitePath}/public`;
			const outputPath = `${sitePath}/output`;

			try {
				const builder = new DoculaBuilder();

				// Create a public folder with a file
				fs.mkdirSync(publicPath, { recursive: true });
				fs.writeFileSync(`${publicPath}/hello.txt`, "hello world");

				// First copy — populates currentAssets and copies the file
				const currentAssets: Record<string, string> = {};
				copyPublicDirectory(
					builder.console,
					testHash,
					publicPath,
					outputPath,
					publicPath,
					path.resolve(outputPath),
					{},
					currentAssets,
				);
				expect(fs.existsSync(`${outputPath}/hello.txt`)).toBe(true);
				expect(currentAssets["public/hello.txt"]).toBeDefined();

				// Capture console messages for second copy
				const consoleLog = console.log;
				const consoleMessages: string[] = [];
				console.log = (message) => {
					consoleMessages.push(message as string);
				};

				try {
					// Second copy with same hashes as previousAssets — should skip
					const secondAssets: Record<string, string> = {};
					copyPublicDirectory(
						builder.console,
						testHash,
						publicPath,
						outputPath,
						publicPath,
						path.resolve(outputPath),
						currentAssets,
						secondAssets,
					);

					// Hash should still be recorded
					expect(secondAssets["public/hello.txt"]).toBe(
						currentAssets["public/hello.txt"],
					);

					// File should NOT have been logged as copied
					const copyMessages = consoleMessages.filter((msg) =>
						stripAnsi(msg).includes("hello.txt"),
					);
					expect(copyMessages.length).toBe(0);
				} finally {
					console.log = consoleLog;
				}
			} finally {
				fs.rmSync(sitePath, { recursive: true, force: true });
			}
		});

		it("should not log anything when public folder does not exist", async () => {
			const options = new DoculaOptions();
			options.output = "test/temp/no-public-folder-test";
			options.sitePath = "test/fixtures/multi-page-site";
			const builder = new DoculaBuilder(options);
			const consoleLog = console.log;
			const consoleMessages: string[] = [];
			console.log = (message) => {
				consoleMessages.push(message as string);
			};

			try {
				await builder.build();

				// Verify public folder message was NOT logged
				expect(
					consoleMessages.some((msg) =>
						stripAnsi(msg).includes("Copying public folder"),
					),
				).toBe(false);
			} finally {
				await fs.promises.rm(builder.options.output, { recursive: true });
				console.log = consoleLog;
			}
		});

		it("should skip output when it is inside public folder to prevent recursive copy", async () => {
			// Create a temporary site with public folder where output is inside public
			const tempSitePath = "test/temp/recursive-site";
			const publicPath = `${tempSitePath}/public`;
			const output = `${publicPath}/dist`;

			// Setup temporary site structure
			await fs.promises.mkdir(`${publicPath}/assets`, { recursive: true });
			await fs.promises.writeFile(`${publicPath}/test.txt`, "test content");
			await fs.promises.writeFile(
				`${publicPath}/assets/image.png`,
				"image content",
			);

			// Create minimal required site files
			await fs.promises.writeFile(`${tempSitePath}/README.md`, "# Test");

			const options = new DoculaOptions();
			options.output = output;
			options.sitePath = tempSitePath;
			const builder = new DoculaBuilder(options);
			const consoleLog = console.log;
			const consoleMessages: string[] = [];
			console.log = (message) => {
				consoleMessages.push(message as string);
			};

			try {
				await builder.build();

				// Verify build completed (didn't hang from infinite recursion)
				expect(
					consoleMessages.some((msg) =>
						stripAnsi(msg).includes("Build completed"),
					),
				).toBe(true);

				// Verify files were copied but dist folder itself was skipped
				expect(fs.existsSync(`${output}/test.txt`)).toBe(true);
				expect(fs.existsSync(`${output}/assets/image.png`)).toBe(true);

				// Verify no recursive dist/dist folder was created
				expect(fs.existsSync(`${output}/dist`)).toBe(false);
			} finally {
				await fs.promises.rm(tempSitePath, { recursive: true });
				console.log = consoleLog;
			}
		});
	});

	describe("Docula Builder - cookieAuth", () => {
		it("should render login button when cookieAuth is configured", async () => {
			const options = new DoculaOptions();
			options.template = "modern";
			options.sitePath = "test/fixtures/multi-page-site";
			options.output = "test/temp/build-cookie-auth";
			options.cookieAuth = { loginUrl: "/login" };
			const builder = new DoculaBuilder(options);

			try {
				await builder.build();
				const indexHtml = await fs.promises.readFile(
					`${options.output}/index.html`,
					"utf8",
				);
				expect(indexHtml).toContain('id="cookie-auth-login"');
				expect(indexHtml).toContain('href="/login"');
				expect(indexHtml).toContain('id="cookie-auth-logout"');
				expect(indexHtml).toContain("Log In");
				expect(indexHtml).toContain("Log Out");
			} finally {
				await fs.promises.rm(options.output, {
					recursive: true,
					force: true,
				});
			}
		});

		it("should not render login button when cookieAuth is not configured", async () => {
			const options = new DoculaOptions();
			options.template = "modern";
			options.sitePath = "test/fixtures/multi-page-site";
			options.output = "test/temp/build-no-cookie-auth";

			const builder = new DoculaBuilder(options);

			try {
				await builder.build();
				const indexHtml = await fs.promises.readFile(
					`${options.output}/index.html`,
					"utf8",
				);
				expect(indexHtml).not.toContain('id="cookie-auth-login"');
				expect(indexHtml).not.toContain('id="cookie-auth-logout"');
			} finally {
				await fs.promises.rm(options.output, {
					recursive: true,
					force: true,
				});
			}
		});

		it("should render logoutUrl redirect script when logoutUrl is configured", async () => {
			const options = new DoculaOptions();
			options.template = "modern";
			options.sitePath = "test/fixtures/multi-page-site";
			options.output = "test/temp/build-cookie-auth-logout-url";

			options.cookieAuth = {
				loginUrl: "/login",
				logoutUrl: "/api/auth/logout",
			};
			const builder = new DoculaBuilder(options);

			try {
				await builder.build();
				const indexHtml = await fs.promises.readFile(
					`${options.output}/index.html`,
					"utf8",
				);
				expect(indexHtml).toContain("/api/auth/logout");
			} finally {
				await fs.promises.rm(options.output, {
					recursive: true,
					force: true,
				});
			}
		});

		it("should render mobile login button when cookieAuth is configured", async () => {
			const options = new DoculaOptions();
			options.template = "modern";
			options.sitePath = "test/fixtures/multi-page-site";
			options.output = "test/temp/build-cookie-auth-mobile";

			options.cookieAuth = { loginUrl: "/login" };
			const builder = new DoculaBuilder(options);

			try {
				await builder.build();
				// Check a docs page which uses header-bar with mobile nav
				const docsHtml = await fs.promises.readFile(
					`${options.output}/docs/front-matter/index.html`,
					"utf8",
				);
				expect(docsHtml).toContain('id="cookie-auth-login-mobile"');
				expect(docsHtml).toContain('id="cookie-auth-logout-mobile"');
			} finally {
				await fs.promises.rm(options.output, {
					recursive: true,
					force: true,
				});
			}
		});

		it("should render header-actions wrapper around cookie auth and theme toggle", async () => {
			const options = new DoculaOptions();
			options.template = "modern";
			options.sitePath = "test/fixtures/multi-page-site";
			options.output = "test/temp/build-cookie-auth-header-actions";

			options.cookieAuth = { loginUrl: "/login" };
			const builder = new DoculaBuilder(options);

			try {
				await builder.build();
				const docsHtml = await fs.promises.readFile(
					`${options.output}/docs/front-matter/index.html`,
					"utf8",
				);
				expect(docsHtml).toContain('class="header-actions"');
			} finally {
				await fs.promises.rm(options.output, {
					recursive: true,
					force: true,
				});
			}
		});

		it("should render cached auth state check in head script", async () => {
			const options = new DoculaOptions();
			options.template = "modern";
			options.sitePath = "test/fixtures/multi-page-site";
			options.output = "test/temp/build-cookie-auth-head-cache";

			options.cookieAuth = { loginUrl: "/login" };
			const builder = new DoculaBuilder(options);

			try {
				await builder.build();
				const docsHtml = await fs.promises.readFile(
					`${options.output}/docs/front-matter/index.html`,
					"utf8",
				);
				expect(docsHtml).toContain("docula-auth-state");
				expect(docsHtml).toContain("docula-auth-logged-in");
			} finally {
				await fs.promises.rm(options.output, {
					recursive: true,
					force: true,
				});
			}
		});

		it("should render inline username script after cookie-auth-user element", async () => {
			const options = new DoculaOptions();
			options.template = "modern";
			options.sitePath = "test/fixtures/multi-page-site";
			options.output = "test/temp/build-cookie-auth-inline-username";

			options.cookieAuth = { loginUrl: "/login" };
			const builder = new DoculaBuilder(options);

			try {
				await builder.build();
				const docsHtml = await fs.promises.readFile(
					`${options.output}/docs/front-matter/index.html`,
					"utf8",
				);
				expect(docsHtml).toContain("cookie-auth-user");
				expect(docsHtml).toContain("__doculaAuth");
			} finally {
				await fs.promises.rm(options.output, {
					recursive: true,
					force: true,
				});
			}
		});

		it("should not use inline display:none styles on cookie auth elements", async () => {
			const options = new DoculaOptions();
			options.template = "modern";
			options.sitePath = "test/fixtures/multi-page-site";
			options.output = "test/temp/build-cookie-auth-no-inline-styles";
			options.cookieAuth = { loginUrl: "/login" };
			const builder = new DoculaBuilder(options);

			try {
				await builder.build();
				const docsHtml = await fs.promises.readFile(
					`${options.output}/docs/front-matter/index.html`,
					"utf8",
				);
				const logoutMatch = docsHtml.match(/id="cookie-auth-logout"[^>]*/);
				expect(logoutMatch).toBeTruthy();
				expect(logoutMatch?.[0]).not.toContain('style="display:none"');
			} finally {
				await fs.promises.rm(options.output, {
					recursive: true,
					force: true,
				});
			}
		});

		it("should render authCheckUrl in config when configured", async () => {
			const options = new DoculaOptions();
			options.template = "modern";
			options.sitePath = "test/fixtures/multi-page-site";
			options.output = "test/temp/build-cookie-auth-check-url";

			options.cookieAuth = {
				loginUrl: "/login",
				authCheckUrl: "https://api.example.com/me",
				authCheckUserPath: "email",
			};
			const builder = new DoculaBuilder(options);

			try {
				await builder.build();
				const indexHtml = await fs.promises.readFile(
					`${options.output}/index.html`,
					"utf8",
				);
				expect(indexHtml).toContain(
					'data-auth-check-url="https://api.example.com/me"',
				);
				expect(indexHtml).toContain('data-auth-check-user-path="email"');
			} finally {
				await fs.promises.rm(options.output, {
					recursive: true,
					force: true,
				});
			}
		});
	});

	describe("Docula Builder - headerLinks", () => {
		it("should render header links when headerLinks is configured", async () => {
			const options = new DoculaOptions();
			options.template = "modern";
			options.sitePath = "test/fixtures/multi-page-site";
			options.output = "test/temp/build-header-links";

			options.headerLinks = [
				{ label: "Blog", url: "https://blog.example.com" },
				{ label: "Support", url: "https://support.example.com" },
			];
			const builder = new DoculaBuilder(options);

			try {
				await builder.build();
				// header-bar is rendered on docs pages, not the home page
				const docsHtml = await fs.promises.readFile(
					`${options.output}/docs/front-matter/index.html`,
					"utf8",
				);
				expect(docsHtml).toContain("Blog");
				expect(docsHtml).toContain('href="https://blog.example.com"');
				expect(docsHtml).toContain("Support");
				expect(docsHtml).toContain('href="https://support.example.com"');
				expect(docsHtml).toContain('target="_blank"');
				expect(docsHtml).toContain('rel="noopener noreferrer"');
			} finally {
				await fs.promises.rm(options.output, {
					recursive: true,
					force: true,
				});
			}
		});

		it("should not render header links when headerLinks is not configured", async () => {
			const options = new DoculaOptions();
			options.template = "modern";
			options.sitePath = "test/fixtures/multi-page-site";
			options.output = "test/temp/build-no-header-links";

			const builder = new DoculaBuilder(options);

			try {
				await builder.build();
				const docsHtml = await fs.promises.readFile(
					`${options.output}/docs/front-matter/index.html`,
					"utf8",
				);
				expect(docsHtml).not.toContain('href="https://blog.example.com"');
			} finally {
				await fs.promises.rm(options.output, {
					recursive: true,
					force: true,
				});
			}
		});

		it("should render custom icon when icon property is provided", async () => {
			const options = new DoculaOptions();
			options.template = "modern";
			options.sitePath = "test/fixtures/multi-page-site";
			options.output = "test/temp/build-header-links-icon";

			options.headerLinks = [
				{
					label: "Blog",
					url: "https://blog.example.com",
					icon: '<svg class="custom-blog-icon" width="16" height="16"><circle cx="8" cy="8" r="8"/></svg>',
				},
			];
			const builder = new DoculaBuilder(options);

			try {
				await builder.build();
				const docsHtml = await fs.promises.readFile(
					`${options.output}/docs/front-matter/index.html`,
					"utf8",
				);
				expect(docsHtml).toContain("custom-blog-icon");
				expect(docsHtml).toContain("Blog");
			} finally {
				await fs.promises.rm(options.output, {
					recursive: true,
					force: true,
				});
			}
		});

		it("should render default icon when icon property is not provided", async () => {
			const options = new DoculaOptions();
			options.template = "modern";
			options.sitePath = "test/fixtures/multi-page-site";
			options.output = "test/temp/build-header-links-default-icon";

			options.headerLinks = [
				{ label: "Blog", url: "https://blog.example.com" },
			];
			const builder = new DoculaBuilder(options);

			try {
				await builder.build();
				const docsHtml = await fs.promises.readFile(
					`${options.output}/docs/front-matter/index.html`,
					"utf8",
				);
				// Default external link icon path should be present
				expect(docsHtml).toContain("M15 3h6v6");
				expect(docsHtml).not.toContain("custom-blog-icon");
			} finally {
				await fs.promises.rm(options.output, {
					recursive: true,
					force: true,
				});
			}
		});

		it("should render header links in mobile nav", async () => {
			const options = new DoculaOptions();
			options.template = "modern";
			options.sitePath = "test/fixtures/multi-page-site";
			options.output = "test/temp/build-header-links-mobile";

			options.headerLinks = [
				{ label: "Blog", url: "https://blog.example.com" },
			];
			const builder = new DoculaBuilder(options);

			try {
				await builder.build();
				const docsHtml = await fs.promises.readFile(
					`${options.output}/docs/front-matter/index.html`,
					"utf8",
				);
				// Should appear in both desktop nav and mobile sidebar
				const blogLinkCount = (
					docsHtml.match(/href="https:\/\/blog\.example\.com"/g) || []
				).length;
				expect(blogLinkCount).toBeGreaterThanOrEqual(2);
			} finally {
				await fs.promises.rm(options.output, {
					recursive: true,
					force: true,
				});
			}
		});
	});

	describe("Branch coverage - uncovered paths", () => {
		it("should rebuild when assets change but docs and template are unchanged", async () => {
			const sitePath = "test/temp/diff-build-asset-change";
			const output = `${sitePath}/dist`;

			fs.cpSync("test/fixtures/multi-page-site", sitePath, {
				recursive: true,
			});

			const consoleLog = console.log;

			try {
				const options = new DoculaOptions();
				options.sitePath = sitePath;
				options.output = output;
				options.templatePath = "test/fixtures/template-example/";
				const builder = new DoculaBuilder(options);
				builder.console.quiet = true;

				// First build
				await builder.build();

				// Modify an asset file (variables.css)
				fs.writeFileSync(
					`${sitePath}/variables.css`,
					":root { --color: red; }",
				);

				builder.console.quiet = false;
				const messages: string[] = [];
				console.log = (message) => {
					messages.push(stripAnsi(message as string));
				};

				// Second build — assets changed, should NOT skip
				await builder.build();

				expect(
					messages.some((m) =>
						m.includes("No changes detected, skipping build"),
					),
				).toBe(false);
				expect(messages.some((m) => m.includes("Build completed"))).toBe(true);
			} finally {
				console.log = consoleLog;
				fs.rmSync(sitePath, { recursive: true, force: true });
			}
		});

		it("should handle escapeXml with undefined value", () => {
			const _builder = new DoculaBuilder();
			const result = escapeXml(undefined);
			expect(result).toBe("");
		});

		it("should truncate without word boundary when text has no spaces", () => {
			const builder = new DoculaBuilder();
			// Create text with no spaces that exceeds maxLength
			const longText = "a".repeat(600);
			const preview = builder.generateChangelogPreview(longText, 500);
			expect(preview).toContain("...");
		});

		it("should restore original template file when override is removed", () => {
			const sitePath = "test/temp/override-restore-original-test";
			const overrideDir = `${sitePath}/templates/modern/includes`;

			// Create override that shadows an existing template file
			fs.mkdirSync(overrideDir, { recursive: true });
			fs.writeFileSync(
				`${overrideDir}/footer.hbs`,
				"<footer>Override Footer</footer>",
			);

			const consoleLog = console.log;

			try {
				const options = new DoculaOptions();
				options.sitePath = sitePath;
				const builder = new DoculaBuilder(options);
				builder.console.quiet = true;

				// First merge — creates cache with override
				const result = mergeTemplateOverrides(
					options,
					builder.console,
					testHash,
					"test/fixtures/template-example",
					sitePath,
					"modern",
				);

				// Verify override is in cache
				const cachedFooter = fs.readFileSync(
					`${result}/includes/footer.hbs`,
					"utf8",
				);
				expect(cachedFooter).toBe("<footer>Override Footer</footer>");

				// Remove the override
				fs.unlinkSync(`${overrideDir}/footer.hbs`);

				builder.console.quiet = false;
				const messages: string[] = [];
				console.log = (message) => {
					messages.push(stripAnsi(message as string));
				};

				// Second merge — should detect removal and restore original
				mergeTemplateOverrides(
					options,
					builder.console,
					testHash,
					"test/fixtures/template-example",
					sitePath,
					"modern",
				);

				expect(
					messages.some((m) =>
						m.includes("Template override removed: includes/footer.hbs"),
					),
				).toBe(true);

				// Original template file should be restored in cache
				const restoredFooter = fs.readFileSync(
					`${result}/includes/footer.hbs`,
					"utf8",
				);
				const originalFooter = fs.readFileSync(
					"test/fixtures/template-example/includes/footer.hbs",
					"utf8",
				);
				expect(restoredFooter).toBe(originalFooter);
			} finally {
				console.log = consoleLog;
				fs.rmSync(sitePath, { recursive: true, force: true });
			}
		});
	});

	describe("Docula Builder - Configurable Paths", () => {
		it("should use custom docsPath for document urlPaths", () => {
			const options = new DoculaOptions({
				sitePath: "test/fixtures/multi-page-site",
				docsPath: "guide",
			});
			const builder = new DoculaBuilder(options);
			const doc = builder.parseDocumentData(
				"test/fixtures/multi-page-site/docs/front-matter.md",
			);
			expect(doc.urlPath).toContain("/guide/");
			expect(doc.urlPath).not.toContain("/docs/");
		});

		it("should place docs at root when docsPath is empty", () => {
			const options = new DoculaOptions({
				sitePath: "test/fixtures/multi-page-site",
				docsPath: "",
			});
			const builder = new DoculaBuilder(options);
			const doc = builder.parseDocumentData(
				"test/fixtures/multi-page-site/docs/front-matter.md",
			);
			expect(doc.urlPath).toMatch(/^\/front-matter\//);
			expect(doc.urlPath).not.toContain("/docs/");
		});

		it("should use custom changelogPath for changelog entry urlPaths", () => {
			const options = new DoculaOptions({
				sitePath: "test/fixtures/changelog-site",
				changelogPath: "releases",
			});
			const builder = new DoculaBuilder(options);
			const entry = builder.parseChangelogEntry(
				"test/fixtures/changelog-site/changelog/2025-01-15-new-feature.md",
			);
			expect(entry.urlPath).toContain("/releases/");
			expect(entry.urlPath).not.toContain("/changelog/");
		});

		it("should build docs pages at output root when docsPath is empty", async () => {
			const options = new DoculaOptions({
				sitePath: "test/fixtures/multi-page-site",
				output: "./test/temp/empty-docspath",
				docsPath: "",
			});
			const builder = new DoculaBuilder(options);
			const data: DoculaData = {
				...defaultPathFields,
				siteUrl: "http://example.com",
				siteTitle: "Test",
				siteDescription: "Test Description",
				sitePath: options.sitePath,
				templatePath: "test/fixtures/template-example",
				output: options.output,
				docsPath: "",
				docsUrl: "/",
				templates: { home: "home.hbs", docPage: "docs.hbs" },
				documents: builder.getDocuments(`${options.sitePath}/docs`, {
					...defaultPathFields,
					siteUrl: "http://example.com",
					siteTitle: "Test",
					siteDescription: "Test Description",
					sitePath: options.sitePath,
					templatePath: "test/fixtures/template-example",
					output: options.output,
				}),
			};

			try {
				await builder.buildDocsPages(data);
				// Files should be at output root, not under output/docs/
				expect(fs.existsSync(`${data.output}/docs`)).toBe(false);
				const builtFiles = fs.readdirSync(data.output, { recursive: true });
				expect(builtFiles.length).toBeGreaterThan(0);
			} finally {
				fs.rmSync(data.output, { recursive: true, force: true });
			}
		});

		it("should include baseUrl in sitemap document URLs", async () => {
			const data: DoculaData = {
				...defaultPathFields,
				siteUrl: "http://example.com",
				siteTitle: "Test",
				siteDescription: "Test Description",
				sitePath: "test/fixtures/multi-page-site",
				templatePath: "",
				output: "test/temp/sitemap-basurl",
				baseUrl: "/docs",
				docsPath: "",
				docsUrl: "/docs",
				apiPath: "api",
				apiUrl: "/docs/api",
				changelogPath: "changelog",
				changelogUrl: "/docs/changelog",
				documents: [
					{
						title: "Getting Started",
						navTitle: "Getting Started",
						description: "",
						keywords: [],
						content: "",
						markdown: "",
						generatedHtml: "",
						documentPath: "",
						urlPath: "/getting-started/index.html",
						isRoot: true,
						lastModified: "2025-01-01",
					},
				],
			};

			const options = new DoculaOptions({
				sitePath: "test/fixtures/multi-page-site",
			});
			const builder = new DoculaBuilder(options);

			try {
				await builder.buildSiteMapPage(data);
				const sitemap = fs.readFileSync(`${data.output}/sitemap.xml`, "utf8");
				expect(sitemap).toContain(
					"<loc>http://example.com/docs/getting-started/</loc>",
				);
			} finally {
				fs.rmSync(data.output, { recursive: true, force: true });
			}
		});

		it("should include baseUrl and custom apiPath in sitemap", async () => {
			const data: DoculaData = {
				...defaultPathFields,
				siteUrl: "http://example.com",
				siteTitle: "Test",
				siteDescription: "Test Description",
				sitePath: "test/fixtures/multi-page-site",
				templatePath: "",
				output: "test/temp/sitemap-apipath",
				baseUrl: "/docs",
				docsPath: "",
				docsUrl: "/docs",
				apiPath: "reference",
				apiUrl: "/docs/reference",
				changelogPath: "changelog",
				changelogUrl: "/docs/changelog",
				openApiUrl: "/reference/swagger.json",
				templates: { home: "home.hbs", api: "api.hbs" },
			};

			const options = new DoculaOptions({
				sitePath: "test/fixtures/multi-page-site",
			});
			const builder = new DoculaBuilder(options);

			try {
				await builder.buildSiteMapPage(data);
				const sitemap = fs.readFileSync(`${data.output}/sitemap.xml`, "utf8");
				expect(sitemap).toContain(
					"<loc>http://example.com/docs/reference</loc>",
				);
			} finally {
				fs.rmSync(data.output, { recursive: true, force: true });
			}
		});
	});

	describe("Docula Builder - editPageUrl", () => {
		it("should render edit page link when editPageUrl is configured", async () => {
			const options = new DoculaOptions();
			options.template = "modern";
			options.sitePath = "test/fixtures/multi-page-site";
			options.output = "test/temp/build-edit-page-url";
			options.editPageUrl = "https://github.com/owner/repo/edit/main/site/docs";

			const builder = new DoculaBuilder(options);

			try {
				await builder.build();
				const docsHtml = await fs.promises.readFile(
					`${options.output}/docs/front-matter/index.html`,
					"utf8",
				);
				expect(docsHtml).toContain("Edit this page");
				expect(docsHtml).toContain(
					'href="https://github.com/owner/repo/edit/main/site/docs/front-matter.md"',
				);
				expect(docsHtml).toContain('target="_blank"');
				expect(docsHtml).toContain('rel="noopener noreferrer"');
				expect(docsHtml).toContain("article__edit-link");
			} finally {
				await fs.promises.rm(options.output, {
					recursive: true,
					force: true,
				});
			}
		});

		it("should not render edit page link when editPageUrl is not configured", async () => {
			const options = new DoculaOptions();
			options.template = "modern";
			options.sitePath = "test/fixtures/multi-page-site";
			options.output = "test/temp/build-no-edit-page-url";

			const builder = new DoculaBuilder(options);

			try {
				await builder.build();
				const docsHtml = await fs.promises.readFile(
					`${options.output}/docs/front-matter/index.html`,
					"utf8",
				);
				expect(docsHtml).not.toContain("Edit this page");
				expect(docsHtml).not.toContain("article__edit-link");
			} finally {
				await fs.promises.rm(options.output, {
					recursive: true,
					force: true,
				});
			}
		});

		it("should strip trailing slashes from editPageUrl via parseOptions", async () => {
			const options = new DoculaOptions();
			options.template = "modern";
			options.sitePath = "test/fixtures/multi-page-site";
			options.output = "test/temp/build-edit-page-url-slash";
			options.parseOptions({
				editPageUrl: "https://github.com/owner/repo/edit/main/site/docs/",
			});

			const builder = new DoculaBuilder(options);

			try {
				await builder.build();
				const docsHtml = await fs.promises.readFile(
					`${options.output}/docs/front-matter/index.html`,
					"utf8",
				);
				expect(docsHtml).toContain(
					'href="https://github.com/owner/repo/edit/main/site/docs/front-matter.md"',
				);
			} finally {
				await fs.promises.rm(options.output, {
					recursive: true,
					force: true,
				});
			}
		});

		it("should render correct edit page URL for nested section documents", async () => {
			const options = new DoculaOptions();
			options.template = "modern";
			options.sitePath = "test/fixtures/mega-page-site";
			options.output = "test/temp/build-edit-page-url-nested";
			options.editPageUrl = "https://github.com/owner/repo/edit/main/site/docs";

			const builder = new DoculaBuilder(options);

			try {
				await builder.build();
				// Check a nested section document
				const nestedFiles = await fs.promises.readdir(
					`${options.output}/docs`,
					{ recursive: true },
				);
				const htmlFiles = nestedFiles
					.map((f) => f.toString())
					.filter((f) => f.endsWith("index.html"));
				expect(htmlFiles.length).toBeGreaterThan(0);

				// Read the first nested doc and verify it has an edit link
				const firstHtml = await fs.promises.readFile(
					`${options.output}/docs/${htmlFiles[0]}`,
					"utf8",
				);
				expect(firstHtml).toContain("Edit this page");
				expect(firstHtml).toContain(
					"https://github.com/owner/repo/edit/main/site/docs/",
				);
			} finally {
				await fs.promises.rm(options.output, {
					recursive: true,
					force: true,
				});
			}
		});

		it("should render edit page link in the classic template", async () => {
			const options = new DoculaOptions();
			options.template = "classic";
			options.sitePath = "test/fixtures/multi-page-site";
			options.output = "test/temp/build-edit-page-url-classic";
			options.editPageUrl = "https://github.com/owner/repo/edit/main/site/docs";

			const builder = new DoculaBuilder(options);

			try {
				await builder.build();
				const docsHtml = await fs.promises.readFile(
					`${options.output}/docs/front-matter/index.html`,
					"utf8",
				);
				expect(docsHtml).toContain("Edit this page");
				expect(docsHtml).toContain(
					'href="https://github.com/owner/repo/edit/main/site/docs/front-matter.md"',
				);
				expect(docsHtml).toContain('target="_blank"');
				expect(docsHtml).toContain("edit-page-link");
			} finally {
				await fs.promises.rm(options.output, {
					recursive: true,
					force: true,
				});
			}
		});

		it("should render edit page link on docs home page when site has no README", async () => {
			const options = new DoculaOptions();
			options.sitePath = "test/fixtures/mega-page-site-no-home-page";
			options.output = "test/temp/build-edit-page-url-no-home";
			options.editPageUrl = "https://github.com/owner/repo/edit/main/site/docs";
			options.autoReadme = false;

			const builder = new DoculaBuilder(options);

			try {
				await builder.build();
				const indexHtml = await fs.promises.readFile(
					`${options.output}/index.html`,
					"utf8",
				);
				expect(indexHtml).toContain("Edit this page");
				expect(indexHtml).toContain("article__edit-link");
				expect(indexHtml).toContain(
					'href="https://github.com/owner/repo/edit/main/site/docs/',
				);
			} finally {
				await fs.promises.rm(options.output, {
					recursive: true,
					force: true,
				});
			}
		});

		it("should render OpenGraph meta tags when openGraph is configured", async () => {
			const options = new DoculaOptions();
			options.sitePath = "test/fixtures/multi-page-site";
			options.output = "test/temp/build-opengraph";
			options.openGraph = {
				title: "Default OG Title",
				description: "Default OG Description",
				image: "https://example.com/default-og.png",
			};

			const builder = new DoculaBuilder(options);

			try {
				await builder.build();
				const docsHtml = await fs.promises.readFile(
					`${options.output}/docs/front-matter/index.html`,
					"utf8",
				);
				expect(docsHtml).toContain('property="og:title"');
				expect(docsHtml).toContain('property="og:description"');
				expect(docsHtml).toContain('property="og:image"');
				expect(docsHtml).toContain('property="og:type"');
				expect(docsHtml).toContain('property="og:site_name"');
				expect(docsHtml).toContain('name="twitter:card"');
				expect(docsHtml).toContain('name="twitter:title"');
				expect(docsHtml).toContain('name="twitter:description"');
				expect(docsHtml).toContain('name="twitter:image"');
			} finally {
				await fs.promises.rm(options.output, {
					recursive: true,
					force: true,
				});
			}
		});

		it("should not render OpenGraph meta tags when openGraph is not configured", async () => {
			const options = new DoculaOptions();
			options.sitePath = "test/fixtures/multi-page-site";
			options.output = "test/temp/build-no-opengraph";

			const builder = new DoculaBuilder(options);

			try {
				await builder.build();
				const docsHtml = await fs.promises.readFile(
					`${options.output}/docs/front-matter/index.html`,
					"utf8",
				);
				expect(docsHtml).not.toContain('property="og:title"');
				expect(docsHtml).not.toContain('name="twitter:card"');
			} finally {
				await fs.promises.rm(options.output, {
					recursive: true,
					force: true,
				});
			}
		});

		it("should use document frontmatter ogTitle/ogDescription/ogImage over site defaults", async () => {
			const options = new DoculaOptions();
			options.sitePath = "test/fixtures/multi-page-site";
			options.output = "test/temp/build-opengraph-override";
			options.openGraph = {
				title: "Default OG Title",
				description: "Default OG Description",
				image: "https://example.com/default-og.png",
			};

			const builder = new DoculaBuilder(options);

			try {
				await builder.build();
				const docsHtml = await fs.promises.readFile(
					`${options.output}/docs/opengraph-doc/index.html`,
					"utf8",
				);
				expect(docsHtml).toContain("Custom OG Title");
				expect(docsHtml).toContain("Custom OG Description");
				expect(docsHtml).toContain("https://example.com/custom-og.png");
			} finally {
				await fs.promises.rm(options.output, {
					recursive: true,
					force: true,
				});
			}
		});

		it("should render OpenGraph meta tags on the home page when configured", async () => {
			const options = new DoculaOptions();
			options.sitePath = "test/fixtures/multi-page-site";
			options.output = "test/temp/build-opengraph-home";
			options.openGraph = {
				title: "Home OG",
				description: "Home OG Description",
			};

			const builder = new DoculaBuilder(options);

			try {
				await builder.build();
				const homeHtml = await fs.promises.readFile(
					`${options.output}/index.html`,
					"utf8",
				);
				expect(homeHtml).toContain('property="og:title"');
				expect(homeHtml).toContain("Home OG");
				expect(homeHtml).toContain('name="twitter:card"');
				expect(homeHtml).toContain("summary");
			} finally {
				await fs.promises.rm(options.output, {
					recursive: true,
					force: true,
				});
			}
		});

		it("should not render edit page link in the classic template when not configured", async () => {
			const options = new DoculaOptions();
			options.template = "classic";
			options.sitePath = "test/fixtures/multi-page-site";
			options.output = "test/temp/build-no-edit-page-url-classic";

			const builder = new DoculaBuilder(options);

			try {
				await builder.build();
				const docsHtml = await fs.promises.readFile(
					`${options.output}/docs/front-matter/index.html`,
					"utf8",
				);
				expect(docsHtml).not.toContain("Edit this page");
				expect(docsHtml).not.toContain("edit-page-link");
			} finally {
				await fs.promises.rm(options.output, {
					recursive: true,
					force: true,
				});
			}
		});
	});

	describe("autoReadme", () => {
		const tempDir = "test/temp/auto-readme-test";
		const tempSitePath = `${tempDir}/site`;
		const tempCwdPath = `${tempDir}/cwd`;

		beforeEach(async () => {
			await fs.promises.mkdir(tempSitePath, { recursive: true });
			await fs.promises.mkdir(tempCwdPath, { recursive: true });
		});

		afterEach(async () => {
			fs.rmSync(tempDir, { recursive: true, force: true });
		});

		it("should copy README.md from cwd to sitePath and prepend package name as title", async () => {
			const cwdSpy = vi
				.spyOn(process, "cwd")
				.mockReturnValue(path.resolve(tempCwdPath));
			fs.writeFileSync(`${tempCwdPath}/README.md`, "Some content here");
			fs.writeFileSync(
				`${tempCwdPath}/package.json`,
				JSON.stringify({ name: "test-pkg" }),
			);

			const options = new DoculaOptions();
			options.sitePath = tempSitePath;
			options.autoReadme = true;
			const builder = new DoculaBuilder(options);
			await builder.autoReadme();

			expect(fs.existsSync(`${tempSitePath}/README.md`)).toBe(true);
			const content = fs.readFileSync(`${tempSitePath}/README.md`, "utf8");
			expect(content).toContain("# test-pkg");
			expect(content).toContain("Some content here");

			cwdSpy.mockRestore();
		});

		it("should not copy README when autoReadme is false", async () => {
			const cwdSpy = vi
				.spyOn(process, "cwd")
				.mockReturnValue(path.resolve(tempCwdPath));
			fs.writeFileSync(`${tempCwdPath}/README.md`, "Some content");

			const options = new DoculaOptions();
			options.sitePath = tempSitePath;
			options.autoReadme = false;
			const builder = new DoculaBuilder(options);
			await builder.autoReadme();

			expect(fs.existsSync(`${tempSitePath}/README.md`)).toBe(false);

			cwdSpy.mockRestore();
		});

		it("should not overwrite existing site README", async () => {
			const cwdSpy = vi
				.spyOn(process, "cwd")
				.mockReturnValue(path.resolve(tempCwdPath));
			fs.writeFileSync(`${tempSitePath}/README.md`, "Existing content");
			fs.writeFileSync(`${tempCwdPath}/README.md`, "Root content");

			const options = new DoculaOptions();
			options.sitePath = tempSitePath;
			const builder = new DoculaBuilder(options);
			await builder.autoReadme();

			const content = fs.readFileSync(`${tempSitePath}/README.md`, "utf8");
			expect(content).toEqual("Existing content");

			cwdSpy.mockRestore();
		});

		it("should do nothing when no README exists in cwd", async () => {
			const cwdSpy = vi
				.spyOn(process, "cwd")
				.mockReturnValue(path.resolve(tempCwdPath));

			const options = new DoculaOptions();
			options.sitePath = tempSitePath;
			const builder = new DoculaBuilder(options);
			await builder.autoReadme();

			expect(fs.existsSync(`${tempSitePath}/README.md`)).toBe(false);

			cwdSpy.mockRestore();
		});

		it("should not prepend title when README already has a heading", async () => {
			const cwdSpy = vi
				.spyOn(process, "cwd")
				.mockReturnValue(path.resolve(tempCwdPath));
			fs.writeFileSync(
				`${tempCwdPath}/README.md`,
				"# Existing Title\n\nSome content",
			);
			fs.writeFileSync(
				`${tempCwdPath}/package.json`,
				JSON.stringify({ name: "test-pkg" }),
			);

			const options = new DoculaOptions();
			options.sitePath = tempSitePath;
			const builder = new DoculaBuilder(options);
			await builder.autoReadme();

			const content = fs.readFileSync(`${tempSitePath}/README.md`, "utf8");
			expect(content).toEqual("# Existing Title\n\nSome content");

			cwdSpy.mockRestore();
		});

		it("should copy README as-is when no package.json exists", async () => {
			const cwdSpy = vi
				.spyOn(process, "cwd")
				.mockReturnValue(path.resolve(tempCwdPath));
			fs.writeFileSync(`${tempCwdPath}/README.md`, "No heading content");

			const options = new DoculaOptions();
			options.sitePath = tempSitePath;
			const builder = new DoculaBuilder(options);
			await builder.autoReadme();

			const content = fs.readFileSync(`${tempSitePath}/README.md`, "utf8");
			expect(content).toEqual("No heading content");

			cwdSpy.mockRestore();
		});

		it("should handle invalid package.json gracefully", async () => {
			const cwdSpy = vi
				.spyOn(process, "cwd")
				.mockReturnValue(path.resolve(tempCwdPath));
			fs.writeFileSync(`${tempCwdPath}/README.md`, "Some content");
			fs.writeFileSync(`${tempCwdPath}/package.json`, "not valid json");

			const options = new DoculaOptions();
			options.sitePath = tempSitePath;
			const builder = new DoculaBuilder(options);
			await builder.autoReadme();

			const content = fs.readFileSync(`${tempSitePath}/README.md`, "utf8");
			expect(content).toEqual("Some content");

			cwdSpy.mockRestore();
		});

		it("should copy referenced assets from cwd to sitePath", async () => {
			const cwdSpy = vi
				.spyOn(process, "cwd")
				.mockReturnValue(path.resolve(tempCwdPath));

			// Create a README referencing an image
			fs.writeFileSync(
				`${tempCwdPath}/README.md`,
				"# Project\n\n![logo](assets/logo.png)\n",
			);
			// Create the referenced image
			fs.mkdirSync(`${tempCwdPath}/assets`, { recursive: true });
			fs.writeFileSync(`${tempCwdPath}/assets/logo.png`, "fake-png-data");

			const options = new DoculaOptions();
			options.sitePath = tempSitePath;
			const builder = new DoculaBuilder(options);
			await builder.autoReadme();

			// README should be copied
			expect(fs.existsSync(`${tempSitePath}/README.md`)).toBe(true);
			// Referenced asset should also be copied
			expect(fs.existsSync(`${tempSitePath}/assets/logo.png`)).toBe(true);
			const assetContent = fs.readFileSync(
				`${tempSitePath}/assets/logo.png`,
				"utf8",
			);
			expect(assetContent).toEqual("fake-png-data");

			cwdSpy.mockRestore();
		});

		it("should not copy unreferenced assets from cwd", async () => {
			const cwdSpy = vi
				.spyOn(process, "cwd")
				.mockReturnValue(path.resolve(tempCwdPath));

			fs.writeFileSync(
				`${tempCwdPath}/README.md`,
				"# Project\n\nNo images here.\n",
			);
			fs.mkdirSync(`${tempCwdPath}/assets`, { recursive: true });
			fs.writeFileSync(`${tempCwdPath}/assets/unused.png`, "fake-png-data");

			const options = new DoculaOptions();
			options.sitePath = tempSitePath;
			const builder = new DoculaBuilder(options);
			await builder.autoReadme();

			expect(fs.existsSync(`${tempSitePath}/README.md`)).toBe(true);
			expect(fs.existsSync(`${tempSitePath}/assets/unused.png`)).toBe(false);

			cwdSpy.mockRestore();
		});

		it("should auto-copy README during build and produce index.html", async () => {
			const cwdSpy = vi
				.spyOn(process, "cwd")
				.mockReturnValue(path.resolve(tempCwdPath));
			fs.writeFileSync(
				`${tempCwdPath}/README.md`,
				"# My Project\n\nWelcome to the project.",
			);
			fs.writeFileSync(
				`${tempCwdPath}/package.json`,
				JSON.stringify({ name: "my-project" }),
			);

			const options = new DoculaOptions();
			options.sitePath = "test/fixtures/auto-readme-site";
			options.output = `${tempDir}/output`;

			const builder = new DoculaBuilder(options);
			builder.console.quiet = true;

			try {
				await builder.build();
				expect(fs.existsSync(`${options.output}/index.html`)).toBe(true);
				const indexHtml = fs.readFileSync(
					`${options.output}/index.html`,
					"utf8",
				);
				expect(indexHtml).toContain("My Project");
			} finally {
				fs.rmSync(options.output, { recursive: true, force: true });
				fs.rmSync("test/fixtures/auto-readme-site/README.md", {
					force: true,
				});
				fs.rmSync("test/fixtures/auto-readme-site/.cache", {
					recursive: true,
					force: true,
				});
			}

			cwdSpy.mockRestore();
		});
	});

	describe("hashOptions - autoReadme", () => {
		it("should produce different hashes when autoReadme changes", () => {
			const optionsA = new DoculaOptions();
			optionsA.autoReadme = true;
			const optionsB = new DoculaOptions();
			optionsB.autoReadme = false;

			const hashA = hashOptionsUtil(testHash, optionsA);
			const hashB = hashOptionsUtil(testHash, optionsB);

			expect(hashA).not.toEqual(hashB);
		});
	});
});
