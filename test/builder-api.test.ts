import fs from "node:fs";
import { CacheableNet } from "@cacheable/net";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DoculaBuilder, type DoculaData } from "../src/builder.js";
import { DoculaOptions } from "../src/options.js";

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

describe("DoculaBuilder - API", () => {
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
			"test/fixtures/empty-site",
			"test/fixtures/mega-page-site",
			"test/fixtures/mega-page-site-no-home-page",
		]) {
			try {
				fs.rmSync(`${fixture}/README.md`, { force: true });
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
				output: "test/temp/api-test",
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
				output: "test/temp/api-test-no-url",
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
				output: "test/temp/api-test-no-template",
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
				output: "test/temp/sitemap-api-test",
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
				output: "test/temp/sitemap-no-api-test",
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
			options.output = "test/temp/build-api-test";
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
				options.output = `test/temp/build-api-home-button-${template}`;
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
			options.output = "test/temp/build-api-home-no-template-button";
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
			options.output = "test/temp/build-api-autodetect";
			const builder = new DoculaBuilder(options);
			builder.console.quiet = true;

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
			}
		});
	});

	describe("Docula Builder - buildApiHomePage", () => {
		it("should render API page as index.html when no README and no docs", async () => {
			const options = new DoculaOptions();
			options.output = "test/temp/api-home-test";
			options.sitePath = "test/fixtures/api-only-site";
			options.autoReadme = false;
			const builder = new DoculaBuilder(options);
			builder.console.quiet = true;

			try {
				await builder.build();
				const indexHtml = await fs.promises.readFile(
					`${options.output}/index.html`,
					"utf8",
				);
				expect(indexHtml).toContain("Test API");
			} finally {
				await fs.promises.rm(options.output, { recursive: true, force: true });
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
				output: "test/temp/api-home-error-test",
			};

			await expect(builder.renderApiContent(data)).rejects.toThrow(
				"No API template or openApiUrl found",
			);
		});
	});
});
