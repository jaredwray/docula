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

describe("DoculaBuilder - SEO", () => {
	const doculaData: DoculaData = {
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

	describe("Docula Builder - Build Robots and Sitemap", () => {
		it("should build the robots.txt (/robots.txt)", async () => {
			const builder = new DoculaBuilder(undefined, { quiet: true });
			const options = new DoculaOptions();
			options.quiet = true;
			options.sitePath = "test/fixtures/single-page-site";
			options.output = "test/temp/robots-test";

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
			const builder = new DoculaBuilder(undefined, { quiet: true });
			const options = new DoculaOptions();
			options.quiet = true;
			options.sitePath = "test/fixtures/multi-page-site";
			options.output = "test/temp/robots-test-copy";

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
			const builder = new DoculaBuilder(undefined, { quiet: true });
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
			const builder = new DoculaBuilder(undefined, { quiet: true });
			const data: DoculaData = {
				...defaultPathFields,
				siteUrl: "http://foo.com",
				siteTitle: "docula",
				siteDescription: "Beautiful Website for Your Projects",
				sitePath: "test/fixtures/multi-page-site",
				templatePath: "test/fixtures/template-example",
				output: "test/temp/sitemap-feed-test",
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
			const builder = new DoculaBuilder(undefined, { quiet: true });
			const data: DoculaData = {
				...defaultPathFields,
				siteUrl: "http://foo.com",
				siteTitle: "docula & docs",
				siteDescription: "Beautiful <docs> & updates",
				sitePath: "test/fixtures/multi-page-site",
				templatePath: "test/fixtures/template-example",
				output: "test/temp/feed-test",
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
			const builder = new DoculaBuilder(undefined, { quiet: true });
			const data: DoculaData = {
				...defaultPathFields,
				siteUrl: "http://foo.com",
				siteTitle: "docula",
				siteDescription: "Beautiful Website for Your Projects",
				sitePath: "test/fixtures/multi-page-site",
				templatePath: "test/fixtures/template-example",
				output: "test/temp/feed-excerpt-test",
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
			const builder = new DoculaBuilder(undefined, { quiet: true });
			const data: DoculaData = {
				...defaultPathFields,
				siteUrl: "http://foo.com",
				siteTitle: "docula",
				siteDescription: "Beautiful Website for Your Projects",
				sitePath: "test/fixtures/multi-page-site",
				templatePath: "test/fixtures/template-example",
				output: "test/temp/feed-no-toc-test",
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
			const builder = new DoculaBuilder(undefined, { quiet: true });
			const data: DoculaData = {
				...defaultPathFields,
				siteUrl: "http://foo.com",
				siteTitle: "docula",
				siteDescription: "Beautiful Website for Your Projects",
				sitePath: "test/fixtures/multi-page-site",
				templatePath: "test/fixtures/template-example",
				output: "test/temp/feed-hyphen-test",
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
			const builder = new DoculaBuilder(undefined, { quiet: true });
			const data: DoculaData = {
				...defaultPathFields,
				siteUrl: "http://foo.com",
				siteTitle: "docula",
				siteDescription: "Beautiful Website for Your Projects",
				sitePath: "test/fixtures/multi-page-site",
				templatePath: "test/fixtures/template-example",
				output: "test/temp/feed-thematic-break-test",
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
			const builder = new DoculaBuilder(undefined, { quiet: true });
			const data: DoculaData = {
				...defaultPathFields,
				siteUrl: "http://foo.com",
				siteTitle: "docula",
				siteDescription: "Beautiful Website for Your Projects",
				sitePath: "test/fixtures/single-page-site",
				templatePath: "test/fixtures/template-example",
				output: "test/temp/feed-no-docs",
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
			const builder = new DoculaBuilder(undefined, { quiet: true });
			const data: DoculaData = {
				...defaultPathFields,
				siteUrl: "http://foo.com",
				siteTitle: "docula",
				siteDescription: "Beautiful Website for Your Projects",
				sitePath: "test/fixtures/changelog-site",
				templatePath: "test/fixtures/template-example",
				output: "test/temp/feed-scope-test",
				openApiSpecs: [{ name: "API Reference", url: "/api/swagger.json" }],
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
			const builder = new DoculaBuilder(undefined, { quiet: true });
			const data = doculaData;
			data.templates = {
				home: "home.hbs",
			};
			data.sitePath = "site";
			data.templatePath = "test/fixtures/template-example";
			data.output = "test/temp/index-test";

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
			const builder = new DoculaBuilder(undefined, { quiet: true });
			const data = doculaData;
			data.sitePath = "template";
			data.output = "test/temp/index-test";
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

	describe("Docula Builder - resolveOpenGraphData", () => {
		it("should return empty object when openGraph is not configured", () => {
			const builder = new DoculaBuilder(undefined, { quiet: true });
			const data: DoculaData = {
				...defaultPathFields,
				siteUrl: "https://example.com",
				siteTitle: "Test Site",
				siteDescription: "Test Description",
				sitePath: "",
				templatePath: "",
				output: "",
			};
			expect(builder.resolveOpenGraphData(data, "/")).toEqual({});
		});

		it("should return resolved OG data with site defaults", () => {
			const builder = new DoculaBuilder(undefined, { quiet: true });
			const data: DoculaData = {
				...defaultPathFields,
				siteUrl: "https://example.com",
				siteTitle: "Test Site",
				siteDescription: "Test Description",
				sitePath: "",
				templatePath: "",
				output: "",
				openGraph: {},
			};
			const result = builder.resolveOpenGraphData(data, "/");
			expect(result.ogTitle).toBe("Test Site");
			expect(result.ogDescription).toBe("Test Description");
			expect(result.ogUrl).toBe("https://example.com/");
			expect(result.ogType).toBe("website");
			expect(result.ogSiteName).toBe("Test Site");
			expect(result.ogTwitterCard).toBe("summary");
			expect(result.ogImage).toBeUndefined();
		});

		it("should use openGraph config values over site defaults", () => {
			const builder = new DoculaBuilder(undefined, { quiet: true });
			const data: DoculaData = {
				...defaultPathFields,
				siteUrl: "https://example.com",
				siteTitle: "Test Site",
				siteDescription: "Test Description",
				sitePath: "",
				templatePath: "",
				output: "",
				openGraph: {
					title: "OG Title",
					description: "OG Desc",
					image: "https://example.com/og.png",
					type: "article",
					siteName: "OG Site",
					twitterCard: "summary_large_image",
				},
			};
			const result = builder.resolveOpenGraphData(data, "/");
			expect(result.ogTitle).toBe("OG Site - OG Title");
			expect(result.ogDescription).toBe("OG Desc");
			expect(result.ogImage).toBe("https://example.com/og.png");
			expect(result.ogUrl).toBe("https://example.com/");
			expect(result.ogType).toBe("article");
			expect(result.ogSiteName).toBe("OG Site");
			expect(result.ogTwitterCard).toBe("summary_large_image");
		});

		it("should use document-level ogTitle/ogDescription/ogImage over site openGraph", () => {
			const builder = new DoculaBuilder(undefined, { quiet: true });
			const data: DoculaData = {
				...defaultPathFields,
				siteUrl: "https://example.com",
				siteTitle: "Test Site",
				siteDescription: "Test Description",
				sitePath: "",
				templatePath: "",
				output: "",
				openGraph: {
					title: "Site OG Title",
					description: "Site OG Desc",
					image: "https://example.com/site-og.png",
				},
			};
			const pageData = {
				ogTitle: "Page OG Title",
				ogDescription: "Page OG Desc",
				ogImage: "https://example.com/page-og.png",
			};
			const result = builder.resolveOpenGraphData(
				data,
				"/docs/test/",
				pageData,
			);
			expect(result.ogTitle).toBe("Test Site - Page OG Title");
			expect(result.ogDescription).toBe("Page OG Desc");
			expect(result.ogImage).toBe("https://example.com/page-og.png");
			expect(result.ogUrl).toBe("https://example.com/docs/test/");
		});

		it("should fall back to page title/description when openGraph config fields are not set", () => {
			const builder = new DoculaBuilder(undefined, { quiet: true });
			const data: DoculaData = {
				...defaultPathFields,
				siteUrl: "https://example.com",
				siteTitle: "Test Site",
				siteDescription: "Test Description",
				sitePath: "",
				templatePath: "",
				output: "",
				openGraph: {},
			};
			const pageData = {
				title: "Page Title",
				description: "Page Description",
			};
			const result = builder.resolveOpenGraphData(
				data,
				"/docs/page/",
				pageData,
			);
			expect(result.ogTitle).toBe("Test Site - Page Title");
			expect(result.ogDescription).toBe("Page Description");
		});

		it("should use previewImage as fallback for ogImage", () => {
			const builder = new DoculaBuilder(undefined, { quiet: true });
			const data: DoculaData = {
				...defaultPathFields,
				siteUrl: "https://example.com",
				siteTitle: "Test Site",
				siteDescription: "Test Description",
				sitePath: "",
				templatePath: "",
				output: "",
				openGraph: {},
			};
			const pageData = {
				previewImage: "https://example.com/preview.png",
			};
			const result = builder.resolveOpenGraphData(
				data,
				"/changelog/entry/",
				pageData,
			);
			expect(result.ogImage).toBe("https://example.com/preview.png");
			expect(result.ogTwitterCard).toBe("summary_large_image");
		});

		it("should use preview as fallback for ogDescription (changelog entries)", () => {
			const builder = new DoculaBuilder(undefined, { quiet: true });
			const data: DoculaData = {
				...defaultPathFields,
				siteUrl: "https://example.com",
				siteTitle: "Test Site",
				siteDescription: "Test Description",
				sitePath: "",
				templatePath: "",
				output: "",
				openGraph: {},
			};
			const pageData = {
				preview: "Changelog entry preview text",
			};
			const result = builder.resolveOpenGraphData(
				data,
				"/changelog/entry/",
				pageData,
			);
			expect(result.ogDescription).toBe("Changelog entry preview text");
		});

		it("should construct ogUrl from siteUrl, baseUrl, and pageUrl", () => {
			const builder = new DoculaBuilder(undefined, { quiet: true });
			const data: DoculaData = {
				...defaultPathFields,
				siteUrl: "https://example.com",
				siteTitle: "Test Site",
				siteDescription: "Test Description",
				sitePath: "",
				templatePath: "",
				output: "",
				baseUrl: "/docs",
				openGraph: {},
			};
			const result = builder.resolveOpenGraphData(data, "/api/");
			expect(result.ogUrl).toBe("https://example.com/docs/api/");
		});

		it("should set twitterCard to summary when no image is present", () => {
			const builder = new DoculaBuilder(undefined, { quiet: true });
			const data: DoculaData = {
				...defaultPathFields,
				siteUrl: "https://example.com",
				siteTitle: "Test Site",
				siteDescription: "Test Description",
				sitePath: "",
				templatePath: "",
				output: "",
				openGraph: {},
			};
			const result = builder.resolveOpenGraphData(data, "/");
			expect(result.ogTwitterCard).toBe("summary");
		});

		it("should not duplicate site name when title equals siteTitle", () => {
			const builder = new DoculaBuilder(undefined, { quiet: true });
			const data: DoculaData = {
				...defaultPathFields,
				siteUrl: "https://example.com",
				siteTitle: "Test Site",
				siteDescription: "Test Description",
				sitePath: "",
				templatePath: "",
				output: "",
				openGraph: {},
			};
			const result = builder.resolveOpenGraphData(data, "/");
			expect(result.ogTitle).toBe("Test Site");
		});

		it("should use ogSiteName as prefix when openGraph.siteName is set", () => {
			const builder = new DoculaBuilder(undefined, { quiet: true });
			const data: DoculaData = {
				...defaultPathFields,
				siteUrl: "https://example.com",
				siteTitle: "Test Site",
				siteDescription: "Test Description",
				sitePath: "",
				templatePath: "",
				output: "",
				openGraph: {
					siteName: "Brand",
				},
			};
			const pageData = {
				title: "Guide",
			};
			const result = builder.resolveOpenGraphData(
				data,
				"/docs/guide/",
				pageData,
			);
			expect(result.ogTitle).toBe("Brand - Guide");
		});
	});

	describe("Docula Builder - resolveJsonLd", () => {
		const baseData: DoculaData = {
			...defaultPathFields,
			siteUrl: "https://example.com",
			siteTitle: "Test Site",
			siteDescription: "Test Description",
			sitePath: "",
			templatePath: "",
			output: "",
		};

		it("should generate WebSite schema for home page", () => {
			const builder = new DoculaBuilder(undefined, { quiet: true });
			const result = builder.resolveJsonLd("home", baseData, "/");
			expect(result).toContain('<script type="application/ld+json">');
			expect(result).toContain("</script>");
			const json = JSON.parse(
				result
					.replace('<script type="application/ld+json">\n', "")
					.replace("\n</script>", ""),
			);
			expect(json["@context"]).toBe("https://schema.org");
			expect(json["@type"]).toBe("WebSite");
			expect(json.name).toBe("Test Site");
			expect(json.description).toBe("Test Description");
			expect(json.url).toBe("https://example.com/");
		});

		it("should generate TechArticle schema for docs page", () => {
			const builder = new DoculaBuilder(undefined, { quiet: true });
			const pageData = {
				title: "Getting Started",
				description: "Learn how to use the tool",
				lastModified: "2024-01-15",
				keywords: ["docs", "tutorial"],
			};
			const result = builder.resolveJsonLd(
				"docs",
				baseData,
				"/docs/getting-started/",
				pageData,
			);
			const json = JSON.parse(
				result
					.replace('<script type="application/ld+json">\n', "")
					.replace("\n</script>", ""),
			);
			expect(json["@type"]).toBe("TechArticle");
			expect(json.headline).toBe("Getting Started");
			expect(json.description).toBe("Learn how to use the tool");
			expect(json.dateModified).toBe("2024-01-15");
			expect(json.keywords).toEqual(["docs", "tutorial"]);
			expect(json.url).toBe("https://example.com/docs/getting-started/");
			expect(json.publisher).toEqual({
				"@type": "Organization",
				name: "Test Site",
			});
		});

		it("should generate TechArticle without dateModified when lastModified is missing", () => {
			const builder = new DoculaBuilder(undefined, { quiet: true });
			const pageData = {
				title: "Page",
				description: "Desc",
			};
			const result = builder.resolveJsonLd(
				"docs",
				baseData,
				"/docs/page/",
				pageData,
			);
			const json = JSON.parse(
				result
					.replace('<script type="application/ld+json">\n', "")
					.replace("\n</script>", ""),
			);
			expect(json.dateModified).toBeUndefined();
			expect(json.keywords).toBeUndefined();
		});

		it("should fall back to site defaults for docs without page data", () => {
			const builder = new DoculaBuilder(undefined, { quiet: true });
			const result = builder.resolveJsonLd("docs", baseData, "/docs/page/");
			const json = JSON.parse(
				result
					.replace('<script type="application/ld+json">\n', "")
					.replace("\n</script>", ""),
			);
			expect(json.headline).toBe("Test Site");
			expect(json.description).toBe("Test Description");
		});

		it("should generate WebPage schema for api page", () => {
			const builder = new DoculaBuilder(undefined, { quiet: true });
			const result = builder.resolveJsonLd("api", baseData, "/api/");
			const json = JSON.parse(
				result
					.replace('<script type="application/ld+json">\n', "")
					.replace("\n</script>", ""),
			);
			expect(json["@type"]).toBe("WebPage");
			expect(json.name).toBe("API Reference - Test Site");
			expect(json.description).toBe("API Reference for Test Site");
			expect(json.url).toBe("https://example.com/api/");
		});

		it("should generate CollectionPage schema for changelog page", () => {
			const builder = new DoculaBuilder(undefined, { quiet: true });
			const result = builder.resolveJsonLd(
				"changelog",
				baseData,
				"/changelog/",
			);
			const json = JSON.parse(
				result
					.replace('<script type="application/ld+json">\n', "")
					.replace("\n</script>", ""),
			);
			expect(json["@type"]).toBe("CollectionPage");
			expect(json.name).toBe("Test Site Changelog");
			expect(json.description).toBe("Changelog for Test Site");
			expect(json.url).toBe("https://example.com/changelog/");
		});

		it("should generate BlogPosting schema for changelog entry", () => {
			const builder = new DoculaBuilder(undefined, { quiet: true });
			const pageData = {
				title: "v2.0 Release",
				date: "2024-03-01",
				preview: "Major release with new features",
				previewImage: "https://example.com/v2.png",
			};
			const result = builder.resolveJsonLd(
				"changelog-entry",
				baseData,
				"/changelog/v2-release/",
				pageData,
			);
			const json = JSON.parse(
				result
					.replace('<script type="application/ld+json">\n', "")
					.replace("\n</script>", ""),
			);
			expect(json["@type"]).toBe("BlogPosting");
			expect(json.headline).toBe("v2.0 Release");
			expect(json.description).toBe("Major release with new features");
			expect(json.datePublished).toBe("2024-03-01");
			expect(json.image).toBe("https://example.com/v2.png");
			expect(json.url).toBe("https://example.com/changelog/v2-release/");
			expect(json.publisher).toEqual({
				"@type": "Organization",
				name: "Test Site",
			});
		});

		it("should generate BlogPosting without optional fields when missing", () => {
			const builder = new DoculaBuilder(undefined, { quiet: true });
			const pageData = {
				title: "Update",
			};
			const result = builder.resolveJsonLd(
				"changelog-entry",
				baseData,
				"/changelog/update/",
				pageData,
			);
			const json = JSON.parse(
				result
					.replace('<script type="application/ld+json">\n', "")
					.replace("\n</script>", ""),
			);
			expect(json.datePublished).toBeUndefined();
			expect(json.image).toBeUndefined();
		});

		it("should respect baseUrl in generated URLs", () => {
			const builder = new DoculaBuilder(undefined, { quiet: true });
			const dataWithBase = { ...baseData, baseUrl: "/project" };
			const result = builder.resolveJsonLd("home", dataWithBase, "/");
			const json = JSON.parse(
				result
					.replace('<script type="application/ld+json">\n', "")
					.replace("\n</script>", ""),
			);
			expect(json.url).toBe("https://example.com/project/");
		});

		it("should return empty string for changelog-entry with no title", () => {
			const builder = new DoculaBuilder(undefined, { quiet: true });
			const result = builder.resolveJsonLd(
				"changelog-entry",
				baseData,
				"/changelog/entry/",
			);
			expect(result).toBe("");
		});

		it("should return empty string for changelog-entry with empty title", () => {
			const builder = new DoculaBuilder(undefined, { quiet: true });
			const result = builder.resolveJsonLd(
				"changelog-entry",
				baseData,
				"/changelog/entry/",
				{ title: "" },
			);
			expect(result).toBe("");
		});

		it("should properly escape special characters in JSON", () => {
			const builder = new DoculaBuilder(undefined, { quiet: true });
			const dataWithSpecialChars = {
				...baseData,
				siteTitle: 'Test "Site" <br>',
				siteDescription: "Description with 'quotes' & ampersands",
			};
			const result = builder.resolveJsonLd("home", dataWithSpecialChars, "/");
			// Should not throw when parsing
			const json = JSON.parse(
				result
					.replace('<script type="application/ld+json">\n', "")
					.replace("\n</script>", ""),
			);
			expect(json.name).toBe('Test "Site" <br>');
			expect(json.description).toBe("Description with 'quotes' & ampersands");
		});
	});
});
