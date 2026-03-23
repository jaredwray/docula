import fs from "node:fs";
import { CacheableNet } from "@cacheable/net";
import { Hashery } from "hashery";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	DoculaBuilder,
	type DoculaChangelogEntry,
	type DoculaData,
} from "../src/builder.js";
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

describe("DoculaBuilder - Changelog", () => {
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

	describe("Docula Builder - Changelog", () => {
		it("should return empty array when changelog directory does not exist", () => {
			const builder = new DoculaBuilder(undefined, { quiet: true });
			const entries = builder.getChangelogEntries(
				"test/fixtures/single-page-site/changelog",
			);
			expect(entries).toStrictEqual([]);
		});

		it("should get changelog entries from changelog directory", () => {
			const builder = new DoculaBuilder(undefined, { quiet: true });
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
			const builder = new DoculaBuilder(undefined, { quiet: true });
			const changelogPath = "test/temp/changelog-mixed-files";
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
			const builder = new DoculaBuilder(undefined, { quiet: true });
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
			const builder = new DoculaBuilder(undefined, { quiet: true });
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
			const builder = new DoculaBuilder(undefined, { quiet: true });
			const entry = builder.parseChangelogEntry(
				"test/fixtures/changelog-site/changelog/2024-11-01-string-date.md",
			);
			expect(entry.title).toBe("String Date Entry");
			expect(entry.date).toBe("Q1 2025");
			expect(entry.slug).toBe("2024-11-01-string-date");
		});

		it("should fall back to filename title when changelog entry has no front matter", async () => {
			const builder = new DoculaBuilder(undefined, { quiet: true });
			const changelogPath = "test/temp/changelog-missing-frontmatter";
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
			const builder = new DoculaBuilder(undefined, { quiet: true });
			const data: DoculaData = {
				...defaultPathFields,
				siteUrl: "http://foo.com",
				siteTitle: "docula",
				siteDescription: "Beautiful Website for Your Projects",
				sitePath: "test/fixtures/changelog-site",
				templatePath: "test/fixtures/template-example",
				output: "test/temp/changelog-test",
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
			const builder = new DoculaBuilder(undefined, { quiet: true });
			const data: DoculaData = {
				...defaultPathFields,
				siteUrl: "http://foo.com",
				siteTitle: "docula",
				siteDescription: "Beautiful Website for Your Projects",
				sitePath: "test/fixtures/changelog-site",
				templatePath: "test/fixtures/template-example",
				output: "test/temp/changelog-entry-test",
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
			const builder = new DoculaBuilder(undefined, { quiet: true });
			const data: DoculaData = {
				...defaultPathFields,
				siteUrl: "http://foo.com",
				siteTitle: "docula",
				siteDescription: "Beautiful Website for Your Projects",
				sitePath: "test/fixtures/single-page-site",
				templatePath: "test/fixtures/template-example",
				output: "test/temp/no-changelog-test",
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
			const builder = new DoculaBuilder(undefined, { quiet: true });
			const data: DoculaData = {
				...defaultPathFields,
				siteUrl: "http://foo.com",
				siteTitle: "docula",
				siteDescription: "Beautiful Website for Your Projects",
				sitePath: "test/fixtures/single-page-site",
				templatePath: "test/fixtures/template-example",
				output: "test/temp/no-changelog-entries-test",
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
			const builder = new DoculaBuilder(undefined, { quiet: true });
			const data: DoculaData = {
				...defaultPathFields,
				siteUrl: "http://foo.com",
				siteTitle: "docula",
				siteDescription: "Beautiful Website for Your Projects",
				sitePath: "test/fixtures/changelog-site",
				templatePath: "test/fixtures/template-example",
				output: "test/temp/sitemap-changelog-test",
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
			const builder = new DoculaBuilder(undefined, { quiet: true });
			const data: DoculaData = {
				...defaultPathFields,
				siteUrl: "http://foo.com",
				siteTitle: "docula",
				siteDescription: "Beautiful Website for Your Projects",
				sitePath: "test/fixtures/changelog-site",
				templatePath: "test/fixtures/template-example",
				output: "test/temp/sitemap-changelog-no-entries-test",
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
			const builder = new DoculaBuilder(undefined, { quiet: true });
			const data: DoculaData = {
				...defaultPathFields,
				siteUrl: "http://foo.com",
				siteTitle: "docula",
				siteDescription: "Beautiful Website for Your Projects",
				sitePath: "test/fixtures/single-page-site",
				templatePath: "test/fixtures/template-example",
				output: "test/temp/sitemap-no-changelog-test",
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
			const builder = new DoculaBuilder(undefined, { quiet: true });
			const templateData = await builder.getTemplates(
				"test/fixtures/template-example/",
				false,
				true,
			);
			expect(templateData.changelog).toBe("changelog.hbs");
			expect(templateData.changelogEntry).toBe("changelog-entry.hbs");
		});

		it("should not get changelog template when hasChangelog is false", async () => {
			const builder = new DoculaBuilder(undefined, { quiet: true });
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
			options.output = "test/temp/build-changelog-test";
			options.sitePath = "test/fixtures/changelog-site";
			const builder = new DoculaBuilder(options, { quiet: true });
			builder.console.quiet = false;
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
			const builder = new DoculaBuilder(undefined, { quiet: true });
			const entry = builder.parseChangelogEntry(
				"test/fixtures/changelog-site/changelog/2025-01-15-new-feature.md",
			);
			expect(entry.preview).toBeTruthy();
			expect(entry.preview).toContain("<");
			// Preview should be rendered HTML from truncated markdown
		});

		it("should generate preview that is shorter than full content for long entries", () => {
			const builder = new DoculaBuilder(undefined, { quiet: true });
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
			const builder = new DoculaBuilder(undefined, { quiet: true });
			const markdown =
				"## What's Changed\n\nSome great new features were added to the project.";
			const preview = builder.generateChangelogPreview(markdown);
			expect(preview).not.toContain("What's Changed");
			expect(preview).toContain("great new features");
		});

		it("should convert markdown links to plain text in preview", () => {
			const builder = new DoculaBuilder(undefined, { quiet: true });
			const markdown =
				"Check out [this link](https://example.com) for more details about the release.";
			const preview = builder.generateChangelogPreview(markdown);
			expect(preview).toContain("this link");
			expect(preview).not.toContain("https://example.com");
		});

		it("should remove all images from preview", () => {
			const builder = new DoculaBuilder(undefined, { quiet: true });
			const markdown =
				"![screenshot](https://example.com/img.png)\n\nHere is the content of the release.";
			const preview = builder.generateChangelogPreview(markdown);
			expect(preview).not.toContain("img.png");
			expect(preview).toContain("content of the release");
		});

		it("should parse previewImage from frontmatter", () => {
			const builder = new DoculaBuilder(undefined, { quiet: true });
			const entry = builder.parseChangelogEntry(
				"test/fixtures/changelog-site/changelog/2025-01-15-new-feature.md",
			);
			// This fixture may or may not have previewImage — just check the field exists on the type
			expect(entry).toHaveProperty("previewImage");
		});

		it("should split on paragraph boundary without ellipsis", () => {
			const builder = new DoculaBuilder(undefined, { quiet: true });
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
			const builder = new DoculaBuilder(undefined, { quiet: true });
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
			const builder = new DoculaBuilder(undefined, { quiet: true });
			const short = "Just a brief note about this release.";
			const preview = builder.generateChangelogPreview(short);
			expect(preview).toContain("brief note");
			expect(preview).not.toContain("...");
		});

		it("should handle empty input", () => {
			const builder = new DoculaBuilder(undefined, { quiet: true });
			const preview = builder.generateChangelogPreview("");
			expect(preview).toBeDefined();
		});

		it("should split at early paragraph break when no break exists past minLength", () => {
			const builder = new DoculaBuilder(undefined, { quiet: true });
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
			const builder = new DoculaBuilder(undefined, { quiet: true });
			// Single long paragraph with no breaks — must fallback to word-boundary truncation
			const longText = "word ".repeat(150);
			const preview = builder.generateChangelogPreview(longText);
			expect(preview).toContain("...");
		});

		it("should build paginated changelog pages", async () => {
			const options = new DoculaOptions();
			options.changelogPerPage = 2;
			options.output = "test/temp/changelog-pagination-test";
			const builder = new DoculaBuilder(options, { quiet: true });

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
			options.output = "test/temp/sitemap-pagination-test";
			const builder = new DoculaBuilder(options, { quiet: true });

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
			const builder = new DoculaBuilder(undefined, { quiet: true });
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
			const builder = new DoculaBuilder(undefined, { quiet: true });
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
			const builder = new DoculaBuilder(undefined, { quiet: true });
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
			const builder = new DoculaBuilder(undefined, { quiet: true });
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
			const builder = new DoculaBuilder(undefined, { quiet: true });
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
			const builder = new DoculaBuilder(undefined, { quiet: true });
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
			const builder = new DoculaBuilder(undefined, { quiet: true });
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
			const builder = new DoculaBuilder(undefined, { quiet: true });
			const entries = builder.getReleasesAsChangelogEntries([]);
			expect(entries).toStrictEqual([]);
		});

		it("should build with enableReleaseChangelog enabled and merge release entries with file entries", async () => {
			const options = new DoculaOptions();
			options.output = "test/temp/build-release-changelog-test";
			options.sitePath = "test/fixtures/changelog-site";
			options.githubPath = "jaredwray/docula";
			options.enableReleaseChangelog = true;
			const builder = new DoculaBuilder(options, { quiet: true });

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
			options.output = "test/temp/build-no-release-changelog-test";
			options.sitePath = "test/fixtures/changelog-site";
			options.enableReleaseChangelog = false;
			const builder = new DoculaBuilder(options, { quiet: true });

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
			options.output = "test/temp/build-no-changelog-pages-test";
			options.sitePath = "test/fixtures/single-page-site";
			options.enableReleaseChangelog = false;
			const builder = new DoculaBuilder(options, { quiet: true });

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
			options.output = "test/temp/build-on-release-changelog-test";
			options.sitePath = "test/fixtures/changelog-site";
			options.githubPath = "jaredwray/docula";
			options.enableReleaseChangelog = true;
			const builder = new DoculaBuilder(options, { quiet: true });

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
			options.output = "test/temp/build-on-release-changelog-async-test";
			options.sitePath = "test/fixtures/changelog-site";
			options.githubPath = "jaredwray/docula";
			options.enableReleaseChangelog = true;
			const builder = new DoculaBuilder(options, { quiet: true });

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
			options.output = "test/temp/build-on-release-changelog-error-test";
			options.sitePath = "test/fixtures/changelog-site";
			options.githubPath = "jaredwray/docula";
			options.enableReleaseChangelog = true;
			const builder = new DoculaBuilder(options, { quiet: true });

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
			options.output = "test/temp/build-no-on-release-changelog-test";
			options.sitePath = "test/fixtures/changelog-site";
			options.githubPath = "jaredwray/docula";
			options.enableReleaseChangelog = true;
			const builder = new DoculaBuilder(options, { quiet: true });

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

	describe("Docula Builder - Build Changelog Feed JSON", () => {
		it("should build changelog.json with valid entries", async () => {
			const builder = new DoculaBuilder(undefined, { quiet: true });
			const data: DoculaData = {
				...defaultPathFields,
				siteUrl: "http://foo.com",
				siteTitle: "My Site",
				siteDescription: "Site description",
				sitePath: "test/fixtures/changelog-site",
				templatePath: "test/fixtures/template-example",
				output: "test/temp/changelog-json-test",
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
			const builder = new DoculaBuilder(undefined, { quiet: true });
			const data: DoculaData = {
				...defaultPathFields,
				siteUrl: "http://foo.com",
				siteTitle: "docula",
				siteDescription: "Beautiful Website for Your Projects",
				sitePath: "test/fixtures/changelog-site",
				templatePath: "test/fixtures/template-example",
				output: "test/temp/changelog-json-empty-test",
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
			const builder = new DoculaBuilder(undefined, { quiet: true });
			const data: DoculaData = {
				...defaultPathFields,
				siteUrl: "http://foo.com",
				siteTitle: "docula",
				siteDescription: "Beautiful Website for Your Projects",
				sitePath: "test/fixtures/changelog-site",
				templatePath: "test/fixtures/template-example",
				output: "test/temp/changelog-json-undef-test",
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
			const builder = new DoculaBuilder(undefined, { quiet: true });
			const data: DoculaData = {
				...defaultPathFields,
				siteUrl: "http://foo.com",
				siteTitle: "docula",
				siteDescription: "Beautiful Website for Your Projects",
				sitePath: "test/fixtures/changelog-site",
				templatePath: "test/fixtures/template-example",
				output: "test/temp/changelog-json-optional-test",
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
			const builder = new DoculaBuilder(undefined, { quiet: true });
			const data: DoculaData = {
				...defaultPathFields,
				baseUrl: "/docs",
				changelogUrl: "/docs/changelog",
				siteUrl: "http://foo.com",
				siteTitle: "docula",
				siteDescription: "Beautiful Website for Your Projects",
				sitePath: "test/fixtures/changelog-site",
				templatePath: "test/fixtures/template-example",
				output: "test/temp/changelog-json-baseurl-test",
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
			const builder = new DoculaBuilder(undefined, { quiet: true });
			const data: DoculaData = {
				...defaultPathFields,
				siteUrl: "http://foo.com",
				siteTitle: "docula",
				siteDescription: "Beautiful Website for Your Projects",
				sitePath: "test/fixtures/changelog-site",
				templatePath: "test/fixtures/template-example",
				output: "test/temp/sitemap-changelog-json-test",
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
			const builder = new DoculaBuilder(undefined, { quiet: true });
			const data: DoculaData = {
				...defaultPathFields,
				siteUrl: "http://foo.com",
				siteTitle: "docula",
				siteDescription: "Beautiful Website for Your Projects",
				sitePath: "test/fixtures/changelog-site",
				templatePath: "test/fixtures/template-example",
				output: "test/temp/sitemap-no-changelog-json-test",
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
			const builder = new DoculaBuilder(undefined, { quiet: true });
			builder.options.changelogPerPage = 2;
			const data: DoculaData = {
				...defaultPathFields,
				siteUrl: "http://foo.com",
				siteTitle: "My Site",
				siteDescription: "Site description",
				sitePath: "test/fixtures/changelog-site",
				templatePath: "test/fixtures/template-example",
				output: "test/temp/changelog-latest-json-test",
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
			const builder = new DoculaBuilder(undefined, { quiet: true });
			builder.options.changelogPerPage = 20;
			const data: DoculaData = {
				...defaultPathFields,
				siteUrl: "http://foo.com",
				siteTitle: "docula",
				siteDescription: "Beautiful Website for Your Projects",
				sitePath: "test/fixtures/changelog-site",
				templatePath: "test/fixtures/template-example",
				output: "test/temp/changelog-latest-json-all-test",
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
			const builder = new DoculaBuilder(undefined, { quiet: true });
			const data: DoculaData = {
				...defaultPathFields,
				siteUrl: "http://foo.com",
				siteTitle: "docula",
				siteDescription: "Beautiful Website for Your Projects",
				sitePath: "test/fixtures/changelog-site",
				templatePath: "test/fixtures/template-example",
				output: "test/temp/changelog-latest-json-empty-test",
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
			const builder = new DoculaBuilder(undefined, { quiet: true });
			const data: DoculaData = {
				...defaultPathFields,
				siteUrl: "http://foo.com",
				siteTitle: "docula",
				siteDescription: "Beautiful Website for Your Projects",
				sitePath: "test/fixtures/changelog-site",
				templatePath: "test/fixtures/template-example",
				output: "test/temp/changelog-latest-json-undef-test",
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
