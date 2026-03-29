import fs from "node:fs";
import { CacheableNet } from "@cacheable/net";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DoculaBuilder, type DoculaData } from "../src/builder.js";
import {
	buildAllApiPages,
	resolveLocalOpenApiPathForSpec,
	resolveSpecUrl,
} from "../src/builder-api.js";
import { DoculaOptions } from "../src/options.js";
import githubMockContributors from "./fixtures/data-mocks/github-contributors.json";
import githubMockReleases from "./fixtures/data-mocks/github-releases.json";
import { cleanupAfterEach, setupGithubMock } from "./test-helpers.js";

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
		cleanupAfterEach();
	});
	beforeEach(() => {
		setupGithubMock();
	});

	describe("Docula Builder - OpenAPI API Documentation", () => {
		it("should build the API page when openApiUrl is configured", async () => {
			const builder = new DoculaBuilder(
				Object.assign(new DoculaOptions(), { quiet: true }),
			);
			const data: DoculaData = {
				...defaultPathFields,
				siteUrl: "http://foo.com",
				siteTitle: "docula",
				siteDescription: "Beautiful Website for Your Projects",
				sitePath: "test/fixtures/single-page-site",
				templatePath: "templates/classic",
				output: "test/temp/api-test",
				openApiSpecs: [
					{
						name: "API Reference",
						url: "https://petstore.swagger.io/v2/swagger.json",
					},
				],
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
			const builder = new DoculaBuilder(
				Object.assign(new DoculaOptions(), { quiet: true }),
			);
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
			const builder = new DoculaBuilder(
				Object.assign(new DoculaOptions(), { quiet: true }),
			);
			const data: DoculaData = {
				...defaultPathFields,
				siteUrl: "http://foo.com",
				siteTitle: "docula",
				siteDescription: "Beautiful Website for Your Projects",
				sitePath: "test/fixtures/single-page-site",
				templatePath: "templates/classic",
				output: "test/temp/api-test-no-template",
				openApiSpecs: [
					{
						name: "API Reference",
						url: "https://petstore.swagger.io/v2/swagger.json",
					},
				],
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
			const builder = new DoculaBuilder(
				Object.assign(new DoculaOptions(), { quiet: true }),
			);
			const data: DoculaData = {
				...defaultPathFields,
				siteUrl: "http://foo.com",
				siteTitle: "docula",
				siteDescription: "Beautiful Website for Your Projects",
				sitePath: "test/fixtures/single-page-site",
				templatePath: "templates/classic",
				output: "test/temp/sitemap-api-test",
				openApiSpecs: [
					{
						name: "API Reference",
						url: "https://petstore.swagger.io/v2/swagger.json",
					},
				],
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
			const builder = new DoculaBuilder(
				Object.assign(new DoculaOptions(), { quiet: true }),
			);
			const data: DoculaData = {
				...defaultPathFields,
				siteUrl: "http://foo.com",
				siteTitle: "docula",
				siteDescription: "Beautiful Website for Your Projects",
				sitePath: "test/fixtures/single-page-site",
				templatePath: "templates/classic",
				output: "test/temp/sitemap-no-api-test",
				openApiSpecs: [
					{
						name: "API Reference",
						url: "https://petstore.swagger.io/v2/swagger.json",
					},
				],
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
			const builder = new DoculaBuilder(
				Object.assign(new DoculaOptions(), { quiet: true }),
			);
			const templateData = await builder.getTemplates(
				"templates/classic",
				false,
			);
			expect(templateData.api).toBe("api.hbs");
		});

		it("should not get api template when template directory lacks api.hbs", async () => {
			const builder = new DoculaBuilder(
				Object.assign(new DoculaOptions(), { quiet: true }),
			);
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
			const builder = new DoculaBuilder(options, { quiet: true });
			builder.console.quiet = false;
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
				const tempSitePath = `test/temp/api-home-button-${template}-site`;
				fs.cpSync("test/fixtures/multi-page-site", tempSitePath, {
					recursive: true,
					filter: (src) => {
						const base = src.split("/").pop() ?? "";
						return !base.startsWith("dist") && base !== ".cache";
					},
				});
				const options = new DoculaOptions();
				options.quiet = true;
				options.template = template;
				options.sitePath = tempSitePath;
				options.output = `test/temp/build-api-home-button-${template}`;
				options.openApiUrl = "https://petstore.swagger.io/v2/swagger.json";

				const builder = new DoculaBuilder(options, { quiet: true });

				try {
					await builder.build();
					const indexHtml = await fs.promises.readFile(
						`${options.output}/index.html`,
						"utf8",
					);
					expect(indexHtml).toContain('href="/api"');
					expect(indexHtml).toContain("API Reference");
				} finally {
					fs.rmSync(tempSitePath, { recursive: true, force: true });
					await fs.promises.rm(options.output, {
						recursive: true,
						force: true,
					});
				}
			}
		});

		it("should not render API Reference button on home page when api template is missing", async () => {
			const tempSitePath = "test/temp/api-no-template-button-site";
			fs.cpSync("test/fixtures/multi-page-site", tempSitePath, {
				recursive: true,
				filter: (src) => {
					const base = src.split("/").pop() ?? "";
					return !base.startsWith("dist") && base !== ".cache";
				},
			});
			const options = new DoculaOptions();
			options.quiet = true;
			options.templatePath = "test/fixtures/template-example";
			options.sitePath = tempSitePath;
			options.output = "test/temp/build-api-home-no-template-button";
			options.openApiUrl = "https://petstore.swagger.io/v2/swagger.json";

			const builder = new DoculaBuilder(options, { quiet: true });

			try {
				await builder.build();
				const indexHtml = await fs.promises.readFile(
					`${options.output}/index.html`,
					"utf8",
				);
				expect(indexHtml).not.toContain("API Reference");
				expect(indexHtml).not.toContain('href="/api"');
			} finally {
				fs.rmSync(tempSitePath, { recursive: true, force: true });
				await fs.promises.rm(options.output, {
					recursive: true,
					force: true,
				});
			}
		});

		it("should auto-detect api/swagger.json when openApiUrl is not set", async () => {
			const tempSitePath = "test/temp/api-autodetect-site";
			fs.cpSync("test/fixtures/mega-page-site", tempSitePath, {
				recursive: true,
				filter: (src) => {
					const base = src.split("/").pop() ?? "";
					return !base.startsWith("dist") && base !== ".cache";
				},
			});
			const options = new DoculaOptions();
			options.quiet = true;
			options.sitePath = tempSitePath;
			options.output = "test/temp/build-api-autodetect";
			const builder = new DoculaBuilder(options, { quiet: true });

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
				fs.rmSync(tempSitePath, { recursive: true, force: true });
				await fs.promises.rm(options.output, { recursive: true, force: true });
			}
		});
	});

	describe("Docula Builder - buildApiHomePage", () => {
		it("should render API page as index.html when no README and no docs", async () => {
			const tempSitePath = "test/temp/api-home-test-site";
			fs.cpSync("test/fixtures/api-only-site", tempSitePath, {
				recursive: true,
				filter: (src) => {
					const base = src.split("/").pop() ?? "";
					return !base.startsWith("dist") && base !== ".cache";
				},
			});
			const options = new DoculaOptions();
			options.quiet = true;
			options.output = "test/temp/api-home-test";
			options.sitePath = tempSitePath;
			options.autoReadme = false;
			const builder = new DoculaBuilder(options, { quiet: true });

			try {
				await builder.build();
				const indexHtml = await fs.promises.readFile(
					`${options.output}/index.html`,
					"utf8",
				);
				expect(indexHtml).toContain("Test API");
			} finally {
				fs.rmSync(tempSitePath, { recursive: true, force: true });
				await fs.promises.rm(options.output, { recursive: true, force: true });
			}
		});

		it("should throw error when no API template or openApiUrl found", async () => {
			const builder = new DoculaBuilder(
				Object.assign(new DoculaOptions(), { quiet: true }),
			);
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

	describe("Docula Builder - Multiple OpenAPI Specs", () => {
		beforeEach(() => {
			// biome-ignore lint/suspicious/noExplicitAny: test file
			(CacheableNet.prototype.get as any) = vi.fn(async (url: string) => {
				if (url.includes("releases")) {
					return { data: githubMockReleases };
				}

				if (url.includes("contributors")) {
					return { data: githubMockContributors };
				}
			});
		});

		it("should build a single API page with all specs as sections", async () => {
			const tempSitePath = "test/temp/multi-api-specs-site";
			fs.cpSync("test/fixtures/multi-api-site", tempSitePath, {
				recursive: true,
				filter: (src) => {
					const base = src.split("/").pop() ?? "";
					return !base.startsWith("dist") && base !== ".cache";
				},
			});
			const options = new DoculaOptions();
			options.quiet = true;
			options.sitePath = tempSitePath;
			options.output = "test/temp/build-multi-api-specs";
			options.openApiUrl = [
				{
					name: "Petstore API",
					url: "petstore/swagger.json",
				},
				{ name: "Users API", url: "users/swagger.json" },
			];

			const builder = new DoculaBuilder(options, { quiet: true });

			try {
				await builder.build();
				// Single combined API page at /api/index.html
				expect(fs.existsSync(`${options.output}/api/index.html`)).toBe(true);

				const apiPage = await fs.promises.readFile(
					`${options.output}/api/index.html`,
					"utf8",
				);
				// Both specs should appear as sections on the same page
				expect(apiPage).toContain("Petstore API");
				expect(apiPage).toContain("List pets");
				expect(apiPage).toContain("Users API");
				expect(apiPage).toContain("List users");

				// Sidebar should have spec headings
				expect(apiPage).toContain("api-sidebar__spec-heading");
			} finally {
				fs.rmSync(tempSitePath, { recursive: true, force: true });
				await fs.promises.rm(options.output, { recursive: true, force: true });
			}
		});

		it("should auto-detect multiple api/*/swagger.json files", async () => {
			const tempSitePath = "test/temp/multi-api-autodetect-site";
			fs.cpSync("test/fixtures/multi-api-site", tempSitePath, {
				recursive: true,
				filter: (src) => {
					const base = src.split("/").pop() ?? "";
					return !base.startsWith("dist") && base !== ".cache";
				},
			});
			const options = new DoculaOptions();
			options.quiet = true;
			options.sitePath = tempSitePath;
			options.output = "test/temp/build-multi-api-autodetect";

			const builder = new DoculaBuilder(options, { quiet: true });

			try {
				await builder.build();
				// Auto-detected specs should generate a single combined page
				expect(fs.existsSync(`${options.output}/api/index.html`)).toBe(true);
				const apiPage = await fs.promises.readFile(
					`${options.output}/api/index.html`,
					"utf8",
				);
				// Should contain content from both detected specs
				expect(apiPage).toContain("Petstore");
				expect(apiPage).toContain("Users");
			} finally {
				fs.rmSync(tempSitePath, { recursive: true, force: true });
				await fs.promises.rm(options.output, { recursive: true, force: true });
			}
		});

		it("should parse openApiUrl string from options", () => {
			const options = new DoculaOptions({
				openApiUrl: "/api/swagger.json",
			});
			expect(options.openApiUrl).toBe("/api/swagger.json");
		});

		it("should parse openApiUrl array from options", () => {
			const options = new DoculaOptions({
				openApiUrl: [
					{
						name: "Petstore",
						url: "/api/petstore/swagger.json",
						order: 2,
					},
					{
						name: "Users",
						url: "https://example.com/api.json",
						order: 1,
					},
				],
			});
			expect(Array.isArray(options.openApiUrl)).toBe(true);
			const specs = options.openApiUrl as Array<{
				name: string;
				url: string;
				order?: number;
			}>;
			expect(specs).toHaveLength(2);
			expect(specs[0].name).toBe("Petstore");
			expect(specs[0].order).toBe(2);
			expect(specs[1].name).toBe("Users");
			expect(specs[1].order).toBe(1);
		});

		it("should ignore invalid openApiUrl array entries", () => {
			const options = new DoculaOptions({
				openApiUrl: [
					{ name: "Valid", url: "/api.json" },
					{ name: 123, url: "/api.json" }, // name is not string
					{ name: "NoUrl" }, // missing url
				],
			});
			const specs = options.openApiUrl as Array<{ name: string; url: string }>;
			expect(specs).toHaveLength(1);
			expect(specs[0].name).toBe("Valid");
		});

		it("should not set openApiUrl when array is empty", () => {
			const options = new DoculaOptions({
				openApiUrl: [],
			});
			expect(options.openApiUrl).toBeUndefined();
		});

		it("should copy swagger.json to each spec output directory", async () => {
			const tempSitePath = "test/temp/multi-api-copy-site";
			fs.cpSync("test/fixtures/multi-api-site", tempSitePath, {
				recursive: true,
				filter: (src) => {
					const base = src.split("/").pop() ?? "";
					return !base.startsWith("dist") && base !== ".cache";
				},
			});
			const options = new DoculaOptions();
			options.quiet = true;
			options.sitePath = tempSitePath;
			options.output = "test/temp/build-multi-api-copy";
			options.openApiUrl = [
				{
					name: "Petstore API",
					url: "petstore/swagger.json",
				},
				{ name: "Users API", url: "users/swagger.json" },
			];

			const builder = new DoculaBuilder(options, { quiet: true });

			try {
				await builder.build();
				// swagger.json should be copied to each output directory
				expect(
					fs.existsSync(`${options.output}/api/petstore/swagger.json`),
				).toBe(true);
				expect(fs.existsSync(`${options.output}/api/users/swagger.json`)).toBe(
					true,
				);
			} finally {
				fs.rmSync(tempSitePath, { recursive: true, force: true });
				await fs.promises.rm(options.output, { recursive: true, force: true });
			}
		});

		it("should return undefined for remote URL in resolveLocalOpenApiPathForSpec", () => {
			const data = {
				...defaultPathFields,
				sitePath: "test/fixtures/multi-api-site",
			} as DoculaData;
			expect(
				resolveLocalOpenApiPathForSpec(data, "https://example.com/api.json"),
			).toBeUndefined();
		});

		it("should resolve local path for resolveLocalOpenApiPathForSpec", () => {
			const data = {
				...defaultPathFields,
				sitePath: "test/fixtures/multi-api-site",
			} as DoculaData;
			const result = resolveLocalOpenApiPathForSpec(
				data,
				"api/petstore/swagger.json",
			);
			expect(result).toContain("test/fixtures/multi-api-site");
			expect(result).toContain("api/petstore/swagger.json");
		});

		it("should return remote URL as-is from resolveSpecUrl", () => {
			const data = {
				...defaultPathFields,
				siteUrl: "http://foo.com",
			} as DoculaData;
			expect(resolveSpecUrl(data, "https://example.com/api.json")).toBe(
				"https://example.com/api.json",
			);
		});

		it("should resolve local URL in resolveSpecUrl", () => {
			const data = {
				...defaultPathFields,
				siteUrl: "http://foo.com",
			} as DoculaData;
			expect(resolveSpecUrl(data, "api/swagger.json")).toBe(
				"http://foo.com/api/swagger.json",
			);
		});

		it("should early-return from buildAllApiPages when no specs", async () => {
			const { Ecto } = await import("ecto");
			const ecto = new Ecto();
			const data = {
				...defaultPathFields,
				siteUrl: "http://foo.com",
				siteTitle: "test",
				siteDescription: "test",
				sitePath: "test/fixtures/multi-api-site",
				templatePath: "templates/modern",
				output: "test/temp/build-api-noop",
				templates: { home: "home.hbs", api: "api.hbs" },
			} as DoculaData;

			// No openApiSpecs set — should return without error
			await buildAllApiPages(ecto, data);

			// Empty array
			data.openApiSpecs = [];
			await buildAllApiPages(ecto, data);

			// No template
			data.openApiSpecs = [{ name: "Test", url: "swagger.json" }];
			data.templates = { home: "home.hbs" };
			await buildAllApiPages(ecto, data);
		});

		it("should generate multi-spec llms.txt content", async () => {
			const tempSitePath = "test/temp/multi-api-llms-site";
			fs.cpSync("test/fixtures/multi-api-site", tempSitePath, {
				recursive: true,
				filter: (src) => {
					const base = src.split("/").pop() ?? "";
					return !base.startsWith("dist") && base !== ".cache";
				},
			});
			const options = new DoculaOptions();
			options.quiet = true;
			options.sitePath = tempSitePath;
			options.output = "test/temp/build-multi-api-llms";
			options.enableLlmsTxt = true;
			options.openApiUrl = [
				{
					name: "Petstore API",
					url: "petstore/swagger.json",
				},
				{
					name: "Users API",
					url: "users/swagger.json",
				},
			];

			const builder = new DoculaBuilder(options, { quiet: true });

			try {
				await builder.build();
				const llms = await fs.promises.readFile(
					`${options.output}/llms.txt`,
					"utf8",
				);
				expect(llms).toContain("Petstore API");
				expect(llms).toContain("Users API");
				// Single API page URL
				expect(llms).toContain("/api");

				const llmsFull = await fs.promises.readFile(
					`${options.output}/llms-full.txt`,
					"utf8",
				);
				expect(llmsFull).toContain("### Petstore API");
				expect(llmsFull).toContain("### Users API");
				expect(llmsFull).toContain("Petstore API");
				expect(llmsFull).toContain("Users API");
			} finally {
				fs.rmSync(tempSitePath, { recursive: true, force: true });
				await fs.promises.rm(options.output, {
					recursive: true,
					force: true,
				});
			}
		});

		it("should sort specs by order field", async () => {
			const tempSitePath = "test/temp/multi-api-order-site";
			fs.cpSync("test/fixtures/multi-api-site", tempSitePath, {
				recursive: true,
				filter: (src) => {
					const base = src.split("/").pop() ?? "";
					return !base.startsWith("dist") && base !== ".cache";
				},
			});
			const options = new DoculaOptions();
			options.quiet = true;
			options.sitePath = tempSitePath;
			options.output = "test/temp/build-multi-api-order";
			options.openApiUrl = [
				{
					name: "Users API",
					url: "users/swagger.json",
					order: 2,
				},
				{
					name: "Petstore API",
					url: "petstore/swagger.json",
					order: 1,
				},
			];

			const builder = new DoculaBuilder(options, { quiet: true });

			try {
				await builder.build();
				const apiPage = await fs.promises.readFile(
					`${options.output}/api/index.html`,
					"utf8",
				);
				// Petstore (order: 1) should appear before Users (order: 2)
				const petstoreIndex = apiPage.indexOf("Petstore API");
				const usersIndex = apiPage.indexOf("Users API");
				expect(petstoreIndex).toBeLessThan(usersIndex);
			} finally {
				fs.rmSync(tempSitePath, { recursive: true, force: true });
				await fs.promises.rm(options.output, { recursive: true, force: true });
			}
		});
	});
});
