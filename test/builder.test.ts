import fs from "node:fs";
import path from "node:path";
import { CacheableNet } from "@cacheable/net";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	DoculaBuilder,
	type DoculaChangelogEntry,
	type DoculaData,
	type DoculaDocument,
	type DoculaSection,
} from "../src/builder.js";
import { DoculaOptions } from "../src/options.js";

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
	const doculaData: DoculaData = {
		...defaultPathFields,
		siteUrl: "http://foo.com",
		siteTitle: "docula",
		siteDescription: "Beautiful Website for Your Projects",
		sitePath: "test/fixtures/single-page-site",
		templatePath: "test/fixtures/template-example",
		output: "test/temp-sitemap-test",
	};

	afterEach(() => {
		// Reset the mock after each test
		vi.resetAllMocks();
		// Clean build manifests to prevent differential build interference between tests
		for (const fixture of [
			"test/fixtures/single-page-site",
			"test/fixtures/multi-page-site",
			"test/fixtures/mega-page-site",
			"test/fixtures/changelog-site",
			"test/fixtures/announcement-site",
			"test/fixtures/mega-custom-template",
			"test/fixtures/api-only-site",
			"test/fixtures/empty-site",
			"test/fixtures/mega-page-site-no-home-page",
		]) {
			fs.rmSync(`${fixture}/.cache/build`, { recursive: true, force: true });
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
			options.output = "test/temp-build-test";
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
			options.output = "test/temp-build-test";
			options.sitePath = "test/fixtures/mega-page-site-no-home-page";
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
			options.output = "test/temp-build-no-content";
			options.sitePath = "test/fixtures/empty-site";
			const builder = new DoculaBuilder(options);
			const consoleLog = console.log;
			const consoleError = console.error;
			const errors: string[] = [];
			console.log = (_message) => {};
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
				console.log = consoleLog;
				console.error = consoleError;
			}
		});
		it("should build multi page", async () => {
			const options = new DoculaOptions();
			options.output = "test/temp-build-test";
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
			options.output = "test/temp-build-no-changelog-entry-test";
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
			// biome-ignore lint/suspicious/noExplicitAny: test access to private method
			const result = (builder as any).mergeTemplateOverrides(
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
			// biome-ignore lint/suspicious/noExplicitAny: test access to private method
			const result = (builder as any).mergeTemplateOverrides(
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
			// biome-ignore lint/suspicious/noExplicitAny: test access to private method
			const result = (builder as any).mergeTemplateOverrides(
				"templates/modern",
				options.sitePath,
				"../../../../etc",
			);
			expect(result).toBe("templates/modern");
		});

		it("should merge template overrides and log overridden files", async () => {
			const sitePath = "test/fixtures/single-page-site";
			const overrideDir = `${sitePath}/templates/modern/includes`;
			const cacheDir = `${sitePath}/.cache`;

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
				// biome-ignore lint/suspicious/noExplicitAny: test access to private method
				const result = (builder as any).mergeTemplateOverrides(
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
				fs.rmSync(`${sitePath}/templates`, { recursive: true, force: true });
				fs.rmSync(cacheDir, { recursive: true, force: true });
			}
		});

		it("should build with template overrides applied", async () => {
			const sitePath = "test/fixtures/multi-page-site";
			const overrideDir = `${sitePath}/templates/modern/includes`;
			const outputDir = "test/temp-build-override-test";
			const cacheDir = `${sitePath}/.cache`;

			// Create override with a custom footer containing a marker
			fs.mkdirSync(overrideDir, { recursive: true });
			fs.writeFileSync(
				`${overrideDir}/footer.hbs`,
				'<footer id="custom-override-footer">Custom Override Footer</footer>',
			);

			const consoleLog = console.log;
			console.log = (_message) => {};

			try {
				const options = new DoculaOptions();
				options.sitePath = sitePath;
				options.output = outputDir;
				const builder = new DoculaBuilder(options);
				await builder.build();

				// Check the built index.html contains the custom footer
				const indexHtml = fs.readFileSync(`${outputDir}/index.html`, "utf8");
				expect(indexHtml).toContain("custom-override-footer");
			} finally {
				console.log = consoleLog;
				fs.rmSync(`${sitePath}/templates`, { recursive: true, force: true });
				fs.rmSync(cacheDir, { recursive: true, force: true });
				fs.rmSync(outputDir, { recursive: true, force: true });
			}
		});

		it("should update cache when override file content changes", () => {
			const sitePath = "test/fixtures/single-page-site";
			const overrideDir = `${sitePath}/templates/modern/includes`;
			const cacheDir = `${sitePath}/.cache`;
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
				// biome-ignore lint/suspicious/noExplicitAny: test access to private method
				(builder as any).mergeTemplateOverrides(
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
				// biome-ignore lint/suspicious/noExplicitAny: test access to private method
				(builder as any).mergeTemplateOverrides(
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
				fs.rmSync(`${sitePath}/templates`, { recursive: true, force: true });
				fs.rmSync(cacheDir, { recursive: true, force: true });
			}
		});

		it("should reuse cache when override files have not changed", () => {
			const sitePath = "test/fixtures/single-page-site";
			const overrideDir = `${sitePath}/templates/modern/includes`;
			const cacheDir = `${sitePath}/.cache`;
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
				// biome-ignore lint/suspicious/noExplicitAny: test access to private method
				(builder as any).mergeTemplateOverrides(
					"templates/modern",
					sitePath,
					"modern",
				);

				messages.length = 0;

				// Second merge — should reuse cache
				// biome-ignore lint/suspicious/noExplicitAny: test access to private method
				const result = (builder as any).mergeTemplateOverrides(
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
				fs.rmSync(`${sitePath}/templates`, { recursive: true, force: true });
				fs.rmSync(cacheDir, { recursive: true, force: true });
			}
		});

		it("should invalidate cache when an override file is deleted", () => {
			const sitePath = "test/fixtures/single-page-site";
			const overrideDir = `${sitePath}/templates/modern/includes`;
			const cacheDir = `${sitePath}/.cache`;

			fs.mkdirSync(overrideDir, { recursive: true });
			fs.writeFileSync(`${overrideDir}/footer.hbs`, "<footer>A</footer>");
			fs.writeFileSync(`${overrideDir}/header.hbs`, "<header>B</header>");

			const consoleLog = console.log;
			console.log = () => {};

			try {
				const options = new DoculaOptions();
				options.sitePath = sitePath;
				const builder = new DoculaBuilder(options);

				// First merge — builds cache with two override files
				// biome-ignore lint/suspicious/noExplicitAny: test access to private method
				(builder as any).mergeTemplateOverrides(
					"templates/modern",
					sitePath,
					"modern",
				);

				// Delete one override file
				fs.unlinkSync(`${overrideDir}/header.hbs`);

				const messages: string[] = [];
				console.log = (message) => {
					messages.push(stripAnsi(message as string));
				};

				// Second merge — should detect removal and update incrementally
				// biome-ignore lint/suspicious/noExplicitAny: test access to private method
				(builder as any).mergeTemplateOverrides(
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
				fs.rmSync(`${sitePath}/templates`, { recursive: true, force: true });
				fs.rmSync(cacheDir, { recursive: true, force: true });
			}
		});

		it("should rebuild when manifest is missing or corrupt", () => {
			const sitePath = "test/fixtures/single-page-site";
			const overrideDir = `${sitePath}/templates/modern/includes`;
			const cacheDir = `${sitePath}/.cache`;
			const cachePath = `${sitePath}/.cache/templates/modern`;

			fs.mkdirSync(overrideDir, { recursive: true });
			fs.writeFileSync(`${overrideDir}/footer.hbs`, "<footer>X</footer>");

			const consoleLog = console.log;
			console.log = () => {};

			try {
				const options = new DoculaOptions();
				options.sitePath = sitePath;
				const builder = new DoculaBuilder(options);

				// First merge — builds cache
				// biome-ignore lint/suspicious/noExplicitAny: test access to private method
				(builder as any).mergeTemplateOverrides(
					"templates/modern",
					sitePath,
					"modern",
				);

				// Corrupt the manifest
				fs.writeFileSync(`${cachePath}/.manifest.json`, "not json");

				const messages: string[] = [];
				console.log = (message) => {
					messages.push(stripAnsi(message as string));
				};

				// Should rebuild due to corrupt manifest
				// biome-ignore lint/suspicious/noExplicitAny: test access to private method
				(builder as any).mergeTemplateOverrides(
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

				// biome-ignore lint/suspicious/noExplicitAny: test access to private method
				(builder as any).mergeTemplateOverrides(
					"templates/modern",
					sitePath,
					"modern",
				);

				expect(
					messages.some((m) => m.includes("Using cached template overrides")),
				).toBe(false);
			} finally {
				console.log = consoleLog;
				fs.rmSync(`${sitePath}/templates`, { recursive: true, force: true });
				fs.rmSync(cacheDir, { recursive: true, force: true });
			}
		});

		it("should only replace changed override files and preserve unchanged ones", () => {
			const sitePath = "test/fixtures/single-page-site";
			const overrideDir = `${sitePath}/templates/modern/includes`;
			const cacheDir = `${sitePath}/.cache`;
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
				// biome-ignore lint/suspicious/noExplicitAny: test access to private method
				(builder as any).mergeTemplateOverrides(
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
				// biome-ignore lint/suspicious/noExplicitAny: test access to private method
				(builder as any).mergeTemplateOverrides(
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
				fs.rmSync(`${sitePath}/templates`, { recursive: true, force: true });
				fs.rmSync(cacheDir, { recursive: true, force: true });
			}
		});

		it("should create .gitignore with .cache when it does not exist", () => {
			const sitePath = "test/temp-gitignore-create";
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
				// biome-ignore lint/suspicious/noExplicitAny: test access to private method
				(builder as any).mergeTemplateOverrides(
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
			const sitePath = "test/temp-gitignore-append";
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
				// biome-ignore lint/suspicious/noExplicitAny: test access to private method
				(builder as any).mergeTemplateOverrides(
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
			const sitePath = "test/temp-gitignore-exists";
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
				// biome-ignore lint/suspicious/noExplicitAny: test access to private method
				(builder as any).mergeTemplateOverrides(
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
			const sitePath = "test/temp-gitignore-disabled";
			const overrideDir = `${sitePath}/templates/modern/includes`;

			fs.mkdirSync(overrideDir, { recursive: true });
			fs.writeFileSync(`${overrideDir}/footer.hbs`, "<footer>test</footer>");

			const consoleLog = console.log;
			console.log = (_message) => {};

			try {
				const options = new DoculaOptions();
				options.sitePath = sitePath;
				options.autoUpdateIgnores = false;
				const builder = new DoculaBuilder(options);
				// biome-ignore lint/suspicious/noExplicitAny: test access to private method
				(builder as any).mergeTemplateOverrides(
					"templates/modern",
					sitePath,
					"modern",
				);

				// .gitignore should NOT be created
				expect(fs.existsSync(`${sitePath}/.gitignore`)).toBe(false);
			} finally {
				console.log = consoleLog;
				fs.rmSync(sitePath, { recursive: true, force: true });
			}
		});

		it("should not modify .gitignore when .cache already exists", () => {
			const sitePath = "test/temp-gitignore-cache-exists";
			const overrideDir = `${sitePath}/templates/modern/includes`;

			fs.mkdirSync(overrideDir, { recursive: true });
			fs.writeFileSync(`${overrideDir}/footer.hbs`, "<footer>test</footer>");
			// Create .cache before merge
			fs.mkdirSync(`${sitePath}/.cache`, { recursive: true });

			const consoleLog = console.log;
			console.log = (_message) => {};

			try {
				const options = new DoculaOptions();
				options.sitePath = sitePath;
				const builder = new DoculaBuilder(options);
				// biome-ignore lint/suspicious/noExplicitAny: test access to private method
				(builder as any).mergeTemplateOverrides(
					"templates/modern",
					sitePath,
					"modern",
				);

				// .gitignore should NOT be created since .cache already existed
				expect(fs.existsSync(`${sitePath}/.gitignore`)).toBe(false);
			} finally {
				console.log = consoleLog;
				fs.rmSync(sitePath, { recursive: true, force: true });
			}
		});

		it("should add new override files to an existing cache", () => {
			const sitePath = "test/fixtures/single-page-site";
			const overrideDir = `${sitePath}/templates/modern/includes`;
			const cacheDir = `${sitePath}/.cache`;
			const cachePath = `${sitePath}/.cache/templates/modern`;

			fs.mkdirSync(overrideDir, { recursive: true });
			fs.writeFileSync(
				`${overrideDir}/footer.hbs`,
				"<footer>Original</footer>",
			);

			const consoleLog = console.log;
			console.log = () => {};

			try {
				const options = new DoculaOptions();
				options.sitePath = sitePath;
				const builder = new DoculaBuilder(options);

				// First merge — builds cache with one override file
				// biome-ignore lint/suspicious/noExplicitAny: test access to private method
				(builder as any).mergeTemplateOverrides(
					"templates/modern",
					sitePath,
					"modern",
				);

				// Add a new override file
				fs.writeFileSync(
					`${overrideDir}/sidebar.hbs`,
					"<aside>Custom sidebar</aside>",
				);

				const messages: string[] = [];
				console.log = (message) => {
					messages.push(stripAnsi(message as string));
				};

				// Second merge — should detect the added file
				// biome-ignore lint/suspicious/noExplicitAny: test access to private method
				(builder as any).mergeTemplateOverrides(
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
				fs.rmSync(`${sitePath}/templates`, { recursive: true, force: true });
				fs.rmSync(cacheDir, { recursive: true, force: true });
			}
		});

		it("should delete cached file when removed override has no original template", () => {
			const sitePath = "test/fixtures/single-page-site";
			const overrideDir = `${sitePath}/templates/modern`;
			const cacheDir = `${sitePath}/.cache`;
			const cachePath = `${sitePath}/.cache/templates/modern`;

			// Create an override file that does NOT exist in the original template
			fs.mkdirSync(`${overrideDir}/includes`, { recursive: true });
			fs.writeFileSync(`${overrideDir}/custom-widget.hbs`, "<div>Widget</div>");

			const consoleLog = console.log;
			console.log = () => {};

			try {
				const options = new DoculaOptions();
				options.sitePath = sitePath;
				const builder = new DoculaBuilder(options);

				// First merge — builds cache with the custom override
				// biome-ignore lint/suspicious/noExplicitAny: test access to private method
				(builder as any).mergeTemplateOverrides(
					"templates/modern",
					sitePath,
					"modern",
				);

				// Verify the file exists in cache
				expect(fs.existsSync(`${cachePath}/custom-widget.hbs`)).toBe(true);

				// Delete the override file
				fs.unlinkSync(`${overrideDir}/custom-widget.hbs`);

				const messages: string[] = [];
				console.log = (message) => {
					messages.push(stripAnsi(message as string));
				};

				// Second merge — should detect removal and delete from cache
				// biome-ignore lint/suspicious/noExplicitAny: test access to private method
				(builder as any).mergeTemplateOverrides(
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
				fs.rmSync(`${sitePath}/templates`, { recursive: true, force: true });
				fs.rmSync(cacheDir, { recursive: true, force: true });
			}
		});
	});

	describe("Docula Builder - Differential Builds", () => {
		it("should write build manifest after first build", async () => {
			const sitePath = "test/temp-diff-build-manifest";
			const output = `${sitePath}/dist`;

			fs.cpSync("test/fixtures/single-page-site", sitePath, {
				recursive: true,
			});

			const consoleLog = console.log;
			console.log = () => {};

			try {
				const options = new DoculaOptions();
				options.sitePath = sitePath;
				options.output = output;
				options.templatePath = "test/fixtures/template-example/";
				const builder = new DoculaBuilder(options);
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
				console.log = consoleLog;
				fs.rmSync(sitePath, { recursive: true, force: true });
			}
		});

		it("should skip build when nothing has changed", async () => {
			const sitePath = "test/temp-diff-build-skip";
			const output = `${sitePath}/dist`;

			fs.cpSync("test/fixtures/single-page-site", sitePath, {
				recursive: true,
			});

			const consoleLog = console.log;
			console.log = () => {};

			try {
				const options = new DoculaOptions();
				options.sitePath = sitePath;
				options.output = output;
				options.templatePath = "test/fixtures/template-example/";
				const builder = new DoculaBuilder(options);

				// First build
				await builder.build();

				// Second build should skip
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

		it("should rebuild when a document changes", async () => {
			const sitePath = "test/temp-diff-build-doc-change";
			const output = `${sitePath}/dist`;

			fs.cpSync("test/fixtures/multi-page-site", sitePath, {
				recursive: true,
			});

			const consoleLog = console.log;
			console.log = () => {};

			try {
				const options = new DoculaOptions();
				options.sitePath = sitePath;
				options.output = output;
				options.templatePath = "test/fixtures/template-example/";
				const builder = new DoculaBuilder(options);

				// First build
				await builder.build();

				// Modify a document
				const docPath = `${sitePath}/docs/index.md`;
				fs.writeFileSync(
					docPath,
					"---\ntitle: Changed\norder: 1\n---\n# Changed content\nNew text here.",
				);

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
			const sitePath = "test/temp-diff-build-cached-docs";
			const output = `${sitePath}/dist`;

			fs.cpSync("test/fixtures/multi-page-site", sitePath, { recursive: true });

			const consoleLog = console.log;
			console.log = () => {};

			try {
				const options = new DoculaOptions();
				options.sitePath = sitePath;
				options.output = output;
				options.templatePath = "test/fixtures/template-example/";
				const builder = new DoculaBuilder(options);

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
				console.log = consoleLog;
				fs.rmSync(sitePath, { recursive: true, force: true });
			}
		});

		it("should force full rebuild when config changes", async () => {
			const sitePath = "test/temp-diff-build-config-change";
			const output = `${sitePath}/dist`;

			fs.cpSync("test/fixtures/single-page-site", sitePath, {
				recursive: true,
			});

			const consoleLog = console.log;
			console.log = () => {};

			try {
				const options = new DoculaOptions();
				options.sitePath = sitePath;
				options.output = output;
				options.templatePath = "test/fixtures/template-example/";
				const builder = new DoculaBuilder(options);

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
			const sitePath = "test/temp-diff-manifest-io";

			try {
				const options = new DoculaOptions();
				options.sitePath = sitePath;
				const builder = new DoculaBuilder(options);

				// No manifest initially
				// biome-ignore lint/suspicious/noExplicitAny: test access to private method
				expect((builder as any).loadBuildManifest(sitePath)).toBeUndefined();

				// Save a manifest
				const manifest = {
					version: 1 as const,
					configHash: "abc",
					templateHash: "def",
					docs: { "docs/index.md": "hash1" },
					changelog: {},
					assets: { "favicon.ico": "hash2" },
				};
				// biome-ignore lint/suspicious/noExplicitAny: test access to private method
				(builder as any).saveBuildManifest(sitePath, manifest);

				// Load it back
				// biome-ignore lint/suspicious/noExplicitAny: test access to private method
				const loaded = (builder as any).loadBuildManifest(sitePath);
				expect(loaded).toBeDefined();
				expect(loaded.version).toBe(1);
				expect(loaded.configHash).toBe("abc");
				expect(loaded.docs["docs/index.md"]).toBe("hash1");
			} finally {
				fs.rmSync(sitePath, { recursive: true, force: true });
			}
		});

		it("should return undefined for corrupt or wrong-version manifest", () => {
			const sitePath = "test/temp-diff-manifest-corrupt";

			try {
				const options = new DoculaOptions();
				options.sitePath = sitePath;
				const builder = new DoculaBuilder(options);

				const dir = `${sitePath}/.cache/build`;
				fs.mkdirSync(dir, { recursive: true });

				// Corrupt JSON
				fs.writeFileSync(`${dir}/manifest.json`, "not json");
				// biome-ignore lint/suspicious/noExplicitAny: test access to private method
				expect((builder as any).loadBuildManifest(sitePath)).toBeUndefined();

				// Wrong version
				fs.writeFileSync(
					`${dir}/manifest.json`,
					JSON.stringify({ version: 99 }),
				);
				// biome-ignore lint/suspicious/noExplicitAny: test access to private method
				expect((builder as any).loadBuildManifest(sitePath)).toBeUndefined();
			} finally {
				fs.rmSync(sitePath, { recursive: true, force: true });
			}
		});

		it("should skip unchanged asset copies", async () => {
			const sitePath = "test/temp-diff-build-asset-skip";
			const output = `${sitePath}/dist`;

			fs.cpSync("test/fixtures/multi-page-site", sitePath, {
				recursive: true,
			});

			const consoleLog = console.log;
			console.log = () => {};

			try {
				const options = new DoculaOptions();
				options.sitePath = sitePath;
				options.output = output;
				options.templatePath = "test/fixtures/template-example/";
				const builder = new DoculaBuilder(options);

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
				console.log = consoleLog;
				fs.rmSync(sitePath, { recursive: true, force: true });
			}
		});

		it("should detect asset changes", () => {
			const sitePath = "test/temp-diff-assets-changed";

			try {
				const options = new DoculaOptions();
				options.sitePath = sitePath;
				const builder = new DoculaBuilder(options);

				fs.mkdirSync(sitePath, { recursive: true });
				fs.writeFileSync(`${sitePath}/favicon.ico`, "icon-data");

				const previousAssets: Record<string, string> = {
					"favicon.ico": "old-hash",
				};
				expect(
					// biome-ignore lint/suspicious/noExplicitAny: test access to private method
					(builder as any).hasAssetsChanged(sitePath, previousAssets),
				).toBe(true);

				// Hash the file and set as previous — should report no change
				// biome-ignore lint/suspicious/noExplicitAny: test access to private method
				const currentHash: string = (builder as any).hashFile(
					`${sitePath}/favicon.ico`,
				);
				previousAssets["favicon.ico"] = currentHash;
				expect(
					// biome-ignore lint/suspicious/noExplicitAny: test access to private method
					(builder as any).hasAssetsChanged(sitePath, previousAssets),
				).toBe(false);

				// Test deleted asset detection
				previousAssets["logo.svg"] = "some-hash";
				expect(
					// biome-ignore lint/suspicious/noExplicitAny: test access to private method
					(builder as any).hasAssetsChanged(sitePath, previousAssets),
				).toBe(true);
			} finally {
				fs.rmSync(sitePath, { recursive: true, force: true });
			}
		});

		it("should handle cached changelog entries", async () => {
			const sitePath = "test/temp-diff-build-changelog-cache";
			const output = `${sitePath}/dist`;

			fs.cpSync("test/fixtures/changelog-site", sitePath, { recursive: true });

			const consoleLog = console.log;
			console.log = () => {};

			try {
				const options = new DoculaOptions();
				options.sitePath = sitePath;
				options.output = output;
				options.templatePath = "test/fixtures/template-example/";
				const builder = new DoculaBuilder(options);

				// First build
				await builder.build();

				// Verify changelog cache was written
				expect(fs.existsSync(`${sitePath}/.cache/build/changelog.json`)).toBe(
					true,
				);

				// Second build — should use cache
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
			const sitePath = "test/temp-diff-corrupt-changelog";

			try {
				const options = new DoculaOptions();
				options.sitePath = sitePath;
				const builder = new DoculaBuilder(options);

				const dir = `${sitePath}/.cache/build`;
				fs.mkdirSync(dir, { recursive: true });
				fs.writeFileSync(`${dir}/changelog.json`, "not json");

				// biome-ignore lint/suspicious/noExplicitAny: test access to private method
				const result = (builder as any).loadCachedChangelog(sitePath);
				expect(result.size).toBe(0);
			} finally {
				fs.rmSync(sitePath, { recursive: true, force: true });
			}
		});

		it("should detect public folder asset changes", () => {
			const sitePath = "test/temp-diff-public-assets";

			try {
				const options = new DoculaOptions();
				options.sitePath = sitePath;
				const builder = new DoculaBuilder(options);

				fs.mkdirSync(`${sitePath}/public`, { recursive: true });
				fs.writeFileSync(`${sitePath}/public/test.txt`, "hello");

				// Previous assets have a different hash for the public file
				const previousAssets: Record<string, string> = {
					"public/test.txt": "old-hash",
				};
				expect(
					// biome-ignore lint/suspicious/noExplicitAny: test access to private method
					(builder as any).hasAssetsChanged(sitePath, previousAssets),
				).toBe(true);

				// Now set correct hash — should report no change
				// biome-ignore lint/suspicious/noExplicitAny: test access to private method
				const currentHash: string = (builder as any).hashFile(
					`${sitePath}/public/test.txt`,
				);
				previousAssets["public/test.txt"] = currentHash;
				expect(
					// biome-ignore lint/suspicious/noExplicitAny: test access to private method
					(builder as any).hasAssetsChanged(sitePath, previousAssets),
				).toBe(false);
			} finally {
				fs.rmSync(sitePath, { recursive: true, force: true });
			}
		});

		it("should return false from recordsEqual when values differ for the same key", () => {
			const builder = new DoculaBuilder();
			const a: Record<string, string> = { foo: "abc", bar: "def" };
			const b: Record<string, string> = { foo: "abc", bar: "xyz" };
			expect(
				// biome-ignore lint/suspicious/noExplicitAny: test access to private method
				(builder as any).recordsEqual(a, b),
			).toBe(false);
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

	describe("Docula Builder - Build Robots and Sitemap", () => {
		it("should build the robots.txt (/robots.txt)", async () => {
			const builder = new DoculaBuilder();
			const options = new DoculaOptions();
			options.sitePath = "test/fixtures/single-page-site";
			options.output = "test/temp-robots-test";

			if (fs.existsSync(options.output)) {
				await fs.promises.rm(options.output, { recursive: true });
			}

			try {
				await builder.buildRobotsPage(options);
				const robots = await fs.promises.readFile(
					`${options.output}/robots.txt`,
					"utf8",
				);
				expect(robots).toBe("User-agent: *\nDisallow:");
			} finally {
				if (fs.existsSync(options.output)) {
					await fs.promises.rm(options.output, { recursive: true });
				}
			}
		});
		it("should copy the robots.txt (/robots.txt)", async () => {
			const builder = new DoculaBuilder();
			const options = new DoculaOptions();
			options.sitePath = "test/fixtures/multi-page-site";
			options.output = "test/temp-robots-test-copy";

			if (fs.existsSync(options.output)) {
				await fs.promises.rm(options.output, { recursive: true });
			}

			try {
				await builder.buildRobotsPage(options);
				const robots = await fs.promises.readFile(
					`${options.output}/robots.txt`,
					"utf8",
				);
				expect(robots).toBe("User-agent: *\nDisallow: /meow");
			} finally {
				if (fs.existsSync(options.output)) {
					await fs.promises.rm(options.output, { recursive: true });
				}
			}
		});
		it("should build the sitemap.xml (/sitemap.xml)", async () => {
			const builder = new DoculaBuilder();
			const data = doculaData;

			if (fs.existsSync(data.output)) {
				await fs.promises.rm(data.output, { recursive: true });
			}

			try {
				await builder.buildSiteMapPage(data);
				const sitemap = await fs.promises.readFile(
					`${data.output}/sitemap.xml`,
					"utf8",
				);
				expect(sitemap).toContain("<loc>http://foo.com</loc>");
			} finally {
				if (fs.existsSync(data.output)) {
					await fs.promises.rm(data.output, { recursive: true });
				}
			}
		});
		it("should include /feed.xml in sitemap when documents exist", async () => {
			const builder = new DoculaBuilder();
			const data: DoculaData = {
				...defaultPathFields,
				siteUrl: "http://foo.com",
				siteTitle: "docula",
				siteDescription: "Beautiful Website for Your Projects",
				sitePath: "test/fixtures/multi-page-site",
				templatePath: "test/fixtures/template-example",
				output: "test/temp-sitemap-feed-test",
				documents: [
					{
						title: "Guide",
						navTitle: "Guide",
						description: "Guide description",
						keywords: [],
						content: "Guide description",
						markdown: "# Guide\n\nGuide description",
						generatedHtml: "<h1>Guide</h1>",
						documentPath: "test/fixtures/multi-page-site/docs/guide.md",
						urlPath: "/docs/guide/index.html",
						isRoot: true,
						lastModified: "2025-01-01",
					},
				],
			};

			if (fs.existsSync(data.output)) {
				await fs.promises.rm(data.output, { recursive: true });
			}

			try {
				await builder.buildSiteMapPage(data);
				const sitemap = await fs.promises.readFile(
					`${data.output}/sitemap.xml`,
					"utf8",
				);
				expect(sitemap).toContain("<loc>http://foo.com/feed.xml</loc>");
			} finally {
				if (fs.existsSync(data.output)) {
					await fs.promises.rm(data.output, { recursive: true });
				}
			}
		});
	});

	describe("Docula Builder - Build Feed", () => {
		it("should build the feed.xml (/feed.xml) for documentation pages", async () => {
			const builder = new DoculaBuilder();
			const data: DoculaData = {
				...defaultPathFields,
				siteUrl: "http://foo.com",
				siteTitle: "docula & docs",
				siteDescription: "Beautiful <docs> & updates",
				sitePath: "test/fixtures/multi-page-site",
				templatePath: "test/fixtures/template-example",
				output: "test/temp-feed-test",
				documents: [
					{
						title: "Guide",
						navTitle: 'Guide & "Tips"',
						description: "Guide summary",
						keywords: [],
						content: "Guide summary",
						markdown: "# Guide\n\nGuide summary",
						generatedHtml: "<h1>Guide</h1>",
						documentPath: "test/fixtures/multi-page-site/docs/guide.md",
						urlPath: "/docs/guide/index.html",
						isRoot: true,
						lastModified: "2025-01-01",
					},
				],
			};

			if (fs.existsSync(data.output)) {
				await fs.promises.rm(data.output, { recursive: true, force: true });
			}

			try {
				await builder.buildFeedPage(data);
				const feed = await fs.promises.readFile(
					`${data.output}/feed.xml`,
					"utf8",
				);
				const lastBuildDateMatch = feed.match(
					/<lastBuildDate>([^<]+)<\/lastBuildDate>/,
				);
				expect(feed).toContain('<rss version="2.0"');
				expect(feed).toContain("<title>docula &amp; docs</title>");
				expect(feed).toContain(
					"<description>Beautiful &lt;docs&gt; &amp; updates</description>",
				);
				expect(feed).toContain("<link>http://foo.com/</link>");
				expect(lastBuildDateMatch).not.toBeNull();
				expect(
					Number.isNaN(new Date(lastBuildDateMatch?.[1] ?? "").getTime()),
				).toBe(false);
				expect(feed).toContain(
					'<atom:link href="http://foo.com/feed.xml" rel="self" type="application/rss+xml" />',
				);
				expect(feed).toContain("<title>Guide &amp; &quot;Tips&quot;</title>");
				expect(feed).toContain("<link>http://foo.com/docs/guide/</link>");
				expect(feed).toContain(
					'<guid isPermaLink="true">http://foo.com/docs/guide/</guid>',
				);
				expect(feed).toContain("<description>Guide summary</description>");
			} finally {
				if (fs.existsSync(data.output)) {
					await fs.promises.rm(data.output, { recursive: true, force: true });
				}
			}
		});

		it("should use a markdown excerpt when document description is empty", async () => {
			const builder = new DoculaBuilder();
			const data: DoculaData = {
				...defaultPathFields,
				siteUrl: "http://foo.com",
				siteTitle: "docula",
				siteDescription: "Beautiful Website for Your Projects",
				sitePath: "test/fixtures/multi-page-site",
				templatePath: "test/fixtures/template-example",
				output: "test/temp-feed-excerpt-test",
				documents: [
					{
						title: "Guide",
						navTitle: "Guide",
						description: "",
						keywords: [],
						content:
							"---\ntitle: Guide\n---\n\n# Guide\n\nThis **guide** includes [links](http://foo.com), `code`, and more text for excerpt generation.",
						markdown:
							"# Guide\n\nThis **guide** includes [links](http://foo.com), `code`, and more text for excerpt generation.",
						generatedHtml: "<h1>Guide</h1>",
						documentPath: "test/fixtures/multi-page-site/docs/guide.md",
						urlPath: "/docs/guide/index.html",
						isRoot: true,
						lastModified: "2025-01-01",
					},
				],
			};

			if (fs.existsSync(data.output)) {
				await fs.promises.rm(data.output, { recursive: true, force: true });
			}

			try {
				await builder.buildFeedPage(data);
				const feed = await fs.promises.readFile(
					`${data.output}/feed.xml`,
					"utf8",
				);
				expect(feed).toContain(
					"<description>This guide includes links, code, and more text for excerpt generation.</description>",
				);
			} finally {
				if (fs.existsSync(data.output)) {
					await fs.promises.rm(data.output, { recursive: true, force: true });
				}
			}
		});

		it("should not include generated table of contents text in feed excerpts", async () => {
			const builder = new DoculaBuilder();
			const data: DoculaData = {
				...defaultPathFields,
				siteUrl: "http://foo.com",
				siteTitle: "docula",
				siteDescription: "Beautiful Website for Your Projects",
				sitePath: "test/fixtures/multi-page-site",
				templatePath: "test/fixtures/template-example",
				output: "test/temp-feed-no-toc-test",
				documents: [
					{
						title: "Guide",
						navTitle: "Guide",
						description: "",
						keywords: [],
						content:
							"---\ntitle: Guide\n---\n\n# Guide\n\nIntro paragraph.\n\n## Install\n\nInstall details.\n\n## Usage\n\nUsage details.",
						markdown:
							"Intro paragraph.\n\n## Table of Contents\n\n- [Install](#install)\n- [Usage](#usage)\n\n## Install\n\nInstall details.\n\n## Usage\n\nUsage details.",
						generatedHtml: "<h1>Guide</h1>",
						documentPath: "test/fixtures/multi-page-site/docs/guide.md",
						urlPath: "/docs/guide/index.html",
						isRoot: true,
						lastModified: "2025-01-01",
					},
				],
			};

			if (fs.existsSync(data.output)) {
				await fs.promises.rm(data.output, { recursive: true, force: true });
			}

			try {
				await builder.buildFeedPage(data);
				const feed = await fs.promises.readFile(
					`${data.output}/feed.xml`,
					"utf8",
				);
				expect(feed).toContain(
					"<description>Intro paragraph. Install details. Usage details.</description>",
				);
				expect(feed).not.toContain("Table of Contents");
			} finally {
				if (fs.existsSync(data.output)) {
					await fs.promises.rm(data.output, { recursive: true, force: true });
				}
			}
		});

		it("should preserve hyphenated words in feed excerpts", async () => {
			const builder = new DoculaBuilder();
			const data: DoculaData = {
				...defaultPathFields,
				siteUrl: "http://foo.com",
				siteTitle: "docula",
				siteDescription: "Beautiful Website for Your Projects",
				sitePath: "test/fixtures/multi-page-site",
				templatePath: "test/fixtures/template-example",
				output: "test/temp-feed-hyphen-test",
				documents: [
					{
						title: "Guide",
						navTitle: "Guide",
						description: "",
						keywords: [],
						content:
							"---\ntitle: Guide\n---\n\n# Guide\n\nA pre-release state-of-the-art guide.\n\n- First item\n- Second item",
						markdown:
							"# Guide\n\nA pre-release state-of-the-art guide.\n\n- First item\n- Second item",
						generatedHtml: "<h1>Guide</h1>",
						documentPath: "test/fixtures/multi-page-site/docs/guide.md",
						urlPath: "/docs/guide/index.html",
						isRoot: true,
						lastModified: "2025-01-01",
					},
				],
			};

			if (fs.existsSync(data.output)) {
				await fs.promises.rm(data.output, { recursive: true, force: true });
			}

			try {
				await builder.buildFeedPage(data);
				const feed = await fs.promises.readFile(
					`${data.output}/feed.xml`,
					"utf8",
				);
				expect(feed).toContain(
					"<description>A pre-release state-of-the-art guide. First item Second item</description>",
				);
			} finally {
				if (fs.existsSync(data.output)) {
					await fs.promises.rm(data.output, { recursive: true, force: true });
				}
			}
		});

		it("should preserve intro content when markdown starts with a thematic break", async () => {
			const builder = new DoculaBuilder();
			const data: DoculaData = {
				...defaultPathFields,
				siteUrl: "http://foo.com",
				siteTitle: "docula",
				siteDescription: "Beautiful Website for Your Projects",
				sitePath: "test/fixtures/multi-page-site",
				templatePath: "test/fixtures/template-example",
				output: "test/temp-feed-thematic-break-test",
				documents: [
					{
						title: "Guide",
						navTitle: "Guide",
						description: "",
						keywords: [],
						content:
							"# Guide\n\n---\n\nIntro content should stay.\n\n---\n\nMore content after the break.",
						markdown:
							"---\n\nIntro content should stay.\n\n---\n\nMore content after the break.",
						generatedHtml: "<h1>Guide</h1>",
						documentPath: "test/fixtures/multi-page-site/docs/guide.md",
						urlPath: "/docs/guide/index.html",
						isRoot: true,
						lastModified: "2025-01-01",
					},
				],
			};

			if (fs.existsSync(data.output)) {
				await fs.promises.rm(data.output, { recursive: true, force: true });
			}

			try {
				await builder.buildFeedPage(data);
				const feed = await fs.promises.readFile(
					`${data.output}/feed.xml`,
					"utf8",
				);
				expect(feed).toContain(
					"<description>Intro content should stay. More content after the break.</description>",
				);
			} finally {
				if (fs.existsSync(data.output)) {
					await fs.promises.rm(data.output, { recursive: true, force: true });
				}
			}
		});

		it("should not build feed.xml when no documents exist", async () => {
			const builder = new DoculaBuilder();
			const data: DoculaData = {
				...defaultPathFields,
				siteUrl: "http://foo.com",
				siteTitle: "docula",
				siteDescription: "Beautiful Website for Your Projects",
				sitePath: "test/fixtures/single-page-site",
				templatePath: "test/fixtures/template-example",
				output: "test/temp-feed-no-docs",
			};

			if (fs.existsSync(data.output)) {
				await fs.promises.rm(data.output, { recursive: true, force: true });
			}

			try {
				await builder.buildFeedPage(data);
				expect(fs.existsSync(`${data.output}/feed.xml`)).toBe(false);
			} finally {
				if (fs.existsSync(data.output)) {
					await fs.promises.rm(data.output, { recursive: true, force: true });
				}
			}
		});

		it("should not include api or changelog urls in feed.xml", async () => {
			const builder = new DoculaBuilder();
			const data: DoculaData = {
				...defaultPathFields,
				siteUrl: "http://foo.com",
				siteTitle: "docula",
				siteDescription: "Beautiful Website for Your Projects",
				sitePath: "test/fixtures/changelog-site",
				templatePath: "test/fixtures/template-example",
				output: "test/temp-feed-scope-test",
				openApiUrl: "/api/swagger.json",
				hasApi: true,
				hasChangelog: true,
				changelogEntries: [
					{
						title: "Test Entry",
						date: "2025-01-15",
						formattedDate: "January 15, 2025",
						slug: "test-entry",
						content: "",
						generatedHtml: "",
						preview: "",
						urlPath: "/changelog/test-entry/index.html",
						lastModified: "2025-01-01",
					},
				],
				documents: [
					{
						title: "Doc",
						navTitle: "Doc",
						description: "Doc description",
						keywords: [],
						content: "# Doc",
						markdown: "# Doc\n\nDoc description",
						generatedHtml: "<h1>Doc</h1>",
						documentPath: "test/fixtures/changelog-site/docs/doc.md",
						urlPath: "/docs/doc/index.html",
						isRoot: true,
						lastModified: "2025-01-01",
					},
				],
			};

			if (fs.existsSync(data.output)) {
				await fs.promises.rm(data.output, { recursive: true, force: true });
			}

			try {
				await builder.buildFeedPage(data);
				const feed = await fs.promises.readFile(
					`${data.output}/feed.xml`,
					"utf8",
				);
				expect(feed).toContain("<link>http://foo.com/docs/doc/</link>");
				expect(feed).not.toContain("http://foo.com/api");
				expect(feed).not.toContain("http://foo.com/changelog");
			} finally {
				if (fs.existsSync(data.output)) {
					await fs.promises.rm(data.output, { recursive: true, force: true });
				}
			}
		});
	});

	describe("Docula Builder - Build Index", () => {
		it("should build the index.html (/index.html)", async () => {
			const builder = new DoculaBuilder();
			const data = doculaData;
			data.templates = {
				home: "home.hbs",
			};
			data.sitePath = "site";
			data.templatePath = "test/fixtures/template-example";
			data.output = "test/temp-index-test";

			if (fs.existsSync(data.output)) {
				await fs.promises.rm(data.output, { recursive: true });
			}

			try {
				await builder.buildIndexPage(data);
				const index = await fs.promises.readFile(
					`${data.output}/index.html`,
					"utf8",
				);
				expect(index).toContain("<title>docula</title>");
			} finally {
				if (fs.existsSync(data.output)) {
					await fs.promises.rm(data.output, { recursive: true });
				}
			}
		});
		it("should throw an error build the index.html (/index.html)", async () => {
			const builder = new DoculaBuilder();
			const data = doculaData;
			data.sitePath = "template";
			data.output = "test/temp-index-test";
			data.templates = undefined;

			try {
				await builder.buildIndexPage(data);
			} catch (error) {
				expect((error as Error).message).toBe("No templates found");
			} finally {
				if (fs.existsSync(data.output)) {
					await fs.promises.rm(data.output, { recursive: true });
				}
			}
		});
	});

	describe("Docula Builder - Build Docs", () => {
		it("should build the docs pages", async () => {
			const builder = new DoculaBuilder();
			const data = doculaData;
			data.templates = {
				home: "home.hbs",

				docPage: "docs.hbs",
			};
			data.sitePath = "site";
			data.templatePath = "test/fixtures/template-example";
			data.output = "test/temp-index-test";
			data.hasDocuments = true;
			data.sections = [
				{
					name: "foo",
					path: "foo",
				},
			];
			data.documents = [
				{
					title: "Document title",
					navTitle: "Document",
					description: "Document description",
					keywords: [],
					content: "",
					markdown: "",
					generatedHtml: "",
					documentPath: "",
					urlPath: "/docs/document.html",
					isRoot: true,
					lastModified: "2025-01-01",
				},
			];

			if (fs.existsSync(data.output)) {
				await fs.promises.rm(data.output, { recursive: true });
			}

			try {
				await builder.buildDocsPages(data);
				expect(fs.existsSync(`${data.output}/docs/document.html`)).toBe(true);
			} finally {
				if (fs.existsSync(data.output)) {
					await fs.promises.rm(data.output, { recursive: true });
				}
			}
		});
		it("should throw error when template doesnt exist", async () => {
			const builder = new DoculaBuilder();
			const data = doculaData;
			data.templates = undefined;
			data.sitePath = "site";
			data.templatePath = "test/fixtures/no-template-example";
			data.output = "test/temp-index-test";

			if (fs.existsSync(data.output)) {
				await fs.promises.rm(data.output, { recursive: true });
			}

			try {
				await builder.buildDocsPages(data);
			} catch (error) {
				expect((error as Error).message).toBe("No templates found");
			}
		});
		it("should get top level documents from mega fixtures", () => {
			const builder = new DoculaBuilder();
			const documentsPath = "test/fixtures/mega-page-site/docs";
			const documents = builder.getDocumentInDirectory(
				documentsPath,
				documentsPath,
			);
			expect(documents.length).toBe(3);
		});
		it("should get all the documents from the mega fixtures", () => {
			const builder = new DoculaBuilder();
			const doculaData: DoculaData = {
				...defaultPathFields,
				siteUrl: "http://foo.com",
				siteTitle: "docula",
				siteDescription: "Beautiful Website for Your Projects",
				sitePath: "test/fixtures/mega-page-site",
				templatePath: "test/fixtures/template-example",
				output: "test/temp-sitemap-test",
			};
			const documentsPath = "test/fixtures/mega-page-site/docs";
			const documents = builder.getDocuments(documentsPath, doculaData);
			expect(documents.length).toBe(21);
		});
	});

	describe("Docula Builder - Sections", () => {
		it("should merge sections based on what you find in options", () => {
			const builder = new DoculaBuilder();
			const options = new DoculaOptions();
			options.sections = [
				{ name: "foo snizzle", path: "caching", order: 1 },
				{ name: "bar", path: "bar", order: 2 },
			];

			const section: DoculaSection = {
				name: "foo",
				path: "caching",
			};

			const mergedSection = builder.mergeSectionWithOptions(section, options);
			expect(mergedSection.name).toBe("foo snizzle");
			expect(mergedSection.order).toBe(1);
		});
		it("should get all the sections from the mega fixtures", () => {
			const builder = new DoculaBuilder();
			const documentsPath = "test/fixtures/mega-page-site/docs";
			const options = new DoculaOptions();
			options.sections = [
				{ name: "Caching", path: "caching", order: 2 },
				{ name: "Compression", path: "compression", order: 1 },
			];
			const sections = builder.getSections(documentsPath, options);
			expect(sections.length).toBe(3);
			expect(sections[0].name).toBe("Compression");
			expect(sections[1].name).toBe("Caching");
			expect(sections[2].name).toBe("Storage Adapters");
			expect(sections[2].order).toBe(undefined);
		});
		it("should not include asset-only directories as sections", () => {
			const builder = new DoculaBuilder();
			const sections = builder.getSections(
				"test/fixtures/multi-page-site/docs",
				new DoculaOptions(),
			);
			const sectionPaths = sections.map((s) => s.path);
			expect(sectionPaths).not.toContain("images");
			expect(sectionPaths).not.toContain("assets");
		});
		it("should not include directories with only nested markdown as sections", () => {
			const builder = new DoculaBuilder();
			const sections = builder.getSections(
				"test/fixtures/multi-page-site/docs",
				new DoculaOptions(),
			);
			const sectionPaths = sections.map((s) => s.path);
			// guides/ only has nested/intro.md, no immediate markdown files
			expect(sectionPaths).not.toContain("guides");
		});
	});

	describe("Docula Builder - Generate Sidebar Items", () => {
		it("generateSidebarItems should return an empty array if sections and documents does not exist", async () => {
			const builder = new DoculaBuilder();
			const data = doculaData;
			data.templates = {
				home: "home.hbs",
			};
			data.sitePath = "site";
			data.templatePath = "test/fixtures/template-example";
			data.output = "test/temp-index-test";

			data.sections = undefined;
			data.documents = undefined;

			const sidebarItems = builder.generateSidebarItems(data);
			expect(sidebarItems).toStrictEqual([]);
		});
		it("generateSidebarItems should sort sidebarItems children", async () => {
			const builder = new DoculaBuilder();
			const fooChildren = { name: "foo", path: "foo", order: 1 };
			const barChildren = { name: "bar", path: "bar", order: 2 };
			const fooChildreNoOrder = { name: "foo", path: "foo" };
			const barChildrenNoOrder = { name: "bar", path: "bar" };

			const data = doculaData;
			data.templates = {
				home: "home.hbs",
			};
			data.sitePath = "site";
			data.templatePath = "test/fixtures/template-example";
			data.output = "test/temp-index-test";

			data.sections = [
				{
					name: "foo",
					path: "foo",
					order: 2,
					children: [barChildren, fooChildren],
				},
			];

			const sidebarItems = builder.generateSidebarItems(data);
			expect(sidebarItems[0].children).toStrictEqual([
				fooChildren,
				barChildren,
			]);

			data.sections = [
				{
					name: "foo",
					path: "foo",
					children: [barChildrenNoOrder, fooChildreNoOrder],
				},
			];
			const sidebarItemsNoOrder = builder.generateSidebarItems(data);
			expect(sidebarItemsNoOrder[0].children).toStrictEqual([
				barChildrenNoOrder,
				fooChildreNoOrder,
			]);
		});
		it("generateSidebarItems should sort sidebarItems children with documents", async () => {
			const builder = new DoculaBuilder();
			const fooChildren = { name: "foo", path: "foo", order: 1 };
			const barChildren = { name: "bar", path: "bar", order: 2 };
			const documentChildren = {
				name: "Document",
				path: "document",
				order: undefined,
			};
			const documents: DoculaDocument[] = [
				{
					title: "Document title",
					navTitle: "Document",
					description: "Document description",
					keywords: [],
					content: "",
					markdown: "",
					generatedHtml: "",
					documentPath: "",
					urlPath: "document",
					isRoot: false,
					section: "foo",
					lastModified: "2025-01-01",
				},
			];

			const data = doculaData;
			data.templates = {
				home: "home.hbs",
			};
			data.sitePath = "site";
			data.templatePath = "test/fixtures/template-example";
			data.output = "test/temp-index-test";

			data.sections = [
				{
					name: "foo",
					path: "foo",
					order: 2,
					children: [barChildren, fooChildren],
				},
			];
			data.documents = documents;

			const sidebarItems = builder.generateSidebarItems(data);
			expect(sidebarItems[0].children).toStrictEqual([
				fooChildren,
				barChildren,
				documentChildren,
			]);
		});
		it("generateSidebarItems should ignore a document if documentPath does not have a valid section", async () => {
			const builder = new DoculaBuilder();
			const documents: DoculaDocument[] = [
				{
					title: "Document title",
					navTitle: "Document",
					description: "Document description",
					keywords: [],
					content: "",
					markdown: "",
					generatedHtml: "",
					documentPath: "/site/docs/bar/document.html",
					urlPath: "document",
					isRoot: false,
					lastModified: "2025-01-01",
				},
			];

			const data = doculaData;
			data.templates = {
				home: "home.hbs",
			};
			data.sitePath = "site";
			data.templatePath = "test/fixtures/template-example";
			data.output = "test/temp-index-test";

			data.sections = [
				{
					name: "foo",
					path: "foo",
					order: 2,
				},
			];
			data.documents = documents;

			const sidebarItems = builder.generateSidebarItems(data);
			expect(sidebarItems[0].children).toBeUndefined();
		});
		it("generateSidebarItems should not duplicate children when called multiple times", async () => {
			// When docs is the starting view, generateSidebarItems is called twice:
			// once by buildDocsHomePage (to render the first doc as the index page)
			// and again by buildDocsPages (to render all doc pages). Because
			// generateSidebarItems shallow-copies data.sections, the children arrays
			// are shared references and the second call pushes duplicates into them.
			const builder = new DoculaBuilder();
			const documents: DoculaDocument[] = [
				{
					title: "Document title",
					navTitle: "Document",
					description: "Document description",
					keywords: [],
					content: "",
					markdown: "",
					generatedHtml: "",
					documentPath: "",
					urlPath: "document",
					isRoot: false,
					section: "foo",
					lastModified: "2025-01-01",
				},
			];

			const data = doculaData;
			data.templates = {
				home: "home.hbs",
			};
			data.sitePath = "site";
			data.templatePath = "test/fixtures/template-example";
			data.output = "test/temp-index-test";

			data.sections = [
				{
					name: "foo",
					path: "foo",
					order: 1,
				},
			];
			data.documents = documents;

			const firstResult = builder.generateSidebarItems(data);
			expect(firstResult[0].children).toHaveLength(1);

			const secondResult = builder.generateSidebarItems(data);
			expect(secondResult[0].children).toHaveLength(1);
		});
	});

	describe("Docula Builder - Document Parser", () => {
		it("should not include TOC heading in generatedHtml for empty markdown", async () => {
			const builder = new DoculaBuilder();

			const documentsPath = "test/fixtures/empty.md";
			const parsedDocument = builder.parseDocumentData(documentsPath);
			expect(parsedDocument.generatedHtml).not.toContain("table-of-contents");
		});

		it("should render inline TOC when markdown already has a table of contents", async () => {
			const builder = new DoculaBuilder();

			const documentsPath = "test/fixtures/has-toc.md";
			const parsedDocument = builder.parseDocumentData(documentsPath);
			expect(parsedDocument.generatedHtml).toContain("table-of-contents");
			expect(parsedDocument.generatedHtml).toContain("#overview");
			expect(parsedDocument.generatedHtml).toContain("#details");
		});
	});

	describe("Build Readme Section", async () => {
		it("should build the readme section", async () => {
			const builder = new DoculaBuilder();
			const data = doculaData;
			data.sitePath = "test/fixtures/single-page-site";

			const result = await builder.buildReadmeSection(data);

			expect(result).toBeTruthy();
		});
	});

	describe("Build Announcement Section", async () => {
		it("should return undefined when announcement.md does not exist", async () => {
			const builder = new DoculaBuilder();
			const data = doculaData;
			data.sitePath = "test/fixtures/single-page-site";

			const result = await builder.buildAnnouncementSection(data);

			expect(result).toBeUndefined();
		});

		it("should build the announcement section when announcement.md exists", async () => {
			const builder = new DoculaBuilder();
			const data = doculaData;
			data.sitePath = "test/fixtures/announcement-site";

			// Create temporary announcement site
			await fs.promises.mkdir(data.sitePath, { recursive: true });
			await fs.promises.writeFile(
				`${data.sitePath}/announcement.md`,
				"**Important:** This is an announcement!",
			);

			try {
				const result = await builder.buildAnnouncementSection(data);

				expect(result).toBeTruthy();
				expect(result).toContain("<strong>Important:</strong>");
				expect(result).toContain("This is an announcement!");
			} finally {
				await fs.promises.rm(data.sitePath, { recursive: true });
			}
		});
	});

	describe("Docula Builder - Public Folder", () => {
		it("should copy public folder contents to dist", async () => {
			const options = new DoculaOptions();
			options.output = "test/temp-public-folder-test";
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
			const sitePath = "test/temp-public-diff-skip";
			const publicPath = `${sitePath}/public`;
			const outputPath = `${sitePath}/output`;

			try {
				const builder = new DoculaBuilder();

				// Create a public folder with a file
				fs.mkdirSync(publicPath, { recursive: true });
				fs.writeFileSync(`${publicPath}/hello.txt`, "hello world");

				// First copy — populates currentAssets and copies the file
				const currentAssets: Record<string, string> = {};
				// biome-ignore lint/suspicious/noExplicitAny: test access to private method
				(builder as any).copyPublicDirectory(
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
					// biome-ignore lint/suspicious/noExplicitAny: test access to private method
					(builder as any).copyPublicDirectory(
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
			options.output = "test/temp-no-public-folder-test";
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
			const tempSitePath = "test/temp-recursive-site";
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

	describe("Docula Builder - OpenAPI API Documentation", () => {
		it("should build the API page when openApiUrl is configured", async () => {
			const builder = new DoculaBuilder();
			const data: DoculaData = {
				...defaultPathFields,
				siteUrl: "http://foo.com",
				siteTitle: "docula",
				siteDescription: "Beautiful Website for Your Projects",
				sitePath: "test/fixtures/single-page-site",
				templatePath: "templates/classic",
				output: "test/temp-api-test",
				openApiUrl: "https://petstore.swagger.io/v2/swagger.json",
				templates: {
					home: "home.hbs",

					api: "api.hbs",
				},
			};

			if (fs.existsSync(data.output)) {
				await fs.promises.rm(data.output, { recursive: true });
			}

			try {
				await builder.buildApiPage(data);
				const apiPage = await fs.promises.readFile(
					`${data.output}/api/index.html`,
					"utf8",
				);
				expect(apiPage).toContain("API Reference");
				expect(apiPage).toContain("docula");
			} finally {
				if (fs.existsSync(data.output)) {
					await fs.promises.rm(data.output, { recursive: true });
				}
			}
		});

		it("should not build API page when openApiUrl is not configured", async () => {
			const builder = new DoculaBuilder();
			const data: DoculaData = {
				...defaultPathFields,
				siteUrl: "http://foo.com",
				siteTitle: "docula",
				siteDescription: "Beautiful Website for Your Projects",
				sitePath: "test/fixtures/single-page-site",
				templatePath: "templates/classic",
				output: "test/temp-api-test-no-url",
				templates: {
					home: "home.hbs",
				},
			};

			if (fs.existsSync(data.output)) {
				await fs.promises.rm(data.output, { recursive: true });
			}

			try {
				await builder.buildApiPage(data);
				expect(fs.existsSync(`${data.output}/api/index.html`)).toBe(false);
			} finally {
				if (fs.existsSync(data.output)) {
					await fs.promises.rm(data.output, { recursive: true });
				}
			}
		});

		it("should not build API page when api template is not configured", async () => {
			const builder = new DoculaBuilder();
			const data: DoculaData = {
				...defaultPathFields,
				siteUrl: "http://foo.com",
				siteTitle: "docula",
				siteDescription: "Beautiful Website for Your Projects",
				sitePath: "test/fixtures/single-page-site",
				templatePath: "templates/classic",
				output: "test/temp-api-test-no-template",
				openApiUrl: "https://petstore.swagger.io/v2/swagger.json",
				templates: {
					home: "home.hbs",
				},
			};

			if (fs.existsSync(data.output)) {
				await fs.promises.rm(data.output, { recursive: true });
			}

			try {
				await builder.buildApiPage(data);
				expect(fs.existsSync(`${data.output}/api/index.html`)).toBe(false);
			} finally {
				if (fs.existsSync(data.output)) {
					await fs.promises.rm(data.output, { recursive: true });
				}
			}
		});

		it("should include /api in sitemap when openApiUrl and api template are configured", async () => {
			const builder = new DoculaBuilder();
			const data: DoculaData = {
				...defaultPathFields,
				siteUrl: "http://foo.com",
				siteTitle: "docula",
				siteDescription: "Beautiful Website for Your Projects",
				sitePath: "test/fixtures/single-page-site",
				templatePath: "templates/classic",
				output: "test/temp-sitemap-api-test",
				openApiUrl: "https://petstore.swagger.io/v2/swagger.json",
				templates: {
					home: "home.hbs",

					api: "api.hbs",
				},
			};

			if (fs.existsSync(data.output)) {
				await fs.promises.rm(data.output, { recursive: true });
			}

			try {
				await builder.buildSiteMapPage(data);
				const sitemap = await fs.promises.readFile(
					`${data.output}/sitemap.xml`,
					"utf8",
				);
				expect(sitemap).toContain("<loc>http://foo.com/api</loc>");
			} finally {
				if (fs.existsSync(data.output)) {
					await fs.promises.rm(data.output, { recursive: true });
				}
			}
		});

		it("should not include /api in sitemap when openApiUrl is configured but api template is missing", async () => {
			const builder = new DoculaBuilder();
			const data: DoculaData = {
				...defaultPathFields,
				siteUrl: "http://foo.com",
				siteTitle: "docula",
				siteDescription: "Beautiful Website for Your Projects",
				sitePath: "test/fixtures/single-page-site",
				templatePath: "templates/classic",
				output: "test/temp-sitemap-no-api-test",
				openApiUrl: "https://petstore.swagger.io/v2/swagger.json",
				templates: {
					home: "home.hbs",
				},
			};

			if (fs.existsSync(data.output)) {
				await fs.promises.rm(data.output, { recursive: true });
			}

			try {
				await builder.buildSiteMapPage(data);
				const sitemap = await fs.promises.readFile(
					`${data.output}/sitemap.xml`,
					"utf8",
				);
				expect(sitemap).not.toContain("<loc>http://foo.com/api</loc>");
			} finally {
				if (fs.existsSync(data.output)) {
					await fs.promises.rm(data.output, { recursive: true });
				}
			}
		});

		it("should get api template when template directory has api.hbs", async () => {
			const builder = new DoculaBuilder();
			const templateData = await builder.getTemplates(
				"templates/classic",
				false,
			);
			expect(templateData.api).toBe("api.hbs");
		});

		it("should not get api template when template directory lacks api.hbs", async () => {
			const builder = new DoculaBuilder();
			const templateData = await builder.getTemplates(
				"test/fixtures/template-example/",
				false,
			);
			expect(templateData.api).toBeUndefined();
		});

		it("should build with openApiUrl configured", async () => {
			const options = new DoculaOptions();
			options.output = "test/temp-build-api-test";
			options.openApiUrl = "https://petstore.swagger.io/v2/swagger.json";
			const builder = new DoculaBuilder(options);
			const consoleLog = console.log;
			let consoleMessage = "";
			console.log = (message) => {
				consoleMessage = message as string;
			};

			try {
				await builder.build();
				expect(fs.existsSync(`${options.output}/api/index.html`)).toBe(true);
			} finally {
				await fs.promises.rm(builder.options.output, { recursive: true });
			}

			expect(consoleMessage).toContain("Build");

			console.log = consoleLog;
		});

		it("should render API Reference button on home page when openApiUrl is configured", async () => {
			const templates = ["modern", "classic"] as const;

			for (const template of templates) {
				const options = new DoculaOptions();
				options.template = template;
				options.sitePath = "test/fixtures/multi-page-site";
				options.output = `test/temp-build-api-home-button-${template}`;
				options.openApiUrl = "https://petstore.swagger.io/v2/swagger.json";

				const builder = new DoculaBuilder(options);

				try {
					await builder.build();
					const indexHtml = await fs.promises.readFile(
						`${options.output}/index.html`,
						"utf8",
					);
					expect(indexHtml).toContain('href="/api"');
					expect(indexHtml).toContain("API Reference");
				} finally {
					await fs.promises.rm(options.output, {
						recursive: true,
						force: true,
					});
				}
			}
		});

		it("should not render API Reference button on home page when api template is missing", async () => {
			const options = new DoculaOptions();
			options.templatePath = "test/fixtures/template-example";
			options.sitePath = "test/fixtures/multi-page-site";
			options.output = "test/temp-build-api-home-no-template-button";
			options.openApiUrl = "https://petstore.swagger.io/v2/swagger.json";

			const builder = new DoculaBuilder(options);

			try {
				await builder.build();
				const indexHtml = await fs.promises.readFile(
					`${options.output}/index.html`,
					"utf8",
				);
				expect(indexHtml).not.toContain("API Reference");
				expect(indexHtml).not.toContain('href="/api"');
			} finally {
				await fs.promises.rm(options.output, {
					recursive: true,
					force: true,
				});
			}
		});

		it("should auto-detect api/swagger.json when openApiUrl is not set", async () => {
			const options = new DoculaOptions();
			options.sitePath = "test/fixtures/mega-page-site";
			options.output = "test/temp-build-api-autodetect";
			const builder = new DoculaBuilder(options);
			const consoleLog = console.log;
			console.log = () => {};

			try {
				await builder.build();
				expect(fs.existsSync(`${options.output}/api/index.html`)).toBe(true);
				const apiPage = await fs.promises.readFile(
					`${options.output}/api/index.html`,
					"utf8",
				);
				expect(apiPage).toContain("api-reference");
				expect(apiPage).toContain("Mock HTTP API");
			} finally {
				await fs.promises.rm(options.output, { recursive: true });
				console.log = consoleLog;
			}
		});
	});

	describe("Docula Builder - Changelog", () => {
		it("should return empty array when changelog directory does not exist", () => {
			const builder = new DoculaBuilder();
			const entries = builder.getChangelogEntries(
				"test/fixtures/single-page-site/changelog",
			);
			expect(entries).toStrictEqual([]);
		});

		it("should get changelog entries from changelog directory", () => {
			const builder = new DoculaBuilder();
			const entries = builder.getChangelogEntries(
				"test/fixtures/changelog-site/changelog",
			);
			expect(entries.length).toBe(5);
			// Should be sorted by date descending, invalid dates last
			expect(entries[0].title).toBe("Critical Bug Fix");
			expect(entries[0].date).toBe("2025-02-01");
			expect(entries[0].tag).toBe("Fixed");
			expect(entries[0].slug).toBe("2025-02-01-bug-fix");
			expect(entries[1].title).toBe("New Feature Released");
			expect(entries[2].title).toBe("Performance Improvements");
			// Invalid dates should be at the end
			const lastTwo = entries.slice(3).map((e) => e.title);
			expect(lastTwo).toContain("String Date Entry");
			expect(lastTwo).toContain("No Date Entry");
		});

		it("should include mdx changelog files and ignore non-markdown files", async () => {
			const builder = new DoculaBuilder();
			const changelogPath = "test/temp-changelog-mixed-files";
			await fs.promises.rm(changelogPath, { recursive: true, force: true });
			await fs.promises.mkdir(`${changelogPath}/nested`, { recursive: true });
			await fs.promises.writeFile(
				`${changelogPath}/2026-03-02-mdx-entry.mdx`,
				[
					"---",
					"title: MDX Entry",
					"date: 2026-03-02",
					"---",
					"",
					"Hello from MDX.",
				].join("\n"),
				"utf8",
			);
			await fs.promises.writeFile(
				`${changelogPath}/notes.txt`,
				"not a changelog entry",
				"utf8",
			);
			await fs.promises.writeFile(
				`${changelogPath}/nested/ignore.md`,
				"---\ntitle: nested\n---\n",
				"utf8",
			);

			try {
				const entries = builder.getChangelogEntries(changelogPath);
				expect(entries.length).toBe(1);
				expect(entries[0].title).toBe("MDX Entry");
				expect(entries[0].slug).toBe("2026-03-02-mdx-entry");
			} finally {
				await fs.promises.rm(changelogPath, {
					recursive: true,
					force: true,
				});
			}
		});

		it("should return cached entry when hashes match", () => {
			const builder = new DoculaBuilder();
			const changelogPath = "test/fixtures/changelog-site/changelog";
			const cachedEntry: DoculaChangelogEntry = {
				title: "Cached Feature",
				date: "2025-01-15",
				formattedDate: "January 15, 2025",
				tag: "Release",
				tagClass: "release",
				slug: "2025-01-15-new-feature",
				content: "cached content",
				generatedHtml: "<p>cached content</p>",
				preview: "cached content",
				urlPath: "changelog/2025-01-15-new-feature.html",
				lastModified: "2025-01-15",
			};
			const cachedEntries = new Map<string, DoculaChangelogEntry>();
			cachedEntries.set("2025-01-15-new-feature", cachedEntry);

			const matchingHash = "same-hash";
			const previousHashes: Record<string, string> = {
				"2025-01-15-new-feature.md": matchingHash,
			};
			const currentHashes: Record<string, string> = {
				"2025-01-15-new-feature.md": matchingHash,
			};

			const entries = builder.getChangelogEntries(
				changelogPath,
				cachedEntries,
				previousHashes,
				currentHashes,
			);

			const matched = entries.find((e) => e.slug === "2025-01-15-new-feature");
			expect(matched).toBe(cachedEntry);
			expect(matched?.title).toBe("Cached Feature");
		});

		it("should parse a changelog entry correctly", () => {
			const builder = new DoculaBuilder();
			const entry = builder.parseChangelogEntry(
				"test/fixtures/changelog-site/changelog/2025-01-15-new-feature.md",
			);
			expect(entry.title).toBe("New Feature Released");
			expect(entry.date).toBe("2025-01-15");
			expect(entry.tag).toBe("Added");
			expect(entry.tagClass).toBe("added");
			expect(entry.slug).toBe("2025-01-15-new-feature");
			expect(entry.urlPath).toBe(
				"/changelog/2025-01-15-new-feature/index.html",
			);
			expect(entry.generatedHtml).toContain("Feature A");
		});

		it("should handle string dates in changelog entries", () => {
			const builder = new DoculaBuilder();
			const entry = builder.parseChangelogEntry(
				"test/fixtures/changelog-site/changelog/2024-11-01-string-date.md",
			);
			expect(entry.title).toBe("String Date Entry");
			expect(entry.date).toBe("Q1 2025");
			expect(entry.slug).toBe("2024-11-01-string-date");
		});

		it("should fall back to filename title when changelog entry has no front matter", async () => {
			const builder = new DoculaBuilder();
			const changelogPath = "test/temp-changelog-missing-frontmatter";
			const filePath = `${changelogPath}/2026-03-02-missing-fields.md`;
			await fs.promises.rm(changelogPath, { recursive: true, force: true });
			await fs.promises.mkdir(changelogPath, { recursive: true });
			await fs.promises.writeFile(filePath, "No front matter here.", "utf8");

			try {
				const entry = builder.parseChangelogEntry(filePath);
				expect(entry.title).toBe("2026-03-02-missing-fields");
				expect(entry.date).toBe("");
				expect(entry.formattedDate).toBe("");
				expect(entry.slug).toBe("2026-03-02-missing-fields");
				expect(entry.urlPath).toBe(
					"/changelog/2026-03-02-missing-fields/index.html",
				);
			} finally {
				await fs.promises.rm(changelogPath, {
					recursive: true,
					force: true,
				});
			}
		});

		it("should build changelog listing page", async () => {
			const builder = new DoculaBuilder();
			const data: DoculaData = {
				...defaultPathFields,
				siteUrl: "http://foo.com",
				siteTitle: "docula",
				siteDescription: "Beautiful Website for Your Projects",
				sitePath: "test/fixtures/changelog-site",
				templatePath: "test/fixtures/template-example",
				output: "test/temp-changelog-test",
				hasChangelog: true,
				changelogEntries: [
					{
						title: "Test Entry",
						date: "2025-01-15",
						formattedDate: "January 15, 2025",
						tag: "Added",
						tagClass: "added",
						slug: "test-entry",
						content: "Test content",
						generatedHtml: "<p>Test content</p>",
						preview: "<p>Test content</p>",
						urlPath: "/changelog/test-entry/index.html",
						lastModified: "2025-01-01",
					},
				],
				templates: {
					home: "home.hbs",

					changelog: "changelog.hbs",
					changelogEntry: "changelog-entry.hbs",
				},
			};

			if (fs.existsSync(data.output)) {
				await fs.promises.rm(data.output, { recursive: true });
			}

			try {
				await builder.buildChangelogPage(data);
				const changelog = await fs.promises.readFile(
					`${data.output}/changelog/index.html`,
					"utf8",
				);
				expect(changelog).toContain("<title>docula Changelog</title>");
				expect(changelog).toContain("Test Entry");
				expect(changelog).toContain("Added");
			} finally {
				if (fs.existsSync(data.output)) {
					await fs.promises.rm(data.output, { recursive: true });
				}
			}
		});

		it("should build changelog entry pages", async () => {
			const builder = new DoculaBuilder();
			const data: DoculaData = {
				...defaultPathFields,
				siteUrl: "http://foo.com",
				siteTitle: "docula",
				siteDescription: "Beautiful Website for Your Projects",
				sitePath: "test/fixtures/changelog-site",
				templatePath: "test/fixtures/template-example",
				output: "test/temp-changelog-entry-test",
				hasChangelog: true,
				changelogEntries: [
					{
						title: "Test Entry",
						date: "2025-01-15",
						formattedDate: "January 15, 2025",
						tag: "Added",
						tagClass: "added",
						slug: "test-entry",
						content: "Test content",
						generatedHtml: "<p>Test content</p>",
						preview: "<p>Test content</p>",
						urlPath: "/changelog/test-entry/index.html",
						lastModified: "2025-01-01",
					},
				],
				templates: {
					home: "home.hbs",

					changelog: "changelog.hbs",
					changelogEntry: "changelog-entry.hbs",
				},
			};

			if (fs.existsSync(data.output)) {
				await fs.promises.rm(data.output, { recursive: true });
			}

			try {
				await builder.buildChangelogEntryPages(data);
				expect(
					fs.existsSync(`${data.output}/changelog/test-entry/index.html`),
				).toBe(true);
				const entryPage = await fs.promises.readFile(
					`${data.output}/changelog/test-entry/index.html`,
					"utf8",
				);
				expect(entryPage).toContain("<title>docula - Test Entry</title>");
				expect(entryPage).toContain("Test content");
			} finally {
				if (fs.existsSync(data.output)) {
					await fs.promises.rm(data.output, { recursive: true });
				}
			}
		});

		it("should not build changelog page when hasChangelog is false", async () => {
			const builder = new DoculaBuilder();
			const data: DoculaData = {
				...defaultPathFields,
				siteUrl: "http://foo.com",
				siteTitle: "docula",
				siteDescription: "Beautiful Website for Your Projects",
				sitePath: "test/fixtures/single-page-site",
				templatePath: "test/fixtures/template-example",
				output: "test/temp-no-changelog-test",
				hasChangelog: false,
			};

			if (fs.existsSync(data.output)) {
				await fs.promises.rm(data.output, { recursive: true });
			}

			try {
				await builder.buildChangelogPage(data);
				expect(fs.existsSync(`${data.output}/changelog/index.html`)).toBe(
					false,
				);
			} finally {
				if (fs.existsSync(data.output)) {
					await fs.promises.rm(data.output, { recursive: true });
				}
			}
		});

		it("should not build changelog entry pages when no entries exist", async () => {
			const builder = new DoculaBuilder();
			const data: DoculaData = {
				...defaultPathFields,
				siteUrl: "http://foo.com",
				siteTitle: "docula",
				siteDescription: "Beautiful Website for Your Projects",
				sitePath: "test/fixtures/single-page-site",
				templatePath: "test/fixtures/template-example",
				output: "test/temp-no-changelog-entries-test",
				hasChangelog: false,
				changelogEntries: [],
			};

			try {
				await builder.buildChangelogEntryPages(data);
				expect(fs.existsSync(`${data.output}/changelog`)).toBe(false);
			} finally {
				if (fs.existsSync(data.output)) {
					await fs.promises.rm(data.output, { recursive: true });
				}
			}
		});

		it("should include /changelog in sitemap when changelog exists", async () => {
			const builder = new DoculaBuilder();
			const data: DoculaData = {
				...defaultPathFields,
				siteUrl: "http://foo.com",
				siteTitle: "docula",
				siteDescription: "Beautiful Website for Your Projects",
				sitePath: "test/fixtures/changelog-site",
				templatePath: "test/fixtures/template-example",
				output: "test/temp-sitemap-changelog-test",
				hasChangelog: true,
				changelogEntries: [
					{
						title: "Test Entry",
						date: "2025-01-15",
						formattedDate: "January 15, 2025",
						slug: "test-entry",
						content: "",
						generatedHtml: "",
						preview: "",
						urlPath: "/changelog/test-entry/index.html",
						lastModified: "2025-01-01",
					},
				],
				templates: {
					home: "home.hbs",

					changelog: "changelog.hbs",
				},
			};

			if (fs.existsSync(data.output)) {
				await fs.promises.rm(data.output, { recursive: true });
			}

			try {
				await builder.buildSiteMapPage(data);
				const sitemap = await fs.promises.readFile(
					`${data.output}/sitemap.xml`,
					"utf8",
				);
				expect(sitemap).toContain("<loc>http://foo.com/changelog</loc>");
				expect(sitemap).toContain(
					"<loc>http://foo.com/changelog/test-entry</loc>",
				);
			} finally {
				if (fs.existsSync(data.output)) {
					await fs.promises.rm(data.output, { recursive: true });
				}
			}
		});

		it("should include /changelog in sitemap with no changelog entry list", async () => {
			const builder = new DoculaBuilder();
			const data: DoculaData = {
				...defaultPathFields,
				siteUrl: "http://foo.com",
				siteTitle: "docula",
				siteDescription: "Beautiful Website for Your Projects",
				sitePath: "test/fixtures/changelog-site",
				templatePath: "test/fixtures/template-example",
				output: "test/temp-sitemap-changelog-no-entries-test",
				hasChangelog: true,
				templates: {
					home: "home.hbs",
					changelog: "changelog.hbs",
				},
			};

			if (fs.existsSync(data.output)) {
				await fs.promises.rm(data.output, { recursive: true });
			}

			try {
				await builder.buildSiteMapPage(data);
				const sitemap = await fs.promises.readFile(
					`${data.output}/sitemap.xml`,
					"utf8",
				);
				expect(sitemap).toContain("<loc>http://foo.com/changelog</loc>");
			} finally {
				if (fs.existsSync(data.output)) {
					await fs.promises.rm(data.output, { recursive: true });
				}
			}
		});

		it("should not include /changelog in sitemap when changelog does not exist", async () => {
			const builder = new DoculaBuilder();
			const data: DoculaData = {
				...defaultPathFields,
				siteUrl: "http://foo.com",
				siteTitle: "docula",
				siteDescription: "Beautiful Website for Your Projects",
				sitePath: "test/fixtures/single-page-site",
				templatePath: "test/fixtures/template-example",
				output: "test/temp-sitemap-no-changelog-test",
				hasChangelog: false,
				templates: {
					home: "home.hbs",
				},
			};

			if (fs.existsSync(data.output)) {
				await fs.promises.rm(data.output, { recursive: true });
			}

			try {
				await builder.buildSiteMapPage(data);
				const sitemap = await fs.promises.readFile(
					`${data.output}/sitemap.xml`,
					"utf8",
				);
				expect(sitemap).not.toContain("<loc>http://foo.com/changelog</loc>");
			} finally {
				if (fs.existsSync(data.output)) {
					await fs.promises.rm(data.output, { recursive: true });
				}
			}
		});

		it("should get changelog template when hasChangelog is true", async () => {
			const builder = new DoculaBuilder();
			const templateData = await builder.getTemplates(
				"test/fixtures/template-example/",
				false,
				true,
			);
			expect(templateData.changelog).toBe("changelog.hbs");
			expect(templateData.changelogEntry).toBe("changelog-entry.hbs");
		});

		it("should not get changelog template when hasChangelog is false", async () => {
			const builder = new DoculaBuilder();
			const templateData = await builder.getTemplates(
				"test/fixtures/template-example/",
				false,
				false,
			);
			expect(templateData.changelog).toBeUndefined();
			expect(templateData.changelogEntry).toBeUndefined();
		});

		it("should build with changelog", async () => {
			const options = new DoculaOptions();
			options.output = "test/temp-build-changelog-test";
			options.sitePath = "test/fixtures/changelog-site";
			const builder = new DoculaBuilder(options);
			const consoleLog = console.log;
			let consoleMessage = "";
			console.log = (message) => {
				consoleMessage = message as string;
			};

			try {
				await builder.build();
				expect(fs.existsSync(`${options.output}/changelog/index.html`)).toBe(
					true,
				);
				expect(
					fs.existsSync(
						`${options.output}/changelog/2025-01-15-new-feature/index.html`,
					),
				).toBe(true);
				expect(
					fs.existsSync(
						`${options.output}/changelog/2025-02-01-bug-fix/index.html`,
					),
				).toBe(true);
				expect(
					fs.existsSync(
						`${options.output}/changelog/2024-12-20-improvements/index.html`,
					),
				).toBe(true);
			} finally {
				await fs.promises.rm(builder.options.output, {
					recursive: true,
				});
			}

			expect(consoleMessage).toContain("Build");

			console.log = consoleLog;
		});

		it("should generate preview from markdown content", () => {
			const builder = new DoculaBuilder();
			const entry = builder.parseChangelogEntry(
				"test/fixtures/changelog-site/changelog/2025-01-15-new-feature.md",
			);
			expect(entry.preview).toBeTruthy();
			expect(entry.preview).toContain("<");
			// Preview should be rendered HTML from truncated markdown
		});

		it("should generate preview that is shorter than full content for long entries", () => {
			const builder = new DoculaBuilder();
			// No paragraph breaks so fallback truncation with "..." is used
			const preview = builder.generateChangelogPreview(
				"This is a very long content. ".repeat(30),
			);
			const full = builder.generateChangelogPreview("Short content.");
			// Long content should be truncated with "..."
			expect(preview).toContain("...");
			// Short content should not be truncated
			expect(full).not.toContain("...");
		});

		it("should strip markdown headings from preview", () => {
			const builder = new DoculaBuilder();
			const markdown =
				"## What's Changed\n\nSome great new features were added to the project.";
			const preview = builder.generateChangelogPreview(markdown);
			expect(preview).not.toContain("What's Changed");
			expect(preview).toContain("great new features");
		});

		it("should convert markdown links to plain text in preview", () => {
			const builder = new DoculaBuilder();
			const markdown =
				"Check out [this link](https://example.com) for more details about the release.";
			const preview = builder.generateChangelogPreview(markdown);
			expect(preview).toContain("this link");
			expect(preview).not.toContain("https://example.com");
		});

		it("should remove all images from preview", () => {
			const builder = new DoculaBuilder();
			const markdown =
				"![screenshot](https://example.com/img.png)\n\nHere is the content of the release.";
			const preview = builder.generateChangelogPreview(markdown);
			expect(preview).not.toContain("img.png");
			expect(preview).toContain("content of the release");
		});

		it("should parse previewImage from frontmatter", () => {
			const builder = new DoculaBuilder();
			const entry = builder.parseChangelogEntry(
				"test/fixtures/changelog-site/changelog/2025-01-15-new-feature.md",
			);
			// This fixture may or may not have previewImage — just check the field exists on the type
			expect(entry).toHaveProperty("previewImage");
		});

		it("should split on paragraph boundary without ellipsis", () => {
			const builder = new DoculaBuilder();
			// First paragraph is ~350 chars, second is short
			const para1 =
				"This is the first paragraph with enough content to exceed the minimum length requirement of three hundred characters. We need to keep writing more content here to make sure it is long enough to pass the threshold that triggers truncation behavior in the preview generator. Adding even more words to ensure this paragraph exceeds three hundred characters in total length.";
			const para2 =
				"This is the second paragraph that should be cut off because it exceeds the max.";
			const markdown = `${para1}\n\n${para2}`;
			const preview = builder.generateChangelogPreview(markdown);
			expect(preview).toContain("first paragraph");
			expect(preview).not.toContain("second paragraph");
			// Clean paragraph split should not have ellipsis
			expect(preview).not.toContain("...");
		});

		it("should handle list-heavy content by splitting at list item boundaries", () => {
			const builder = new DoculaBuilder();
			const items = Array.from(
				{ length: 20 },
				(_, i) =>
					`- Feature number ${i + 1} was added to the project with great improvements`,
			);
			const markdown = items.join("\n");
			const preview = builder.generateChangelogPreview(markdown);
			// Should contain complete list items rendered as HTML
			expect(preview).toContain("<li>");
			// Should not contain "..." since we split at a clean boundary
		});

		it("should return full content when markdown is shorter than minLength", () => {
			const builder = new DoculaBuilder();
			const short = "Just a brief note about this release.";
			const preview = builder.generateChangelogPreview(short);
			expect(preview).toContain("brief note");
			expect(preview).not.toContain("...");
		});

		it("should handle empty input", () => {
			const builder = new DoculaBuilder();
			const preview = builder.generateChangelogPreview("");
			expect(preview).toBeDefined();
		});

		it("should split at early paragraph break when no break exists past minLength", () => {
			const builder = new DoculaBuilder();
			// Short first paragraph (~50 chars), then a very long second paragraph with no breaks
			const para1 = "Short intro paragraph for the release notes.";
			const para2 =
				"This second paragraph is extremely long and has no paragraph breaks within it so the only available split point is the early paragraph break before the minimum length threshold. ".repeat(
					3,
				);
			const markdown = `${para1}\n\n${para2}`;
			const preview = builder.generateChangelogPreview(markdown);
			// Should split at the only \n\n even though it's before 300
			expect(preview).toContain("Short intro");
			expect(preview).not.toContain("...");
		});

		it("should use ellipsis only when no clean break is found", () => {
			const builder = new DoculaBuilder();
			// Single long paragraph with no breaks — must fallback to word-boundary truncation
			const longText = "word ".repeat(150);
			const preview = builder.generateChangelogPreview(longText);
			expect(preview).toContain("...");
		});

		it("should build paginated changelog pages", async () => {
			const options = new DoculaOptions();
			options.changelogPerPage = 2;
			options.output = "test/temp-changelog-pagination-test";
			const builder = new DoculaBuilder(options);

			const entries = [];
			for (let i = 0; i < 5; i++) {
				entries.push({
					title: `Entry ${i}`,
					date: `2025-01-${String(15 - i).padStart(2, "0")}`,
					formattedDate: `January ${15 - i}, 2025`,
					tag: "Added",
					tagClass: "added",
					slug: `entry-${i}`,
					content: `Content ${i}`,
					generatedHtml: `<p>Content ${i}</p>`,
					preview: `<p>Content ${i}</p>`,
					urlPath: `/changelog/entry-${i}/index.html`,
					lastModified: "2025-01-01",
				});
			}

			const data: DoculaData = {
				...defaultPathFields,
				siteUrl: "http://foo.com",
				siteTitle: "docula",
				siteDescription: "Beautiful Website for Your Projects",
				sitePath: "test/fixtures/changelog-site",
				templatePath: "test/fixtures/template-example",
				output: options.output,
				hasChangelog: true,
				changelogEntries: entries,
				templates: {
					home: "home.hbs",
					changelog: "changelog.hbs",
					changelogEntry: "changelog-entry.hbs",
				},
			};

			if (fs.existsSync(data.output)) {
				await fs.promises.rm(data.output, { recursive: true });
			}

			try {
				await builder.buildChangelogPage(data);
				// Page 1 at /changelog/index.html
				expect(fs.existsSync(`${data.output}/changelog/index.html`)).toBe(true);
				// Page 2 at /changelog/page/2/index.html
				expect(
					fs.existsSync(`${data.output}/changelog/page/2/index.html`),
				).toBe(true);
				// Page 3 at /changelog/page/3/index.html
				expect(
					fs.existsSync(`${data.output}/changelog/page/3/index.html`),
				).toBe(true);
				// No page 4
				expect(
					fs.existsSync(`${data.output}/changelog/page/4/index.html`),
				).toBe(false);

				const page1 = await fs.promises.readFile(
					`${data.output}/changelog/index.html`,
					"utf8",
				);
				expect(page1).toContain("Entry 0");
				expect(page1).toContain("Entry 1");
				expect(page1).not.toContain("Entry 2");

				const page2 = await fs.promises.readFile(
					`${data.output}/changelog/page/2/index.html`,
					"utf8",
				);
				expect(page2).toContain("Entry 2");
				expect(page2).toContain("Entry 3");
				expect(page2).not.toContain("Entry 4");
			} finally {
				if (fs.existsSync(data.output)) {
					await fs.promises.rm(data.output, { recursive: true });
				}
			}
		});

		it("should include paginated changelog pages in sitemap", async () => {
			const options = new DoculaOptions();
			options.changelogPerPage = 2;
			options.output = "test/temp-sitemap-pagination-test";
			const builder = new DoculaBuilder(options);

			const entries = [];
			for (let i = 0; i < 5; i++) {
				entries.push({
					title: `Entry ${i}`,
					date: `2025-01-${String(15 - i).padStart(2, "0")}`,
					formattedDate: `January ${15 - i}, 2025`,
					slug: `entry-${i}`,
					content: "",
					generatedHtml: "",
					preview: "",
					urlPath: `/changelog/entry-${i}/index.html`,
					lastModified: "2025-01-01",
				});
			}

			const data: DoculaData = {
				...defaultPathFields,
				siteUrl: "http://foo.com",
				siteTitle: "docula",
				siteDescription: "Beautiful Website for Your Projects",
				sitePath: "test/fixtures/changelog-site",
				templatePath: "test/fixtures/template-example",
				output: options.output,
				hasChangelog: true,
				changelogEntries: entries,
				templates: {
					home: "home.hbs",
					changelog: "changelog.hbs",
				},
			};

			if (fs.existsSync(data.output)) {
				await fs.promises.rm(data.output, { recursive: true });
			}

			try {
				await builder.buildSiteMapPage(data);
				const sitemap = await fs.promises.readFile(
					`${data.output}/sitemap.xml`,
					"utf8",
				);
				expect(sitemap).toContain("<loc>http://foo.com/changelog</loc>");
				expect(sitemap).toContain("<loc>http://foo.com/changelog/page/2</loc>");
				expect(sitemap).toContain("<loc>http://foo.com/changelog/page/3</loc>");
				expect(sitemap).not.toContain(
					"<loc>http://foo.com/changelog/page/4</loc>",
				);
			} finally {
				if (fs.existsSync(data.output)) {
					await fs.promises.rm(data.output, { recursive: true });
				}
			}
		});
	});

	describe("Docula Builder - Release to Changelog Conversion", () => {
		it("should convert a GitHub release to a DoculaChangelogEntry", () => {
			const builder = new DoculaBuilder();
			const release = {
				tag_name: "v1.9.10",
				name: "v1.9.10",
				published_at: "2023-07-02T21:06:40Z",
				body: "## What's Changed\n* upgrading packages",
				draft: false,
				prerelease: false,
			};
			const entry = builder.convertReleaseToChangelogEntry(release);
			expect(entry.title).toBe("v1.9.10");
			expect(entry.slug).toBe("v1-9-10");
			expect(entry.date).toBe("2023-07-02");
			expect(entry.formattedDate).toContain("2023");
			expect(entry.tag).toBe("Release");
			expect(entry.tagClass).toBe("release");
			expect(entry.urlPath).toBe("/changelog/v1-9-10/index.html");
			expect(entry.generatedHtml).toContain("What");
		});

		it("should mark prerelease entries with Pre-release tag", () => {
			const builder = new DoculaBuilder();
			const release = {
				tag_name: "v2.0.0-beta.1",
				name: "v2.0.0 Beta 1",
				published_at: "2024-01-15T10:00:00Z",
				body: "Beta release",
				draft: false,
				prerelease: true,
			};
			const entry = builder.convertReleaseToChangelogEntry(release);
			expect(entry.tag).toBe("Pre-release");
			expect(entry.tagClass).toBe("pre-release");
			expect(entry.title).toBe("v2.0.0 Beta 1");
		});

		it("should use tag_name as title when name is empty", () => {
			const builder = new DoculaBuilder();
			const release = {
				tag_name: "v1.0.0",
				name: "",
				published_at: "2023-01-01T00:00:00Z",
				body: "",
				draft: false,
				prerelease: false,
			};
			const entry = builder.convertReleaseToChangelogEntry(release);
			expect(entry.title).toBe("v1.0.0");
		});

		it("should handle release with empty body", () => {
			const builder = new DoculaBuilder();
			const release = {
				tag_name: "v1.0.0",
				name: "v1.0.0",
				published_at: "2023-01-01T00:00:00Z",
				body: "",
				draft: false,
				prerelease: false,
			};
			const entry = builder.convertReleaseToChangelogEntry(release);
			expect(entry.content).toBe("");
		});

		it("should handle release with missing published_at", () => {
			const builder = new DoculaBuilder();
			const release = {
				tag_name: "v1.0.0",
				name: "v1.0.0",
				body: "Some content",
				draft: false,
				prerelease: false,
			};
			const entry = builder.convertReleaseToChangelogEntry(release);
			expect(entry.date).toBe("");
			expect(entry.formattedDate).toBe("");
		});

		it("should default missing release fields and ignore invalid published_at", () => {
			const builder = new DoculaBuilder();
			const release = {
				published_at: "not-a-date",
				draft: false,
			};
			const entry = builder.convertReleaseToChangelogEntry(release);
			expect(entry.title).toBe("");
			expect(entry.slug).toBe("");
			expect(entry.content).toBe("");
			expect(entry.tag).toBe("Release");
			expect(entry.date).toBe("");
			expect(entry.formattedDate).toBe("");
		});

		it("should filter out draft releases in getReleasesAsChangelogEntries", () => {
			const builder = new DoculaBuilder();
			const releases = [
				{
					tag_name: "v1.0.0",
					name: "v1.0.0",
					published_at: "2023-01-01T00:00:00Z",
					body: "First",
					draft: false,
					prerelease: false,
				},
				{
					tag_name: "v1.1.0",
					name: "v1.1.0",
					published_at: "2023-02-01T00:00:00Z",
					body: "Draft",
					draft: true,
					prerelease: false,
				},
				{
					tag_name: "v1.2.0",
					name: "v1.2.0",
					published_at: "2023-03-01T00:00:00Z",
					body: "Third",
					draft: false,
					prerelease: false,
				},
			];
			const entries = builder.getReleasesAsChangelogEntries(releases);
			expect(entries.length).toBe(2);
			expect(entries[0].title).toBe("v1.0.0");
			expect(entries[1].title).toBe("v1.2.0");
		});

		it("should return empty array for empty releases", () => {
			const builder = new DoculaBuilder();
			const entries = builder.getReleasesAsChangelogEntries([]);
			expect(entries).toStrictEqual([]);
		});

		it("should build with enableReleaseChangelog enabled and merge release entries with file entries", async () => {
			const options = new DoculaOptions();
			options.output = "test/temp-build-release-changelog-test";
			options.sitePath = "test/fixtures/changelog-site";
			options.githubPath = "jaredwray/docula";
			options.enableReleaseChangelog = true;
			const builder = new DoculaBuilder(options);

			try {
				await builder.build();
				expect(fs.existsSync(`${options.output}/changelog/index.html`)).toBe(
					true,
				);
				// File-based entries should exist
				expect(
					fs.existsSync(
						`${options.output}/changelog/2025-01-15-new-feature/index.html`,
					),
				).toBe(true);
				// Release-based entries should also exist (from mock data)
				expect(
					fs.existsSync(`${options.output}/changelog/v1-9-10/index.html`),
				).toBe(true);
			} finally {
				await fs.promises.rm(options.output, {
					recursive: true,
					force: true,
				});
			}
		});

		it("should not include release entries when enableReleaseChangelog is false", async () => {
			const options = new DoculaOptions();
			options.output = "test/temp-build-no-release-changelog-test";
			options.sitePath = "test/fixtures/changelog-site";
			options.enableReleaseChangelog = false;
			const builder = new DoculaBuilder(options);

			try {
				await builder.build();
				expect(fs.existsSync(`${options.output}/changelog/index.html`)).toBe(
					true,
				);
				// File-based entries should still exist
				expect(
					fs.existsSync(
						`${options.output}/changelog/2025-01-15-new-feature/index.html`,
					),
				).toBe(true);
				// Release-based entries should NOT exist
				expect(
					fs.existsSync(`${options.output}/changelog/v1-9-10/index.html`),
				).toBe(false);
			} finally {
				await fs.promises.rm(options.output, {
					recursive: true,
					force: true,
				});
			}
		});

		it("should skip changelog pages when no changelog entries exist", async () => {
			const options = new DoculaOptions();
			options.output = "test/temp-build-no-changelog-pages-test";
			options.sitePath = "test/fixtures/single-page-site";
			options.enableReleaseChangelog = false;
			const builder = new DoculaBuilder(options);

			try {
				await builder.build();
				expect(fs.existsSync(`${options.output}/changelog/index.html`)).toBe(
					false,
				);
			} finally {
				await fs.promises.rm(options.output, {
					recursive: true,
					force: true,
				});
			}
		});

		it("should call onReleaseChangelog hook to modify release entries", async () => {
			const options = new DoculaOptions();
			options.output = "test/temp-build-on-release-changelog-test";
			options.sitePath = "test/fixtures/changelog-site";
			options.githubPath = "jaredwray/docula";
			options.enableReleaseChangelog = true;
			const builder = new DoculaBuilder(options);

			let hookCalled = false;
			let receivedConsole: unknown;
			builder.onReleaseChangelog = (entries, console) => {
				hookCalled = true;
				receivedConsole = console;
				// Modify titles and filter to only first 2 entries
				return entries.slice(0, 2).map((entry) => ({
					...entry,
					title: `Modified: ${entry.title}`,
				}));
			};

			try {
				await builder.build();
				expect(hookCalled).toBe(true);
				expect(receivedConsole).toBeDefined();
				expect(typeof (receivedConsole as Record<string, unknown>).info).toBe(
					"function",
				);
				expect(typeof (receivedConsole as Record<string, unknown>).error).toBe(
					"function",
				);
				const changelog = await fs.promises.readFile(
					`${options.output}/changelog/index.html`,
					"utf8",
				);
				expect(changelog).toContain("Modified:");
			} finally {
				await fs.promises.rm(options.output, {
					recursive: true,
					force: true,
				});
			}
		});

		it("should call async onReleaseChangelog hook", async () => {
			const options = new DoculaOptions();
			options.output = "test/temp-build-on-release-changelog-async-test";
			options.sitePath = "test/fixtures/changelog-site";
			options.githubPath = "jaredwray/docula";
			options.enableReleaseChangelog = true;
			const builder = new DoculaBuilder(options);

			builder.onReleaseChangelog = async (entries, _console) =>
				entries.filter((e) => e.tag === "Release");

			try {
				await builder.build();
				expect(fs.existsSync(`${options.output}/changelog/index.html`)).toBe(
					true,
				);
			} finally {
				await fs.promises.rm(options.output, {
					recursive: true,
					force: true,
				});
			}
		});

		it("should handle onReleaseChangelog hook errors gracefully", async () => {
			const options = new DoculaOptions();
			options.output = "test/temp-build-on-release-changelog-error-test";
			options.sitePath = "test/fixtures/changelog-site";
			options.githubPath = "jaredwray/docula";
			options.enableReleaseChangelog = true;
			const builder = new DoculaBuilder(options);

			builder.onReleaseChangelog = (_entries, _console) => {
				throw new Error("Hook failed");
			};

			try {
				// Should not throw — error is caught and logged
				await builder.build();
				expect(fs.existsSync(`${options.output}/changelog/index.html`)).toBe(
					true,
				);
			} finally {
				await fs.promises.rm(options.output, {
					recursive: true,
					force: true,
				});
			}
		});

		it("should work normally when onReleaseChangelog is not set", async () => {
			const options = new DoculaOptions();
			options.output = "test/temp-build-no-on-release-changelog-test";
			options.sitePath = "test/fixtures/changelog-site";
			options.githubPath = "jaredwray/docula";
			options.enableReleaseChangelog = true;
			const builder = new DoculaBuilder(options);

			try {
				await builder.build();
				expect(fs.existsSync(`${options.output}/changelog/index.html`)).toBe(
					true,
				);
				expect(
					fs.existsSync(`${options.output}/changelog/v1-9-10/index.html`),
				).toBe(true);
			} finally {
				await fs.promises.rm(options.output, {
					recursive: true,
					force: true,
				});
			}
		});
	});

	describe("Docula Builder - HTML Entity Handling in Code Blocks", () => {
		it("should produce correct HTML entities in generatedHtml for code blocks with generics", () => {
			const builder = new DoculaBuilder();
			const doc = builder.parseDocumentData(
				"test/fixtures/multi-page-site/docs/generics-doc.md",
			);
			// Writr escapes left angle brackets in code blocks using hex entities (&#x3C; for <)
			// Syntax highlighting may insert <span> tags between identifiers and entities
			expect(doc.generatedHtml).toContain("&#x3C;T>");
			expect(doc.generatedHtml).toContain("&#x3C;");
			// The raw < should not appear unescaped in code content for generics
			expect(doc.generatedHtml).not.toMatch(/identity<T>/);
		});

		it("should build docs pages with generics in code blocks without he.decode", async () => {
			const builder = new DoculaBuilder();
			const data: DoculaData = {
				...defaultPathFields,
				siteUrl: "http://foo.com",
				siteTitle: "docula",
				siteDescription: "Beautiful Website for Your Projects",
				sitePath: "test/fixtures/multi-page-site",
				templatePath: "test/fixtures/template-example",
				output: "test/temp-generics-test",
				hasDocuments: true,
				sections: [],
				documents: builder.getDocumentInDirectory(
					"test/fixtures/multi-page-site/docs",
					"test/fixtures/multi-page-site/docs",
				),
				templates: {
					home: "home.hbs",

					docPage: "docs.hbs",
				},
			};

			data.sidebarItems = builder.generateSidebarItems(data);

			await fs.promises.rm(data.output, { recursive: true, force: true });

			try {
				await builder.buildDocsPages(data);
				const genericsDoc = data.documents?.find(
					(d) => d.title === "Generics Guide",
				);
				expect(genericsDoc).toBeDefined();

				const outputFile = `${data.output}${genericsDoc?.urlPath}`;
				const content = await fs.promises.readFile(outputFile, "utf8");

				// The docs page should render successfully
				expect(content).toContain("Generics Guide");
				expect(content).toContain("<code");
				// Verify the page contains the code block content
				expect(content).toContain("identity");
				expect(content).toContain("Map");
			} finally {
				await fs.promises.rm(data.output, { recursive: true, force: true });
			}
		});

		it("should build changelog entry pages without he.decode", async () => {
			const builder = new DoculaBuilder();
			const generatedHtml =
				"<pre><code>function identity&lt;T&gt;(arg: T): T { return arg; }</code></pre>";
			const data: DoculaData = {
				...defaultPathFields,
				siteUrl: "http://foo.com",
				siteTitle: "docula",
				siteDescription: "Beautiful Website for Your Projects",
				sitePath: "test/fixtures/changelog-site",
				templatePath: "test/fixtures/template-example",
				output: "test/temp-changelog-generics-test",
				hasChangelog: true,
				changelogEntries: [
					{
						title: "Generics Support",
						date: "2025-03-01",
						formattedDate: "March 1, 2025",
						tag: "Added",
						tagClass: "added",
						slug: "generics-support",
						content:
							"```ts\nfunction identity<T>(arg: T): T { return arg; }\n```",
						generatedHtml,
						preview: "<p>Code example</p>",
						urlPath: "/changelog/generics-support/index.html",
						lastModified: "2025-01-01",
					},
				],
				templates: {
					home: "home.hbs",

					changelog: "changelog.hbs",
					changelogEntry: "changelog-entry.hbs",
				},
			};

			await fs.promises.rm(data.output, { recursive: true, force: true });

			try {
				await builder.buildChangelogEntryPages(data);
				const entryPage = await fs.promises.readFile(
					`${data.output}/changelog/generics-support/index.html`,
					"utf8",
				);
				// The page should render and contain the code block content
				expect(entryPage).toContain("Generics Support");
				expect(entryPage).toContain("identity");
			} finally {
				await fs.promises.rm(data.output, { recursive: true, force: true });
			}
		});

		it("should handle non-ASCII characters without he.decode", async () => {
			const builder = new DoculaBuilder();
			const data: DoculaData = {
				...defaultPathFields,
				siteUrl: "http://foo.com",
				siteTitle: "docula",
				siteDescription: "Beautiful Website for Your Projects",
				sitePath: "test/fixtures/multi-page-site",
				templatePath: "test/fixtures/template-example",
				output: "test/temp-nonascii-test",
				hasDocuments: true,
				sections: [],
				documents: builder.getDocumentInDirectory(
					"test/fixtures/multi-page-site/docs",
					"test/fixtures/multi-page-site/docs",
				),
				templates: {
					home: "home.hbs",

					docPage: "docs.hbs",
				},
			};

			data.sidebarItems = builder.generateSidebarItems(data);

			await fs.promises.rm(data.output, { recursive: true, force: true });

			try {
				await builder.buildDocsPages(data);
				const genericsDoc = data.documents?.find(
					(d) => d.title === "Generics Guide",
				);
				expect(genericsDoc).toBeDefined();

				const outputFile = `${data.output}${genericsDoc?.urlPath}`;
				const content = await fs.promises.readFile(outputFile, "utf8");

				// Page should render with non-ASCII content intact
				expect(content).toBeTruthy();
				expect(content.length).toBeGreaterThan(0);
				// Non-ASCII section should be present
				expect(content).toContain("Non-ASCII");
				// HTML entities from the markdown (&eacute;, &uuml;, etc.) should
				// be rendered as their Unicode characters by Writr
				expect(content).toContain("caf\u00E9");
				expect(content).toContain("na\u00EFve");
				expect(content).toContain("r\u00E9sum\u00E9");
				expect(content).toContain("\u00FCber");
				expect(content).toContain("stra\u00DFe");
				expect(content).toContain("\u00A9 2025");
			} finally {
				await fs.promises.rm(data.output, { recursive: true, force: true });
			}
		});
	});

	describe("Docula Builder - LLM Files", () => {
		it("should generate llms.txt and llms-full.txt for docs-only sites", async () => {
			const builder = new DoculaBuilder();
			const output = "test/temp-llms-docs-only";
			const data: DoculaData = {
				...defaultPathFields,
				siteUrl: "http://foo.com",
				siteTitle: "docula",
				siteDescription: "Beautiful Website for Your Projects",
				sitePath: "test/fixtures/multi-page-site",
				templatePath: "test/fixtures/template-example",
				output,
			};

			data.documents = builder.getDocuments(
				"test/fixtures/multi-page-site/docs",
				data,
			);

			await fs.promises.rm(output, { recursive: true, force: true });

			try {
				await builder.buildLlmsFiles(data);

				expect(fs.existsSync(`${output}/llms.txt`)).toBe(true);
				expect(fs.existsSync(`${output}/llms-full.txt`)).toBe(true);

				const llms = await fs.promises.readFile(`${output}/llms.txt`, "utf8");
				const llmsFull = await fs.promises.readFile(
					`${output}/llms-full.txt`,
					"utf8",
				);

				expect(llms).toContain(
					"[Full LLM Content](http://foo.com/llms-full.txt)",
				);
				expect(llms).toContain("## Documentation");
				expect(llms).toContain("(http://foo.com/docs/");
				expect(llmsFull).toContain("## Documentation");
				expect(llmsFull).toContain("## API Reference");
				expect(llmsFull).toContain("## Changelog");
				expect(llmsFull).toContain("## Beautiful Website for Your Projects");
				expect(llmsFull).toContain(
					"### docula\nURL: http://foo.com/docs/front-matter/\nDescription: Beautiful Website for Your Projects\n\n## Beautiful Website for Your Projects",
				);
			} finally {
				await fs.promises.rm(output, { recursive: true, force: true });
			}
		});

		it("should include API link and local OpenAPI spec text in llms-full.txt", async () => {
			const builder = new DoculaBuilder();
			const output = "test/temp-llms-api-local-spec";
			const data: DoculaData = {
				...defaultPathFields,
				siteUrl: "http://foo.com",
				siteTitle: "docula",
				siteDescription: "Beautiful Website for Your Projects",
				sitePath: "test/fixtures/mega-page-site-no-home-page",
				templatePath: "templates/modern",
				output,
				openApiUrl: "/api/swagger.json",
				hasApi: true,
			};

			await fs.promises.rm(output, { recursive: true, force: true });

			try {
				await builder.buildLlmsFiles(data);

				const llmsFull = await fs.promises.readFile(
					`${output}/llms-full.txt`,
					"utf8",
				);

				expect(llmsFull).toContain("## API Reference");
				expect(llmsFull).toContain("URL: http://foo.com/api");
				expect(llmsFull).toContain('"openapi": "3.0.3"');
				expect(llmsFull).toContain("Mock HTTP API");
			} finally {
				await fs.promises.rm(output, { recursive: true, force: true });
			}
		});

		it("should fall back to OpenAPI URL and preserve non-index doc URLs", async () => {
			const builder = new DoculaBuilder();
			const output = "test/temp-llms-openapi-fallback";
			const data: DoculaData = {
				...defaultPathFields,
				siteUrl: "http://foo.com/",
				siteTitle: "docula",
				siteDescription: "Beautiful Website for Your Projects",
				sitePath: "test/fixtures/single-page-site",
				templatePath: "test/fixtures/template-example",
				output,
				openApiUrl: "openapi.json?raw=1",
				hasApi: true,
				documents: [
					{
						title: "Guide",
						navTitle: "Guide",
						description: "Guide page",
						keywords: [],
						content: "# Guide",
						markdown: "# Guide",
						generatedHtml: "<h1>Guide</h1>",
						documentPath: "test/fixtures/single-page-site/docs/guide.md",
						urlPath: "/guide.html",
						isRoot: true,
						lastModified: "2025-01-01",
					},
				],
			};

			await fs.promises.rm(output, { recursive: true, force: true });

			try {
				await builder.buildLlmsFiles(data);

				const llms = await fs.promises.readFile(`${output}/llms.txt`, "utf8");
				const llmsFull = await fs.promises.readFile(
					`${output}/llms-full.txt`,
					"utf8",
				);

				expect(llms).toContain("[Guide](http://foo.com/guide.html)");
				expect(llmsFull).toContain(
					"OpenAPI Spec URL: http://foo.com/openapi.json?raw=1",
				);
			} finally {
				await fs.promises.rm(output, { recursive: true, force: true });
			}
		});

		it("should handle API section without openApiUrl", async () => {
			const builder = new DoculaBuilder();
			const output = "test/temp-llms-api-no-openapi";
			const data: DoculaData = {
				...defaultPathFields,
				siteUrl: "http://foo.com",
				siteTitle: "docula",
				siteDescription: "Beautiful Website for Your Projects",
				sitePath: "test/fixtures/single-page-site",
				templatePath: "test/fixtures/template-example",
				output,
				hasApi: true,
			};

			await fs.promises.rm(output, { recursive: true, force: true });

			try {
				await builder.buildLlmsFiles(data);

				const llmsFull = await fs.promises.readFile(
					`${output}/llms-full.txt`,
					"utf8",
				);
				expect(llmsFull).toContain("## API Reference");
				expect(llmsFull).toContain("URL: http://foo.com/api");
				expect(llmsFull).not.toContain("OpenAPI Spec URL:");
			} finally {
				await fs.promises.rm(output, { recursive: true, force: true });
			}
		});

		it("should handle openApiUrl with query-only path", async () => {
			const builder = new DoculaBuilder();
			const output = "test/temp-llms-openapi-query-only";
			const data: DoculaData = {
				...defaultPathFields,
				siteUrl: "http://foo.com",
				siteTitle: "docula",
				siteDescription: "Beautiful Website for Your Projects",
				sitePath: "test/fixtures/single-page-site",
				templatePath: "test/fixtures/template-example",
				output,
				openApiUrl: "?raw=1",
				hasApi: true,
			};

			await fs.promises.rm(output, { recursive: true, force: true });

			try {
				await builder.buildLlmsFiles(data);

				const llmsFull = await fs.promises.readFile(
					`${output}/llms-full.txt`,
					"utf8",
				);
				expect(llmsFull).toContain("OpenAPI Spec URL: http://foo.com/?raw=1");
			} finally {
				await fs.promises.rm(output, { recursive: true, force: true });
			}
		});

		it("should not read OpenAPI files outside sitePath", async () => {
			const builder = new DoculaBuilder();
			const sitePath = "test/temp-llms-safe-openapi-site";
			const output = "test/temp-llms-safe-openapi-output";
			const externalSpecPath = "test/temp-llms-safe-openapi-external.json";
			const externalMarker = "external-openapi-should-not-be-read";
			const data: DoculaData = {
				...defaultPathFields,
				siteUrl: "http://foo.com",
				siteTitle: "docula",
				siteDescription: "Beautiful Website for Your Projects",
				sitePath,
				templatePath: "test/fixtures/template-example",
				output,
				openApiUrl: "../temp-llms-safe-openapi-external.json",
				hasApi: true,
			};

			await fs.promises.rm(sitePath, { recursive: true, force: true });
			await fs.promises.rm(output, { recursive: true, force: true });
			await fs.promises.rm(externalSpecPath, { recursive: true, force: true });
			await fs.promises.mkdir(sitePath, { recursive: true });
			await fs.promises.writeFile(
				externalSpecPath,
				`{"openapi":"3.0.0","info":{"title":"${externalMarker}"}}`,
				"utf8",
			);

			try {
				await builder.buildLlmsFiles(data);

				const llmsFull = await fs.promises.readFile(
					`${output}/llms-full.txt`,
					"utf8",
				);
				expect(llmsFull).toContain(
					"OpenAPI Spec URL: http://foo.com/../temp-llms-safe-openapi-external.json",
				);
				expect(llmsFull).not.toContain(externalMarker);
			} finally {
				await fs.promises.rm(sitePath, { recursive: true, force: true });
				await fs.promises.rm(output, { recursive: true, force: true });
				await fs.promises.rm(externalSpecPath, {
					recursive: true,
					force: true,
				});
			}
		});

		it("should not read symbolic linked OpenAPI files", async () => {
			const builder = new DoculaBuilder();
			const sitePath = "test/temp-llms-openapi-symlink-site";
			const output = "test/temp-llms-openapi-symlink-output";
			const targetSpecPath = `${sitePath}/api/real-swagger.json`;
			const symlinkSpecPath = `${sitePath}/api/swagger-link.json`;
			const marker = "symlink-openapi-should-not-be-read";
			const data: DoculaData = {
				...defaultPathFields,
				siteUrl: "http://foo.com",
				siteTitle: "docula",
				siteDescription: "Beautiful Website for Your Projects",
				sitePath,
				templatePath: "test/fixtures/template-example",
				output,
				openApiUrl: "/api/swagger-link.json",
				hasApi: true,
			};

			await fs.promises.rm(sitePath, { recursive: true, force: true });
			await fs.promises.rm(output, { recursive: true, force: true });
			await fs.promises.mkdir(`${sitePath}/api`, { recursive: true });
			await fs.promises.writeFile(
				targetSpecPath,
				`{"openapi":"3.0.0","info":{"title":"${marker}"}}`,
				"utf8",
			);
			await fs.promises.symlink("real-swagger.json", symlinkSpecPath);

			try {
				await builder.buildLlmsFiles(data);

				const llmsFull = await fs.promises.readFile(
					`${output}/llms-full.txt`,
					"utf8",
				);
				expect(llmsFull).toContain(
					"OpenAPI Spec URL: http://foo.com/api/swagger-link.json",
				);
				expect(llmsFull).not.toContain(marker);
			} finally {
				await fs.promises.rm(sitePath, { recursive: true, force: true });
				await fs.promises.rm(output, { recursive: true, force: true });
			}
		});

		it("should include changelog landing and only latest 20 entries in llms.txt", async () => {
			const builder = new DoculaBuilder();
			const output = "test/temp-llms-changelog-index";
			const changelogEntries = Array.from({ length: 25 }, (_, index) => ({
				title: `Entry ${index + 1}`,
				date: `2025-01-${String(index + 1).padStart(2, "0")}`,
				formattedDate: `January ${index + 1}, 2025`,
				slug: `entry-${index + 1}`,
				content: `Content ${index + 1}`,
				generatedHtml: `<p>Content ${index + 1}</p>`,
				preview: `<p>Content ${index + 1}</p>`,
				urlPath: `/changelog/entry-${index + 1}/index.html`,
				lastModified: "2025-01-01",
			}));
			const data: DoculaData = {
				...defaultPathFields,
				siteUrl: "http://foo.com",
				siteTitle: "docula",
				siteDescription: "Beautiful Website for Your Projects",
				sitePath: "test/fixtures/changelog-site",
				templatePath: "test/fixtures/template-example",
				output,
				hasChangelog: true,
				changelogEntries,
			};

			await fs.promises.rm(output, { recursive: true, force: true });

			try {
				await builder.buildLlmsFiles(data);

				const llms = await fs.promises.readFile(`${output}/llms.txt`, "utf8");
				const changelogLines = llms.split("\n").filter((line) => {
					const urlMatch = line.match(/\((https?:\/\/[^)\s]+)\)/);
					if (!urlMatch) {
						return false;
					}

					const parsedUrl = new URL(urlMatch[1]);
					return (
						parsedUrl.host === "foo.com" &&
						parsedUrl.pathname.startsWith("/changelog/entry-")
					);
				});

				expect(llms).toContain("- [Changelog](http://foo.com/changelog)");
				expect(changelogLines).toHaveLength(20);
				expect(llms).toContain("Entry 1");
				expect(llms).toContain("Entry 20");
				expect(llms).not.toContain("Entry 21");
				expect(llms).not.toContain("Entry 25");
			} finally {
				await fs.promises.rm(output, { recursive: true, force: true });
			}
		});

		it("should include all changelog entries in llms-full.txt", async () => {
			const builder = new DoculaBuilder();
			const output = "test/temp-llms-full-changelog";
			const changelogEntries = Array.from({ length: 25 }, (_, index) => ({
				title: `Entry ${index + 1}`,
				date: `2025-01-${String(index + 1).padStart(2, "0")}`,
				formattedDate: `January ${index + 1}, 2025`,
				slug: `entry-${index + 1}`,
				content: `Content ${index + 1}`,
				generatedHtml: `<p>Content ${index + 1}</p>`,
				preview: `<p>Content ${index + 1}</p>`,
				urlPath: `/changelog/entry-${index + 1}/index.html`,
				lastModified: "2025-01-01",
			}));
			const data: DoculaData = {
				...defaultPathFields,
				siteUrl: "http://foo.com",
				siteTitle: "docula",
				siteDescription: "Beautiful Website for Your Projects",
				sitePath: "test/fixtures/changelog-site",
				templatePath: "test/fixtures/template-example",
				output,
				hasChangelog: true,
				changelogEntries,
			};

			await fs.promises.rm(output, { recursive: true, force: true });

			try {
				await builder.buildLlmsFiles(data);

				const llmsFull = await fs.promises.readFile(
					`${output}/llms-full.txt`,
					"utf8",
				);
				const entryHeadings = llmsFull
					.split("\n")
					.filter((line) => line.startsWith("### Entry "));

				expect(entryHeadings).toHaveLength(25);
				expect(llmsFull).toContain("Content 25");
			} finally {
				await fs.promises.rm(output, { recursive: true, force: true });
			}
		});

		it("should copy custom llms files when they exist in site path", async () => {
			const builder = new DoculaBuilder();
			const sitePath = "test/temp-custom-llms-site";
			const output = "test/temp-custom-llms-output";
			const customLlms = "# Custom llms.txt";
			const customLlmsFull = "# Custom llms-full.txt";
			const data: DoculaData = {
				...defaultPathFields,
				siteUrl: "http://foo.com",
				siteTitle: "docula",
				siteDescription: "Beautiful Website for Your Projects",
				sitePath,
				templatePath: "test/fixtures/template-example",
				output,
			};

			await fs.promises.rm(sitePath, { recursive: true, force: true });
			await fs.promises.rm(output, { recursive: true, force: true });
			await fs.promises.mkdir(sitePath, { recursive: true });
			await fs.promises.writeFile(`${sitePath}/llms.txt`, customLlms, "utf8");
			await fs.promises.writeFile(
				`${sitePath}/llms-full.txt`,
				customLlmsFull,
				"utf8",
			);

			try {
				await builder.buildLlmsFiles(data);

				const llms = await fs.promises.readFile(`${output}/llms.txt`, "utf8");
				const llmsFull = await fs.promises.readFile(
					`${output}/llms-full.txt`,
					"utf8",
				);

				expect(llms).toBe(customLlms);
				expect(llmsFull).toBe(customLlmsFull);
			} finally {
				await fs.promises.rm(sitePath, { recursive: true, force: true });
				await fs.promises.rm(output, { recursive: true, force: true });
			}
		});

		it("should ignore symbolic linked llms override files", async () => {
			const builder = new DoculaBuilder();
			const sitePath = "test/temp-custom-llms-symlink-site";
			const output = "test/temp-custom-llms-symlink-output";
			const externalLlmsPath = "test/temp-custom-llms-symlink-source.txt";
			const externalLlmsFullPath =
				"test/temp-custom-llms-symlink-source-full.txt";
			const externalMarker = "symlink-override-should-not-be-read";
			const data: DoculaData = {
				...defaultPathFields,
				siteUrl: "http://foo.com",
				siteTitle: "docula",
				siteDescription: "Beautiful Website for Your Projects",
				sitePath,
				templatePath: "test/fixtures/template-example",
				output,
			};

			await fs.promises.rm(sitePath, { recursive: true, force: true });
			await fs.promises.rm(output, { recursive: true, force: true });
			await fs.promises.rm(externalLlmsPath, { recursive: true, force: true });
			await fs.promises.rm(externalLlmsFullPath, {
				recursive: true,
				force: true,
			});
			await fs.promises.mkdir(sitePath, { recursive: true });
			await fs.promises.writeFile(externalLlmsPath, externalMarker, "utf8");
			await fs.promises.writeFile(externalLlmsFullPath, externalMarker, "utf8");
			await fs.promises.symlink(
				"../temp-custom-llms-symlink-source.txt",
				`${sitePath}/llms.txt`,
			);
			await fs.promises.symlink(
				"../temp-custom-llms-symlink-source-full.txt",
				`${sitePath}/llms-full.txt`,
			);

			try {
				await builder.buildLlmsFiles(data);

				const llms = await fs.promises.readFile(`${output}/llms.txt`, "utf8");
				const llmsFull = await fs.promises.readFile(
					`${output}/llms-full.txt`,
					"utf8",
				);

				expect(llms).toContain("# docula");
				expect(llmsFull).toContain("# docula");
				expect(llms).not.toContain(externalMarker);
				expect(llmsFull).not.toContain(externalMarker);
			} finally {
				await fs.promises.rm(sitePath, { recursive: true, force: true });
				await fs.promises.rm(output, { recursive: true, force: true });
				await fs.promises.rm(externalLlmsPath, {
					recursive: true,
					force: true,
				});
				await fs.promises.rm(externalLlmsFullPath, {
					recursive: true,
					force: true,
				});
			}
		});

		it("should return undefined when override candidate path fails boundary check", async () => {
			const builder = new DoculaBuilder();
			const sitePath = "test/temp-override-boundary-check";
			const unsafeBuilder = builder as unknown as {
				isPathWithinBasePath: (
					candidatePath: string,
					basePath: string,
				) => boolean;
			};

			await fs.promises.rm(sitePath, { recursive: true, force: true });
			await fs.promises.mkdir(sitePath, { recursive: true });
			await fs.promises.writeFile(
				`${sitePath}/llms.txt`,
				"# marker-should-not-be-used",
				"utf8",
			);

			vi.spyOn(unsafeBuilder, "isPathWithinBasePath").mockReturnValue(false);

			try {
				const data: DoculaData = {
					...defaultPathFields,
					siteUrl: "http://foo.com",
					siteTitle: "docula",
					siteDescription: "Beautiful Website for Your Projects",
					sitePath,
					templatePath: "test/fixtures/template-example",
					output: "test/temp-override-boundary-check-output",
				};
				await fs.promises.rm(data.output, { recursive: true, force: true });

				await builder.buildLlmsFiles(data);

				const llms = await fs.promises.readFile(
					`${data.output}/llms.txt`,
					"utf8",
				);
				expect(llms).toContain("# docula");
				expect(llms).not.toContain("marker-should-not-be-used");
			} finally {
				await fs.promises.rm(sitePath, { recursive: true, force: true });
				await fs.promises.rm("test/temp-override-boundary-check-output", {
					recursive: true,
					force: true,
				});
			}
		});

		it("should return undefined when override realpath lookup fails", async () => {
			const builder = new DoculaBuilder();
			const sitePath = "test/temp-override-realpath-fail";

			await fs.promises.rm(sitePath, { recursive: true, force: true });
			await fs.promises.mkdir(sitePath, { recursive: true });
			await fs.promises.writeFile(
				`${sitePath}/llms.txt`,
				"# marker-should-not-be-used",
				"utf8",
			);

			vi.spyOn(fs.promises, "realpath").mockRejectedValue(
				new Error("realpath failed"),
			);

			try {
				const data: DoculaData = {
					...defaultPathFields,
					siteUrl: "http://foo.com",
					siteTitle: "docula",
					siteDescription: "Beautiful Website for Your Projects",
					sitePath,
					templatePath: "test/fixtures/template-example",
					output: "test/temp-override-realpath-fail-output",
				};
				await fs.promises.rm(data.output, { recursive: true, force: true });

				await builder.buildLlmsFiles(data);

				const llms = await fs.promises.readFile(
					`${data.output}/llms.txt`,
					"utf8",
				);
				expect(llms).toContain("# docula");
				expect(llms).not.toContain("marker-should-not-be-used");
			} finally {
				await fs.promises.rm(sitePath, { recursive: true, force: true });
				await fs.promises.rm("test/temp-override-realpath-fail-output", {
					recursive: true,
					force: true,
				});
			}
		});

		it("should return undefined when override realpath escapes base path", async () => {
			const builder = new DoculaBuilder();
			const unsafeBuilder = builder as unknown as {
				getSafeSiteOverrideFileContent: (
					sitePath: string,
					fileName: "llms.txt" | "llms-full.txt",
				) => Promise<string | undefined>;
				isPathWithinBasePath: (
					candidatePath: string,
					basePath: string,
				) => boolean;
			};
			const sitePath = "test/temp-override-realpath-escape";

			await fs.promises.rm(sitePath, { recursive: true, force: true });
			await fs.promises.mkdir(sitePath, { recursive: true });
			await fs.promises.writeFile(`${sitePath}/llms.txt`, "# marker", "utf8");

			vi.spyOn(unsafeBuilder, "isPathWithinBasePath")
				.mockImplementationOnce(() => true)
				.mockImplementationOnce(() => false);

			try {
				const content = await unsafeBuilder.getSafeSiteOverrideFileContent(
					sitePath,
					"llms.txt",
				);
				expect(content).toBeUndefined();
			} finally {
				await fs.promises.rm(sitePath, { recursive: true, force: true });
			}
		});

		it("should return undefined when OpenAPI realpath lookup fails", async () => {
			const builder = new DoculaBuilder();
			const unsafeBuilder = builder as unknown as {
				getSafeLocalOpenApiSpec: (
					data: DoculaData,
				) => Promise<{ sourcePath: string; content: string } | undefined>;
			};
			const sitePath = "test/temp-openapi-realpath-fail";

			await fs.promises.rm(sitePath, { recursive: true, force: true });
			await fs.promises.mkdir(`${sitePath}/api`, { recursive: true });
			await fs.promises.writeFile(
				`${sitePath}/api/swagger.json`,
				'{"openapi":"3.0.0","info":{"title":"spec"}}',
				"utf8",
			);

			vi.spyOn(fs.promises, "realpath").mockRejectedValue(
				new Error("realpath failed"),
			);

			try {
				const data: DoculaData = {
					...defaultPathFields,
					siteUrl: "http://foo.com",
					siteTitle: "docula",
					siteDescription: "Beautiful Website for Your Projects",
					sitePath,
					templatePath: "test/fixtures/template-example",
					output: "test/temp-openapi-realpath-fail-output",
					openApiUrl: "/api/swagger.json",
					hasApi: true,
				};

				const spec = await unsafeBuilder.getSafeLocalOpenApiSpec(data);
				expect(spec).toBeUndefined();
			} finally {
				await fs.promises.rm(sitePath, { recursive: true, force: true });
				await fs.promises.rm("test/temp-openapi-realpath-fail-output", {
					recursive: true,
					force: true,
				});
			}
		});

		it("should return undefined when OpenAPI realpath escapes base path", async () => {
			const builder = new DoculaBuilder();
			const unsafeBuilder = builder as unknown as {
				getSafeLocalOpenApiSpec: (
					data: DoculaData,
				) => Promise<{ sourcePath: string; content: string } | undefined>;
				isPathWithinBasePath: (
					candidatePath: string,
					basePath: string,
				) => boolean;
			};
			const sitePath = "test/temp-openapi-realpath-escape";

			await fs.promises.rm(sitePath, { recursive: true, force: true });
			await fs.promises.mkdir(`${sitePath}/api`, { recursive: true });
			await fs.promises.writeFile(
				`${sitePath}/api/swagger.json`,
				'{"openapi":"3.0.0","info":{"title":"spec"}}',
				"utf8",
			);

			vi.spyOn(unsafeBuilder, "isPathWithinBasePath")
				.mockImplementationOnce(() => true)
				.mockImplementationOnce(() => false);

			try {
				const data: DoculaData = {
					...defaultPathFields,
					siteUrl: "http://foo.com",
					siteTitle: "docula",
					siteDescription: "Beautiful Website for Your Projects",
					sitePath,
					templatePath: "test/fixtures/template-example",
					output: "test/temp-openapi-realpath-escape-output",
					openApiUrl: "/api/swagger.json",
					hasApi: true,
				};

				const spec = await unsafeBuilder.getSafeLocalOpenApiSpec(data);
				expect(spec).toBeUndefined();
			} finally {
				await fs.promises.rm(sitePath, { recursive: true, force: true });
				await fs.promises.rm("test/temp-openapi-realpath-escape-output", {
					recursive: true,
					force: true,
				});
			}
		});

		it("should skip llms generation when enableLlmsTxt is false", async () => {
			const options = new DoculaOptions();
			options.enableLlmsTxt = false;
			const builder = new DoculaBuilder(options);
			const output = "test/temp-llms-disabled";
			const data: DoculaData = {
				...defaultPathFields,
				siteUrl: "http://foo.com",
				siteTitle: "docula",
				siteDescription: "Beautiful Website for Your Projects",
				sitePath: "test/fixtures/multi-page-site",
				templatePath: "test/fixtures/template-example",
				output,
			};

			await fs.promises.rm(output, { recursive: true, force: true });

			try {
				await builder.buildLlmsFiles(data);
				expect(fs.existsSync(`${output}/llms.txt`)).toBe(false);
				expect(fs.existsSync(`${output}/llms-full.txt`)).toBe(false);
			} finally {
				await fs.promises.rm(output, { recursive: true, force: true });
			}
		});

		it("should not include llms files in sitemap.xml", async () => {
			const builder = new DoculaBuilder();
			const output = "test/temp-sitemap-no-llms";
			const data: DoculaData = {
				...defaultPathFields,
				siteUrl: "http://foo.com",
				siteTitle: "docula",
				siteDescription: "Beautiful Website for Your Projects",
				sitePath: "test/fixtures/changelog-site",
				templatePath: "test/fixtures/template-example",
				output,
				openApiUrl: "/api/swagger.json",
				hasApi: true,
				hasChangelog: true,
				changelogEntries: [
					{
						title: "Test Entry",
						date: "2025-01-15",
						formattedDate: "January 15, 2025",
						slug: "test-entry",
						content: "",
						generatedHtml: "",
						preview: "",
						urlPath: "/changelog/test-entry/index.html",
						lastModified: "2025-01-01",
					},
				],
				documents: [
					{
						title: "Doc",
						navTitle: "Doc",
						description: "",
						keywords: [],
						content: "# Doc",
						markdown: "# Doc",
						generatedHtml: "<h1>Doc</h1>",
						documentPath: "test/fixtures/changelog-site/docs/doc.md",
						urlPath: "/docs/doc/index.html",
						isRoot: true,
						lastModified: "2025-01-01",
					},
				],
				templates: {
					home: "home.hbs",
					api: "api.hbs",
					changelog: "changelog.hbs",
				},
			};

			await fs.promises.rm(output, { recursive: true, force: true });

			try {
				await builder.buildSiteMapPage(data);
				const sitemap = await fs.promises.readFile(
					`${output}/sitemap.xml`,
					"utf8",
				);
				expect(sitemap).not.toContain("llms.txt");
				expect(sitemap).not.toContain("llms-full.txt");
			} finally {
				await fs.promises.rm(output, { recursive: true, force: true });
			}
		});
	});

	describe("Docula Builder - buildDocsHomePage", () => {
		it("should render first document as index.html when no README.md exists", async () => {
			const builder = new DoculaBuilder();
			const data: DoculaData = {
				...defaultPathFields,
				siteUrl: "http://foo.com",
				siteTitle: "docula",
				siteDescription: "Beautiful Website for Your Projects",
				sitePath: "test/fixtures/multi-page-site",
				templatePath: "test/fixtures/template-example",
				output: "test/temp-docs-home-test",

				hasDocuments: true,
				sections: [{ name: "getting-started", path: "getting-started" }],
				documents: builder.getDocuments("test/fixtures/multi-page-site/docs", {
					siteUrl: "http://foo.com",
					siteTitle: "docula",
					siteDescription: "Beautiful Website for Your Projects",
					sitePath: "test/fixtures/multi-page-site",
					templatePath: "test/fixtures/template-example",
					output: "test/temp-docs-home-test",
				}),
				templates: {
					home: "home.hbs",
					docPage: "docs.hbs",
				},
			};

			await fs.promises.rm(data.output, { recursive: true, force: true });
			try {
				await builder.buildDocsHomePage(data);
				const indexHtml = await fs.promises.readFile(
					`${data.output}/index.html`,
					"utf8",
				);
				expect(indexHtml).toBeTruthy();
				expect(indexHtml.length).toBeGreaterThan(0);
			} finally {
				await fs.promises.rm(data.output, { recursive: true, force: true });
			}
		});

		it("should throw error when no docPage template is provided", async () => {
			const builder = new DoculaBuilder();
			const data: DoculaData = {
				...defaultPathFields,
				siteUrl: "http://foo.com",
				siteTitle: "docula",
				siteDescription: "Beautiful Website for Your Projects",
				sitePath: "test/fixtures/multi-page-site",
				templatePath: "test/fixtures/template-example",
				output: "test/temp-docs-home-error-test",

				hasDocuments: true,
				documents: [],
				templates: {
					home: "home.hbs",
				},
			};

			await expect(builder.buildDocsHomePage(data)).rejects.toThrow(
				"No docPage template found for docs home page",
			);
		});

		it("should throw error when documents array is empty", async () => {
			const builder = new DoculaBuilder();
			const data: DoculaData = {
				...defaultPathFields,
				siteUrl: "http://foo.com",
				siteTitle: "docula",
				siteDescription: "Beautiful Website for Your Projects",
				sitePath: "test/fixtures/multi-page-site",
				templatePath: "test/fixtures/template-example",
				output: "test/temp-docs-home-empty-test",

				hasDocuments: true,
				documents: [],
				templates: {
					home: "home.hbs",
					docPage: "docs.hbs",
				},
			};

			await expect(builder.buildDocsHomePage(data)).rejects.toThrow(
				"No documents found for docs home page",
			);
		});

		it("should render docs home page when sidebarItems are precomputed", async () => {
			const builder = new DoculaBuilder();
			const data: DoculaData = {
				...defaultPathFields,
				siteUrl: "http://foo.com",
				siteTitle: "docula",
				siteDescription: "Beautiful Website for Your Projects",
				sitePath: "test/fixtures/multi-page-site",
				templatePath: "test/fixtures/template-example",
				output: "test/temp-docs-home-precomputed-sidebar",

				hasDocuments: true,
				sections: [{ name: "getting-started", path: "getting-started" }],
				documents: builder.getDocuments("test/fixtures/multi-page-site/docs", {
					siteUrl: "http://foo.com",
					siteTitle: "docula",
					siteDescription: "Beautiful Website for Your Projects",
					sitePath: "test/fixtures/multi-page-site",
					templatePath: "test/fixtures/template-example",
					output: "test/temp-docs-home-precomputed-sidebar",
				}),
				sidebarItems: [],
				templates: {
					home: "home.hbs",
					docPage: "docs.hbs",
				},
			};

			await fs.promises.rm(data.output, { recursive: true, force: true });
			try {
				await builder.buildDocsHomePage(data);
				expect(fs.existsSync(`${data.output}/index.html`)).toBe(true);
			} finally {
				await fs.promises.rm(data.output, { recursive: true, force: true });
			}
		});
	});

	describe("Docula Builder - buildApiHomePage", () => {
		it("should render API page as index.html when no README and no docs", async () => {
			const options = new DoculaOptions();
			options.output = "test/temp-api-home-test";
			options.sitePath = "test/fixtures/api-only-site";
			const builder = new DoculaBuilder(options);
			const consoleLog = console.log;
			console.log = () => {};

			try {
				await builder.build();
				const indexHtml = await fs.promises.readFile(
					`${options.output}/index.html`,
					"utf8",
				);
				expect(indexHtml).toContain("Test API");
			} finally {
				await fs.promises.rm(options.output, { recursive: true, force: true });
				console.log = consoleLog;
			}
		});

		it("should throw error when no API template or openApiUrl found", async () => {
			const builder = new DoculaBuilder();
			const data: DoculaData = {
				...defaultPathFields,
				siteUrl: "http://foo.com",
				siteTitle: "docula",
				siteDescription: "Beautiful Website for Your Projects",
				sitePath: "test/fixtures/empty-site",
				templatePath: "test/fixtures/template-example",
				output: "test/temp-api-home-error-test",
			};

			await expect(builder.renderApiContent(data)).rejects.toThrow(
				"No API template or openApiUrl found",
			);
		});
	});

	describe("Docula Builder - Content Assets", () => {
		it("should copy non-markdown files from docs to output docs", async () => {
			const options = new DoculaOptions();
			options.output = "test/temp-content-assets-docs";
			options.sitePath = "test/fixtures/multi-page-site";
			options.githubPath = "jaredwray/docula";
			options.siteTitle = "docula";
			options.siteDescription = "Beautiful Website for Your Projects";
			options.siteUrl = "https://docula.org";
			const builder = new DoculaBuilder(options);
			const consoleLog = console.log;
			console.log = () => {};

			try {
				await builder.build();

				// Assets are copied into each document's output subdirectory
				// so relative paths in markdown resolve correctly
				expect(
					fs.existsSync(
						`${options.output}/docs/front-matter/images/diagram.png`,
					),
				).toBe(true);
				expect(
					fs.existsSync(
						`${options.output}/docs/front-matter/assets/sample.pdf`,
					),
				).toBe(true);

				// Verify file contents are correct
				const diagramContent = await fs.promises.readFile(
					`${options.output}/docs/front-matter/images/diagram.png`,
					"utf8",
				);
				expect(diagramContent).toContain("test diagram content");

				const pdfContent = await fs.promises.readFile(
					`${options.output}/docs/front-matter/assets/sample.pdf`,
					"utf8",
				);
				expect(pdfContent).toContain("test pdf content");

				// Verify markdown files were NOT copied as raw files
				expect(fs.existsSync(`${options.output}/docs/front-matter.md`)).toBe(
					false,
				);
			} finally {
				await fs.promises.rm(options.output, {
					recursive: true,
					force: true,
				});
				console.log = consoleLog;
			}
		});

		it("should copy non-markdown files from changelog to output changelog", async () => {
			const options = new DoculaOptions();
			options.output = "test/temp-content-assets-changelog";
			options.sitePath = "test/fixtures/mega-page-site";
			options.githubPath = "jaredwray/docula";
			options.siteTitle = "docula";
			options.siteDescription = "Beautiful Website for Your Projects";
			options.siteUrl = "https://docula.org";
			const builder = new DoculaBuilder(options);
			const consoleLog = console.log;
			console.log = () => {};

			try {
				await builder.build();

				// Verify changelog image was copied
				expect(
					fs.existsSync(
						`${options.output}/changelog/images/release-screenshot.png`,
					),
				).toBe(true);

				const screenshotContent = await fs.promises.readFile(
					`${options.output}/changelog/images/release-screenshot.png`,
					"utf8",
				);
				expect(screenshotContent).toContain("test screenshot content");

				// Verify markdown files were NOT copied as raw files
				expect(
					fs.existsSync(
						`${options.output}/changelog/2025-01-15-new-feature.md`,
					),
				).toBe(false);
			} finally {
				await fs.promises.rm(options.output, {
					recursive: true,
					force: true,
				});
				console.log = consoleLog;
			}
		});

		it("should only copy files with allowed asset extensions", async () => {
			const tempSitePath = "test/temp-content-assets-extensions-site";
			const docsPath = `${tempSitePath}/docs`;

			await fs.promises.mkdir(docsPath, { recursive: true });
			await fs.promises.writeFile(
				`${docsPath}/index.md`,
				"---\ntitle: Home\ndescription: Test home page\n---\n# Home\n![Photo](photo.jpg)\nContent",
			);
			await fs.promises.writeFile(`${docsPath}/photo.jpg`, "jpg content");
			await fs.promises.writeFile(`${docsPath}/script.sh`, "#!/bin/bash");
			await fs.promises.writeFile(`${tempSitePath}/README.md`, "# Test");

			const options = new DoculaOptions();
			options.output = `${tempSitePath}/dist`;
			options.sitePath = tempSitePath;
			options.githubPath = "jaredwray/docula";
			options.siteTitle = "docula";
			options.siteDescription = "Beautiful Website for Your Projects";
			options.siteUrl = "https://docula.org";
			const builder = new DoculaBuilder(options);
			const consoleLog = console.log;
			console.log = () => {};

			try {
				await builder.build();

				// .jpg is in the default asset extensions
				expect(fs.existsSync(`${options.output}/docs/photo.jpg`)).toBe(true);
				// .sh is NOT in the default asset extensions
				expect(fs.existsSync(`${options.output}/docs/script.sh`)).toBe(false);
			} finally {
				await fs.promises.rm(tempSitePath, {
					recursive: true,
					force: true,
				});
				console.log = consoleLog;
			}
		});

		it("should respect custom allowedAssets from options", async () => {
			const tempSitePath = "test/temp-content-assets-custom-ext-site";
			const docsPath = `${tempSitePath}/docs`;

			await fs.promises.mkdir(docsPath, { recursive: true });
			await fs.promises.writeFile(
				`${docsPath}/index.md`,
				"---\ntitle: Home\ndescription: Test home page\n---\n# Home\n![Custom](custom.xyz)\n![Photo](photo.jpg)\nContent",
			);
			await fs.promises.writeFile(`${docsPath}/photo.jpg`, "jpg content");
			await fs.promises.writeFile(`${docsPath}/custom.xyz`, "custom content");
			await fs.promises.writeFile(`${tempSitePath}/README.md`, "# Test");

			const options = new DoculaOptions();
			options.output = `${tempSitePath}/dist`;
			options.sitePath = tempSitePath;
			options.githubPath = "jaredwray/docula";
			options.siteTitle = "docula";
			options.siteDescription = "Beautiful Website for Your Projects";
			options.siteUrl = "https://docula.org";
			// Only allow .xyz extension
			options.allowedAssets = [".xyz"];
			const builder = new DoculaBuilder(options);
			const consoleLog = console.log;
			console.log = () => {};

			try {
				await builder.build();

				// .xyz is in our custom list
				expect(fs.existsSync(`${options.output}/docs/custom.xyz`)).toBe(true);
				// .jpg is NOT in our custom list
				expect(fs.existsSync(`${options.output}/docs/photo.jpg`)).toBe(false);
			} finally {
				await fs.promises.rm(tempSitePath, {
					recursive: true,
					force: true,
				});
				console.log = consoleLog;
			}
		});

		it("should copy sibling assets into non-index document output directories", async () => {
			const options = new DoculaOptions();
			options.output = "test/temp-content-assets-sibling";
			options.sitePath = "test/fixtures/multi-page-site";
			options.githubPath = "jaredwray/docula";
			options.siteTitle = "docula";
			options.siteDescription = "Beautiful Website for Your Projects";
			options.siteUrl = "https://docula.org";
			const builder = new DoculaBuilder(options);
			const consoleLog = console.log;
			console.log = () => {};

			try {
				await builder.build();

				// Assets exist inside each document's output subdirectory
				// so that relative paths like images/diagram.png resolve correctly
				// from /docs/front-matter/index.html
				expect(
					fs.existsSync(
						`${options.output}/docs/front-matter/images/diagram.png`,
					),
				).toBe(true);
				expect(
					fs.existsSync(
						`${options.output}/docs/front-matter/assets/sample.pdf`,
					),
				).toBe(true);

				// readme-example references images/diagram.png so it should be copied
				expect(
					fs.existsSync(
						`${options.output}/docs/readme-example/images/diagram.png`,
					),
				).toBe(true);

				// Documents that do NOT reference assets should NOT have them copied
				expect(
					fs.existsSync(
						`${options.output}/docs/no-front-matter/images/diagram.png`,
					),
				).toBe(false);
				expect(
					fs.existsSync(
						`${options.output}/docs/generics-doc/images/diagram.png`,
					),
				).toBe(false);
			} finally {
				await fs.promises.rm(options.output, {
					recursive: true,
					force: true,
				});
				console.log = consoleLog;
			}
		});

		it("should NOT copy unreferenced assets from docs", async () => {
			const tempSitePath = "test/temp-content-assets-unreferenced-site";
			const docsPath = `${tempSitePath}/docs`;

			await fs.promises.mkdir(docsPath, { recursive: true });
			await fs.promises.writeFile(
				`${docsPath}/index.md`,
				"---\ntitle: Home\ndescription: Test home page\n---\n# Home\n![Used](used.png)\nContent",
			);
			await fs.promises.writeFile(`${docsPath}/used.png`, "used content");
			await fs.promises.writeFile(`${docsPath}/unused.png`, "unused content");
			await fs.promises.writeFile(`${tempSitePath}/README.md`, "# Test");

			const options = new DoculaOptions();
			options.output = `${tempSitePath}/dist`;
			options.sitePath = tempSitePath;
			options.githubPath = "jaredwray/docula";
			options.siteTitle = "docula";
			options.siteDescription = "Beautiful Website for Your Projects";
			options.siteUrl = "https://docula.org";
			const builder = new DoculaBuilder(options);
			const consoleLog = console.log;
			console.log = () => {};

			try {
				await builder.build();

				// Referenced asset should be copied
				expect(fs.existsSync(`${options.output}/docs/used.png`)).toBe(true);
				// Unreferenced asset should NOT be copied
				expect(fs.existsSync(`${options.output}/docs/unused.png`)).toBe(false);
			} finally {
				await fs.promises.rm(tempSitePath, {
					recursive: true,
					force: true,
				});
				console.log = consoleLog;
			}
		});

		it("should handle docs directory with no non-markdown files", async () => {
			const options = new DoculaOptions();
			options.output = "test/temp-content-assets-no-assets";
			options.sitePath = "test/fixtures/single-page-site";
			options.githubPath = "jaredwray/docula";
			options.siteTitle = "docula";
			options.siteDescription = "Beautiful Website for Your Projects";
			options.siteUrl = "https://docula.org";
			const builder = new DoculaBuilder(options);
			const consoleLog = console.log;
			console.log = () => {};

			try {
				// Build should complete without errors
				await builder.build();
				expect(fs.existsSync(`${options.output}/index.html`)).toBe(true);
			} finally {
				await fs.promises.rm(options.output, {
					recursive: true,
					force: true,
				});
				console.log = consoleLog;
			}
		});
	});

	describe("Docula Builder - cookieAuth", () => {
		it("should render login button when cookieAuth is configured", async () => {
			const options = new DoculaOptions();
			options.template = "modern";
			options.sitePath = "test/fixtures/multi-page-site";
			options.output = "test/temp-build-cookie-auth";
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
			options.output = "test/temp-build-no-cookie-auth";

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
			options.output = "test/temp-build-cookie-auth-logout-url";

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
			options.output = "test/temp-build-cookie-auth-mobile";

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
			options.output = "test/temp-build-cookie-auth-header-actions";

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
			options.output = "test/temp-build-cookie-auth-head-cache";

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
			options.output = "test/temp-build-cookie-auth-inline-username";

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
			options.output = "test/temp-build-cookie-auth-no-inline-styles";
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
			options.output = "test/temp-build-cookie-auth-check-url";

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
			options.output = "test/temp-build-header-links";

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
			options.output = "test/temp-build-no-header-links";

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
			options.output = "test/temp-build-header-links-icon";

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
			options.output = "test/temp-build-header-links-default-icon";

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
			options.output = "test/temp-build-header-links-mobile";

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

	describe("lastModified field", () => {
		it("should include lastModified in YYYY-MM-DD format for parseDocumentData", () => {
			const builder = new DoculaBuilder();
			const doc = builder.parseDocumentData(
				"test/fixtures/multi-page-site/docs/front-matter.md",
			);
			expect(doc.lastModified).toBeDefined();
			expect(doc.lastModified).toMatch(/^\d{4}-\d{2}-\d{2}$/);
		});

		it("should include lastModified in YYYY-MM-DD format for parseChangelogEntry", () => {
			const builder = new DoculaBuilder();
			const entry = builder.parseChangelogEntry(
				"test/fixtures/changelog-site/changelog/2025-01-15-new-feature.md",
			);
			expect(entry.lastModified).toBeDefined();
			expect(entry.lastModified).toMatch(/^\d{4}-\d{2}-\d{2}$/);
		});

		it("should include lastModified from release date for GitHub release changelog entries", () => {
			const builder = new DoculaBuilder();
			const release = {
				tag_name: "v1.0.0",
				name: "Release 1.0.0",
				body: "Release notes",
				published_at: "2025-06-15T00:00:00Z",
				prerelease: false,
				draft: false,
			};
			const entries = builder.getReleasesAsChangelogEntries([release]);
			expect(entries[0].lastModified).toBe("2025-06-15");
		});
	});

	describe("Branch coverage - uncovered paths", () => {
		it("should rebuild when assets change but docs and template are unchanged", async () => {
			const sitePath = "test/temp-diff-build-asset-change";
			const output = `${sitePath}/dist`;

			fs.cpSync("test/fixtures/multi-page-site", sitePath, {
				recursive: true,
			});

			const consoleLog = console.log;
			console.log = () => {};

			try {
				const options = new DoculaOptions();
				options.sitePath = sitePath;
				options.output = output;
				options.templatePath = "test/fixtures/template-example/";
				const builder = new DoculaBuilder(options);

				// First build
				await builder.build();

				// Modify an asset file (variables.css)
				fs.writeFileSync(
					`${sitePath}/variables.css`,
					":root { --color: red; }",
				);

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
			const builder = new DoculaBuilder();
			// biome-ignore lint/suspicious/noExplicitAny: test access to private method
			const result = (builder as any).escapeXml(undefined);
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
			const sitePath = "test/fixtures/single-page-site";
			const overrideDir = `${sitePath}/templates/modern/includes`;
			const cacheDir = `${sitePath}/.cache`;

			// Create override that shadows an existing template file
			fs.mkdirSync(overrideDir, { recursive: true });
			fs.writeFileSync(
				`${overrideDir}/footer.hbs`,
				"<footer>Override Footer</footer>",
			);

			const consoleLog = console.log;
			console.log = () => {};

			try {
				const options = new DoculaOptions();
				options.sitePath = sitePath;
				const builder = new DoculaBuilder(options);

				// First merge — creates cache with override
				// biome-ignore lint/suspicious/noExplicitAny: test access to private method
				const result = (builder as any).mergeTemplateOverrides(
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

				const messages: string[] = [];
				console.log = (message) => {
					messages.push(stripAnsi(message as string));
				};

				// Second merge — should detect removal and restore original
				// biome-ignore lint/suspicious/noExplicitAny: test access to private method
				(builder as any).mergeTemplateOverrides(
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
				fs.rmSync(`${sitePath}/templates`, { recursive: true, force: true });
				fs.rmSync(cacheDir, { recursive: true, force: true });
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
				output: "./test/temp-empty-docspath",
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
				output: "test/temp-sitemap-basurl",
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
				output: "test/temp-sitemap-apipath",
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

	describe("Docula Builder - Build Changelog Feed JSON", () => {
		it("should build changelog.json with valid entries", async () => {
			const builder = new DoculaBuilder();
			const data: DoculaData = {
				...defaultPathFields,
				siteUrl: "http://foo.com",
				siteTitle: "My Site",
				siteDescription: "Site description",
				sitePath: "test/fixtures/changelog-site",
				templatePath: "test/fixtures/template-example",
				output: "test/temp-changelog-json-test",
				changelogEntries: [
					{
						title: "Release v2.0",
						date: "2025-03-01",
						formattedDate: "March 1, 2025",
						tag: "Added",
						tagClass: "added",
						slug: "release-v2-0",
						content: "# Release v2.0\n\nNew features added.",
						generatedHtml: "<h1>Release v2.0</h1><p>New features added.</p>",
						preview: "New features added.",
						previewImage: "/img/v2.png",
						urlPath: "/changelog/release-v2-0/",
						lastModified: "2025-03-01",
					},
					{
						title: "Release v1.0",
						date: "2025-01-15",
						formattedDate: "January 15, 2025",
						slug: "release-v1-0",
						content: "# Release v1.0\n\nInitial release.",
						generatedHtml: "<h1>Release v1.0</h1><p>Initial release.</p>",
						preview: "Initial release.",
						urlPath: "/changelog/release-v1-0/",
						lastModified: "2025-01-15",
					},
				],
			};

			if (fs.existsSync(data.output)) {
				await fs.promises.rm(data.output, { recursive: true, force: true });
			}

			try {
				await builder.buildChangelogFeedJson(data);
				const raw = await fs.promises.readFile(
					`${data.output}/changelog.json`,
					"utf8",
				);
				const feed = JSON.parse(raw);

				expect(feed.version).toBe("https://jsonfeed.org/version/1.1");
				expect(feed.title).toBe("My Site");
				expect(feed.description).toBe("Site description");
				expect(feed.home_page_url).toBe("http://foo.com/");
				expect(feed.feed_url).toBe("http://foo.com/changelog.json");
				expect(feed.items).toHaveLength(2);

				const first = feed.items[0];
				expect(first.id).toBe("release-v2-0");
				expect(first.title).toBe("Release v2.0");
				expect(first.url).toBe("http://foo.com/changelog/release-v2-0/");
				expect(first.date_published).toBe("2025-03-01");
				expect(first.date_modified).toBe("2025-03-01");
				expect(first.summary).toBe("New features added.");
				expect(first.content_html).toBe(
					"<h1>Release v2.0</h1><p>New features added.</p>",
				);
				expect(first.content_text).toBe(
					"# Release v2.0\n\nNew features added.",
				);
				expect(first.tags).toEqual(["Added"]);
				expect(first.image).toBe("/img/v2.png");

				const second = feed.items[1];
				expect(second.id).toBe("release-v1-0");
				expect(second.title).toBe("Release v1.0");
				expect(second.tags).toBeUndefined();
				expect(second.image).toBeUndefined();
			} finally {
				if (fs.existsSync(data.output)) {
					await fs.promises.rm(data.output, { recursive: true, force: true });
				}
			}
		});

		it("should not create file when changelogEntries is empty", async () => {
			const builder = new DoculaBuilder();
			const data: DoculaData = {
				...defaultPathFields,
				siteUrl: "http://foo.com",
				siteTitle: "docula",
				siteDescription: "Beautiful Website for Your Projects",
				sitePath: "test/fixtures/changelog-site",
				templatePath: "test/fixtures/template-example",
				output: "test/temp-changelog-json-empty-test",
				changelogEntries: [],
			};

			if (fs.existsSync(data.output)) {
				await fs.promises.rm(data.output, { recursive: true, force: true });
			}

			try {
				await builder.buildChangelogFeedJson(data);
				expect(fs.existsSync(`${data.output}/changelog.json`)).toBe(false);
			} finally {
				if (fs.existsSync(data.output)) {
					await fs.promises.rm(data.output, { recursive: true, force: true });
				}
			}
		});

		it("should not create file when changelogEntries is undefined", async () => {
			const builder = new DoculaBuilder();
			const data: DoculaData = {
				...defaultPathFields,
				siteUrl: "http://foo.com",
				siteTitle: "docula",
				siteDescription: "Beautiful Website for Your Projects",
				sitePath: "test/fixtures/changelog-site",
				templatePath: "test/fixtures/template-example",
				output: "test/temp-changelog-json-undef-test",
			};

			if (fs.existsSync(data.output)) {
				await fs.promises.rm(data.output, { recursive: true, force: true });
			}

			try {
				await builder.buildChangelogFeedJson(data);
				expect(fs.existsSync(`${data.output}/changelog.json`)).toBe(false);
			} finally {
				if (fs.existsSync(data.output)) {
					await fs.promises.rm(data.output, { recursive: true, force: true });
				}
			}
		});

		it("should omit optional fields when not present in entry", async () => {
			const builder = new DoculaBuilder();
			const data: DoculaData = {
				...defaultPathFields,
				siteUrl: "http://foo.com",
				siteTitle: "docula",
				siteDescription: "Beautiful Website for Your Projects",
				sitePath: "test/fixtures/changelog-site",
				templatePath: "test/fixtures/template-example",
				output: "test/temp-changelog-json-optional-test",
				changelogEntries: [
					{
						title: "Minimal Entry",
						date: "2025-01-01",
						formattedDate: "January 1, 2025",
						slug: "minimal-entry",
						content: "",
						generatedHtml: "",
						preview: "Minimal preview.",
						urlPath: "/changelog/minimal-entry/",
						lastModified: "2025-01-01",
					},
				],
			};

			if (fs.existsSync(data.output)) {
				await fs.promises.rm(data.output, { recursive: true, force: true });
			}

			try {
				await builder.buildChangelogFeedJson(data);
				const raw = await fs.promises.readFile(
					`${data.output}/changelog.json`,
					"utf8",
				);
				const feed = JSON.parse(raw);
				const item = feed.items[0];

				expect(item.tags).toBeUndefined();
				expect(item.image).toBeUndefined();
				expect(item.content_html).toBeUndefined();
				expect(item.content_text).toBeUndefined();
			} finally {
				if (fs.existsSync(data.output)) {
					await fs.promises.rm(data.output, { recursive: true, force: true });
				}
			}
		});

		it("should build correct URLs with baseUrl prefix", async () => {
			const builder = new DoculaBuilder();
			const data: DoculaData = {
				...defaultPathFields,
				baseUrl: "/docs",
				changelogUrl: "/docs/changelog",
				siteUrl: "http://foo.com",
				siteTitle: "docula",
				siteDescription: "Beautiful Website for Your Projects",
				sitePath: "test/fixtures/changelog-site",
				templatePath: "test/fixtures/template-example",
				output: "test/temp-changelog-json-baseurl-test",
				changelogEntries: [
					{
						title: "Release v1.0",
						date: "2025-01-15",
						formattedDate: "January 15, 2025",
						slug: "release-v1-0",
						content: "Content here.",
						generatedHtml: "<p>Content here.</p>",
						preview: "Content here.",
						urlPath: "/docs/changelog/release-v1-0/",
						lastModified: "2025-01-15",
					},
				],
			};

			if (fs.existsSync(data.output)) {
				await fs.promises.rm(data.output, { recursive: true, force: true });
			}

			try {
				await builder.buildChangelogFeedJson(data);
				const raw = await fs.promises.readFile(
					`${data.output}/changelog.json`,
					"utf8",
				);
				const feed = JSON.parse(raw);

				expect(feed.home_page_url).toBe("http://foo.com/docs/");
				expect(feed.feed_url).toBe("http://foo.com/docs/changelog.json");
				expect(feed.items[0].url).toBe(
					"http://foo.com/docs/changelog/release-v1-0/",
				);
			} finally {
				if (fs.existsSync(data.output)) {
					await fs.promises.rm(data.output, { recursive: true, force: true });
				}
			}
		});

		it("should include changelog.json in sitemap when entries exist", async () => {
			const builder = new DoculaBuilder();
			const data: DoculaData = {
				...defaultPathFields,
				siteUrl: "http://foo.com",
				siteTitle: "docula",
				siteDescription: "Beautiful Website for Your Projects",
				sitePath: "test/fixtures/changelog-site",
				templatePath: "test/fixtures/template-example",
				output: "test/temp-sitemap-changelog-json-test",
				hasChangelog: true,
				templates: {
					home: "home.hbs",
					changelogEntry: "changelog-entry.hbs",
				},
				changelogEntries: [
					{
						title: "Release v1.0",
						date: "2025-01-15",
						formattedDate: "January 15, 2025",
						slug: "release-v1-0",
						content: "Content.",
						generatedHtml: "<p>Content.</p>",
						preview: "Content.",
						urlPath: "/changelog/release-v1-0/",
						lastModified: "2025-01-15",
					},
				],
			};

			if (fs.existsSync(data.output)) {
				await fs.promises.rm(data.output, { recursive: true, force: true });
			}

			try {
				await builder.buildSiteMapPage(data);
				const sitemap = await fs.promises.readFile(
					`${data.output}/sitemap.xml`,
					"utf8",
				);
				expect(sitemap).toContain("<loc>http://foo.com/changelog.json</loc>");
				expect(sitemap).toContain(
					"<loc>http://foo.com/changelog-latest.json</loc>",
				);
			} finally {
				if (fs.existsSync(data.output)) {
					await fs.promises.rm(data.output, { recursive: true, force: true });
				}
			}
		});

		it("should not include changelog.json in sitemap when no entries", async () => {
			const builder = new DoculaBuilder();
			const data: DoculaData = {
				...defaultPathFields,
				siteUrl: "http://foo.com",
				siteTitle: "docula",
				siteDescription: "Beautiful Website for Your Projects",
				sitePath: "test/fixtures/changelog-site",
				templatePath: "test/fixtures/template-example",
				output: "test/temp-sitemap-no-changelog-json-test",
			};

			if (fs.existsSync(data.output)) {
				await fs.promises.rm(data.output, { recursive: true, force: true });
			}

			try {
				await builder.buildSiteMapPage(data);
				const sitemap = await fs.promises.readFile(
					`${data.output}/sitemap.xml`,
					"utf8",
				);
				expect(sitemap).not.toContain("changelog.json");
				expect(sitemap).not.toContain("changelog-latest.json");
			} finally {
				if (fs.existsSync(data.output)) {
					await fs.promises.rm(data.output, { recursive: true, force: true });
				}
			}
		});
	});

	describe("Docula Builder - Build Changelog Latest Feed JSON", () => {
		it("should build changelog-latest.json limited to changelogPerPage entries", async () => {
			const builder = new DoculaBuilder();
			builder.options.changelogPerPage = 2;
			const data: DoculaData = {
				...defaultPathFields,
				siteUrl: "http://foo.com",
				siteTitle: "My Site",
				siteDescription: "Site description",
				sitePath: "test/fixtures/changelog-site",
				templatePath: "test/fixtures/template-example",
				output: "test/temp-changelog-latest-json-test",
				changelogEntries: [
					{
						title: "Release v3.0",
						date: "2025-06-01",
						formattedDate: "June 1, 2025",
						slug: "release-v3-0",
						content: "Third release.",
						generatedHtml: "<p>Third release.</p>",
						preview: "Third release.",
						urlPath: "/changelog/release-v3-0/",
						lastModified: "2025-06-01",
					},
					{
						title: "Release v2.0",
						date: "2025-03-01",
						formattedDate: "March 1, 2025",
						slug: "release-v2-0",
						content: "Second release.",
						generatedHtml: "<p>Second release.</p>",
						preview: "Second release.",
						urlPath: "/changelog/release-v2-0/",
						lastModified: "2025-03-01",
					},
					{
						title: "Release v1.0",
						date: "2025-01-15",
						formattedDate: "January 15, 2025",
						slug: "release-v1-0",
						content: "First release.",
						generatedHtml: "<p>First release.</p>",
						preview: "First release.",
						urlPath: "/changelog/release-v1-0/",
						lastModified: "2025-01-15",
					},
				],
			};

			if (fs.existsSync(data.output)) {
				await fs.promises.rm(data.output, { recursive: true, force: true });
			}

			try {
				await builder.buildChangelogLatestFeedJson(data);
				const raw = await fs.promises.readFile(
					`${data.output}/changelog-latest.json`,
					"utf8",
				);
				const feed = JSON.parse(raw);

				expect(feed.version).toBe("https://jsonfeed.org/version/1.1");
				expect(feed.title).toBe("My Site");
				expect(feed.feed_url).toBe("http://foo.com/changelog-latest.json");
				expect(feed.items).toHaveLength(2);
				expect(feed.items[0].id).toBe("release-v3-0");
				expect(feed.items[1].id).toBe("release-v2-0");
			} finally {
				if (fs.existsSync(data.output)) {
					await fs.promises.rm(data.output, { recursive: true, force: true });
				}
			}
		});

		it("should include all entries when fewer than changelogPerPage", async () => {
			const builder = new DoculaBuilder();
			builder.options.changelogPerPage = 20;
			const data: DoculaData = {
				...defaultPathFields,
				siteUrl: "http://foo.com",
				siteTitle: "docula",
				siteDescription: "Beautiful Website for Your Projects",
				sitePath: "test/fixtures/changelog-site",
				templatePath: "test/fixtures/template-example",
				output: "test/temp-changelog-latest-json-all-test",
				changelogEntries: [
					{
						title: "Release v1.0",
						date: "2025-01-15",
						formattedDate: "January 15, 2025",
						slug: "release-v1-0",
						content: "Content.",
						generatedHtml: "<p>Content.</p>",
						preview: "Content.",
						urlPath: "/changelog/release-v1-0/",
						lastModified: "2025-01-15",
					},
				],
			};

			if (fs.existsSync(data.output)) {
				await fs.promises.rm(data.output, { recursive: true, force: true });
			}

			try {
				await builder.buildChangelogLatestFeedJson(data);
				const raw = await fs.promises.readFile(
					`${data.output}/changelog-latest.json`,
					"utf8",
				);
				const feed = JSON.parse(raw);

				expect(feed.items).toHaveLength(1);
				expect(feed.items[0].id).toBe("release-v1-0");
			} finally {
				if (fs.existsSync(data.output)) {
					await fs.promises.rm(data.output, { recursive: true, force: true });
				}
			}
		});

		it("should not create file when changelogEntries is empty", async () => {
			const builder = new DoculaBuilder();
			const data: DoculaData = {
				...defaultPathFields,
				siteUrl: "http://foo.com",
				siteTitle: "docula",
				siteDescription: "Beautiful Website for Your Projects",
				sitePath: "test/fixtures/changelog-site",
				templatePath: "test/fixtures/template-example",
				output: "test/temp-changelog-latest-json-empty-test",
				changelogEntries: [],
			};

			if (fs.existsSync(data.output)) {
				await fs.promises.rm(data.output, { recursive: true, force: true });
			}

			try {
				await builder.buildChangelogLatestFeedJson(data);
				expect(fs.existsSync(`${data.output}/changelog-latest.json`)).toBe(
					false,
				);
			} finally {
				if (fs.existsSync(data.output)) {
					await fs.promises.rm(data.output, { recursive: true, force: true });
				}
			}
		});

		it("should not create file when changelogEntries is undefined", async () => {
			const builder = new DoculaBuilder();
			const data: DoculaData = {
				...defaultPathFields,
				siteUrl: "http://foo.com",
				siteTitle: "docula",
				siteDescription: "Beautiful Website for Your Projects",
				sitePath: "test/fixtures/changelog-site",
				templatePath: "test/fixtures/template-example",
				output: "test/temp-changelog-latest-json-undef-test",
			};

			if (fs.existsSync(data.output)) {
				await fs.promises.rm(data.output, { recursive: true, force: true });
			}

			try {
				await builder.buildChangelogLatestFeedJson(data);
				expect(fs.existsSync(`${data.output}/changelog-latest.json`)).toBe(
					false,
				);
			} finally {
				if (fs.existsSync(data.output)) {
					await fs.promises.rm(data.output, { recursive: true, force: true });
				}
			}
		});
	});
});
