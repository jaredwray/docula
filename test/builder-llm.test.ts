import fs from "node:fs";
import { CacheableNet } from "@cacheable/net";
import { Hashery } from "hashery";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DoculaBuilder, type DoculaData } from "../src/builder.js";
import {
	getSafeLocalOpenApiSpec,
	getSafeSiteOverrideFileContent,
} from "../src/builder-api.js";
import * as builderUtils from "../src/builder-utils.js";
import { DoculaOptions } from "../src/options.js";

const _testHash = new Hashery();

function _getConsole(builder: DoculaBuilder) {
	// biome-ignore lint/suspicious/noExplicitAny: access internal console for testing
	return (builder as any)._console;
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

describe("DoculaBuilder - LLM", () => {
	const _doculaData: DoculaData = {
		...defaultPathFields,
		siteUrl: "http://foo.com",
		siteTitle: "docula",
		siteDescription: "Beautiful Website for Your Projects",
		sitePath: "test/fixtures/single-page-site",
		templatePath: "test/fixtures/template-example",
		output: "test/temp/sitemap-test",
	};

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

	describe("Docula Builder - LLM Files", () => {
		it("should generate llms.txt and llms-full.txt for docs-only sites", async () => {
			const builder = new DoculaBuilder();
			const output = "test/temp/llms-docs-only";
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
			const output = "test/temp/llms-api-local-spec";
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
			const output = "test/temp/llms-openapi-fallback";
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
			const output = "test/temp/llms-api-no-openapi";
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
			const output = "test/temp/llms-openapi-query-only";
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
			const sitePath = "test/temp/llms-safe-openapi-site";
			const output = "test/temp/llms-safe-openapi-output";
			const externalSpecPath = "test/temp/llms-safe-openapi-external.json";
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
			const sitePath = "test/temp/llms-openapi-symlink-site";
			const output = "test/temp/llms-openapi-symlink-output";
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
			const output = "test/temp/llms-changelog-index";
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
			const output = "test/temp/llms-full-changelog";
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
			const sitePath = "test/temp/custom-llms-site";
			const output = "test/temp/custom-llms-output";
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
			const sitePath = "test/temp/custom-llms-symlink-site";
			const output = "test/temp/custom-llms-symlink-output";
			const externalLlmsPath = "test/temp/custom-llms-symlink-source.txt";
			const externalLlmsFullPath =
				"test/temp/custom-llms-symlink-source-full.txt";
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
			const sitePath = "test/temp/override-boundary-check";

			await fs.promises.rm(sitePath, { recursive: true, force: true });
			await fs.promises.mkdir(sitePath, { recursive: true });
			await fs.promises.writeFile(
				`${sitePath}/llms.txt`,
				"# marker-should-not-be-used",
				"utf8",
			);

			vi.spyOn(builderUtils, "isPathWithinBasePath").mockReturnValue(false);

			try {
				const data: DoculaData = {
					...defaultPathFields,
					siteUrl: "http://foo.com",
					siteTitle: "docula",
					siteDescription: "Beautiful Website for Your Projects",
					sitePath,
					templatePath: "test/fixtures/template-example",
					output: "test/temp/override-boundary-check-output",
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
				await fs.promises.rm("test/temp/override-boundary-check-output", {
					recursive: true,
					force: true,
				});
			}
		});

		it("should return undefined when override realpath lookup fails", async () => {
			const builder = new DoculaBuilder();
			const sitePath = "test/temp/override-realpath-fail";

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
					output: "test/temp/override-realpath-fail-output",
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
				await fs.promises.rm("test/temp/override-realpath-fail-output", {
					recursive: true,
					force: true,
				});
			}
		});

		it("should return undefined when override realpath escapes base path", async () => {
			const sitePath = "test/temp/override-realpath-escape";

			await fs.promises.rm(sitePath, { recursive: true, force: true });
			await fs.promises.mkdir(sitePath, { recursive: true });
			await fs.promises.writeFile(`${sitePath}/llms.txt`, "# marker", "utf8");

			vi.spyOn(builderUtils, "isPathWithinBasePath")
				.mockImplementationOnce(() => true)
				.mockImplementationOnce(() => false);

			try {
				const content = await getSafeSiteOverrideFileContent(
					sitePath,
					"llms.txt",
				);
				expect(content).toBeUndefined();
			} finally {
				await fs.promises.rm(sitePath, { recursive: true, force: true });
			}
		});

		it("should return undefined when OpenAPI realpath lookup fails", async () => {
			const sitePath = "test/temp/openapi-realpath-fail";

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
					output: "test/temp/openapi-realpath-fail-output",
					openApiUrl: "/api/swagger.json",
					hasApi: true,
				};

				const spec = await getSafeLocalOpenApiSpec(data);
				expect(spec).toBeUndefined();
			} finally {
				await fs.promises.rm(sitePath, { recursive: true, force: true });
				await fs.promises.rm("test/temp/openapi-realpath-fail-output", {
					recursive: true,
					force: true,
				});
			}
		});

		it("should return undefined when OpenAPI realpath escapes base path", async () => {
			const sitePath = "test/temp/openapi-realpath-escape";

			await fs.promises.rm(sitePath, { recursive: true, force: true });
			await fs.promises.mkdir(`${sitePath}/api`, { recursive: true });
			await fs.promises.writeFile(
				`${sitePath}/api/swagger.json`,
				'{"openapi":"3.0.0","info":{"title":"spec"}}',
				"utf8",
			);

			vi.spyOn(builderUtils, "isPathWithinBasePath")
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
					output: "test/temp/openapi-realpath-escape-output",
					openApiUrl: "/api/swagger.json",
					hasApi: true,
				};

				const spec = await getSafeLocalOpenApiSpec(data);
				expect(spec).toBeUndefined();
			} finally {
				await fs.promises.rm(sitePath, { recursive: true, force: true });
				await fs.promises.rm("test/temp/openapi-realpath-escape-output", {
					recursive: true,
					force: true,
				});
			}
		});

		it("should skip llms generation when enableLlmsTxt is false", async () => {
			const options = new DoculaOptions();
			options.enableLlmsTxt = false;
			const builder = new DoculaBuilder(options);
			const output = "test/temp/llms-disabled";
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
			const output = "test/temp/sitemap-no-llms";
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
});
