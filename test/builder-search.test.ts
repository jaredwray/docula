import fs from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import { DoculaBuilder, type DoculaData } from "../src/builder.js";
import {
	buildSearchIndex,
	decodeEntities,
	extractSections,
	generateSearchRecords,
	SEARCH_INDEX_FILENAME,
	stripHtml,
	stripIndexHtml,
} from "../src/builder-search.js";
import { DoculaConsole } from "../src/console.js";
import { DoculaOptions } from "../src/options.js";
import type { DoculaChangelogEntry, DoculaDocument } from "../src/types.js";
import { removeTempDirAsync } from "./test-helpers.js";

const defaultPathFields = {
	baseUrl: "",
	docsPath: "docs",
	apiPath: "api",
	changelogPath: "changelog",
	docsUrl: "/docs",
	apiUrl: "/api",
	changelogUrl: "/changelog",
};

const baseData: DoculaData = {
	...defaultPathFields,
	siteUrl: "http://foo.com",
	siteTitle: "docula",
	siteDescription: "Beautiful Website for Your Projects",
	sitePath: "test/fixtures/single-page-site",
	templatePath: "test/fixtures/template-example",
	output: "test/temp/search-test",
};

function makeDocument(overrides: Partial<DoculaDocument>): DoculaDocument {
	return {
		title: "Title",
		navTitle: "Title",
		description: "",
		keywords: [],
		content: "",
		markdown: "",
		generatedHtml: "",
		documentPath: "docs/title.md",
		urlPath: "/docs/title/index.html",
		isRoot: false,
		lastModified: "2024-01-01",
		...overrides,
	};
}

function makeChangelogEntry(
	overrides: Partial<DoculaChangelogEntry>,
): DoculaChangelogEntry {
	return {
		title: "Release",
		date: "2024-01-01",
		formattedDate: "January 1, 2024",
		slug: "release",
		content: "",
		generatedHtml: "",
		preview: "",
		urlPath: "/changelog/release/index.html",
		lastModified: "2024-01-01",
		...overrides,
	};
}

describe("builder-search", () => {
	describe("decodeEntities", () => {
		it("decodes common named entities", () => {
			expect(
				decodeEntities("a &amp; b &lt;c&gt; &quot;d&quot; &#39;e&#39;"),
			).toBe(`a & b <c> "d" 'e'`);
			expect(decodeEntities("x&nbsp;y")).toBe("x y");
		});

		it("decodes decimal and hexadecimal entities (upper and lower x)", () => {
			expect(decodeEntities("&#8212;")).toBe("—");
			expect(decodeEntities("&#x2014;")).toBe("—");
			expect(decodeEntities("&#X2014;")).toBe("—");
		});

		it("leaves unknown named entities untouched", () => {
			expect(decodeEntities("&foobar;")).toBe("&foobar;");
		});

		it("leaves numeric entities that parse to NaN untouched", () => {
			// Matches the numeric regex branch but base-10 parse yields NaN.
			expect(decodeEntities("&#abc;")).toBe("&#abc;");
		});

		it("leaves out-of-range code points untouched", () => {
			// 0x110000 is above the maximum Unicode code point and throws.
			expect(decodeEntities("&#1114112;")).toBe("&#1114112;");
		});
	});

	describe("stripHtml", () => {
		it("returns an empty string for empty input", () => {
			expect(stripHtml("")).toBe("");
		});

		it("removes script and style blocks, tolerating whitespace in end tags", () => {
			expect(
				stripHtml(
					"<style>.a{color:red}</style><p>Hello</p><script>var x = 1 < 2;</script>",
				),
			).toBe("Hello");
			// End tags with whitespace, newlines, or bogus attributes are stripped.
			expect(
				stripHtml(
					'<p>Hi</p><script type="text/javascript">alert(1)</script\t\n bar><style>.b{}</style foo>',
				),
			).toBe("Hi");
		});

		it("strips HTML comments, including comments containing '>'", () => {
			expect(stripHtml("<p>Visible</p><!-- if x > y then hide -->")).toBe(
				"Visible",
			);
		});

		it("strips tags, decodes entities, and collapses whitespace", () => {
			const html = "<h2>Hi   <b>there</b></h2>\n<p>a &amp; b</p>";
			expect(stripHtml(html)).toBe("Hi there a & b");
		});
	});

	describe("stripIndexHtml", () => {
		it("removes a trailing index.html", () => {
			expect(stripIndexHtml("/docs/config/index.html")).toBe("/docs/config/");
			expect(stripIndexHtml("/docs/index.html")).toBe("/docs/");
		});

		it("leaves paths without a trailing index.html unchanged", () => {
			expect(stripIndexHtml("/docs/config/")).toBe("/docs/config/");
		});
	});

	describe("extractSections", () => {
		it("returns a single page record when there are no headings", () => {
			const records = extractSections(
				"<p>Just some intro text.</p>",
				"Page",
				"/docs/page/",
			);
			expect(records).toHaveLength(1);
			expect(records[0]).toMatchObject({
				id: "/docs/page/",
				title: "Page",
				titles: [],
				text: "Just some intro text.",
				url: "/docs/page/",
			});
		});

		it("handles missing html defensively", () => {
			const records = extractSections(
				undefined as unknown as string,
				"Page",
				"/docs/page/",
			);
			expect(records).toEqual([
				{
					id: "/docs/page/",
					title: "Page",
					titles: [],
					text: "",
					url: "/docs/page/",
				},
			]);
		});

		it("creates one record per heading with anchored urls and breadcrumbs", () => {
			const html = [
				"<p>Intro paragraph.</p>",
				'<h2 id="first">First Section</h2>',
				"<p>First body.</p>",
				'<h3 id="nested">Nested</h3>',
				"<p>Nested body.</p>",
				'<h2 id="second">Second Section</h2>',
				"<p>Second body.</p>",
			].join("\n");

			const records = extractSections(html, "Page Title", "/docs/page/");

			expect(records).toHaveLength(4);
			// Intro / page record
			expect(records[0]).toMatchObject({
				title: "Page Title",
				titles: [],
				url: "/docs/page/",
				text: "Intro paragraph.",
			});
			// First section
			expect(records[1]).toMatchObject({
				title: "First Section",
				titles: ["Page Title"],
				url: "/docs/page/#first",
				text: "First body.",
			});
			// Nested heading carries its parent in the breadcrumb
			expect(records[2]).toMatchObject({
				title: "Nested",
				titles: ["Page Title", "First Section"],
				url: "/docs/page/#nested",
				text: "Nested body.",
			});
			// Sibling h2 resets back to just the page title (stack pop)
			expect(records[3]).toMatchObject({
				title: "Second Section",
				titles: ["Page Title"],
				url: "/docs/page/#second",
				text: "Second body.",
			});
		});

		it("skips the Table of Contents section by anchor or by title", () => {
			const byAnchor = extractSections(
				'<h2 id="table-of-contents">Contents</h2><ul><li>x</li></ul><h2 id="real">Real</h2><p>Body.</p>',
				"Page",
				"/docs/page/",
			);
			expect(byAnchor.map((r) => r.title)).toEqual(["Page", "Real"]);

			const byTitle = extractSections(
				'<h2 id="custom-toc">Table of Contents</h2><ul><li>x</li></ul><h2 id="real">Real</h2><p>Body.</p>',
				"Page",
				"/docs/page/",
			);
			expect(byTitle.map((r) => r.title)).toEqual(["Page", "Real"]);
		});
	});

	describe("generateSearchRecords", () => {
		it("returns an empty array when there is no content", () => {
			expect(generateSearchRecords({ ...baseData })).toEqual([]);
		});

		it("indexes documents and prefixes urls with the baseUrl", () => {
			const data: DoculaData = {
				...baseData,
				baseUrl: "/base",
				documents: [
					makeDocument({
						navTitle: "Config",
						generatedHtml:
							'<p>Intro.</p><h2 id="opts">Options</h2><p>Body.</p>',
						urlPath: "/docs/config/index.html",
					}),
				],
			};

			const records = generateSearchRecords(data);
			expect(records).toHaveLength(2);
			expect(records[0].url).toBe("/base/docs/config/");
			expect(records[1].url).toBe("/base/docs/config/#opts");
			expect(records[1].titles).toEqual(["Config"]);
		});

		it("falls back through navTitle, title, then Untitled", () => {
			const data: DoculaData = {
				...baseData,
				documents: [
					makeDocument({
						navTitle: "",
						title: "OnlyTitle",
						generatedHtml: "<p>a</p>",
					}),
					makeDocument({ navTitle: "", title: "", generatedHtml: "<p>b</p>" }),
				],
			};

			const records = generateSearchRecords(data);
			expect(records[0].title).toBe("OnlyTitle");
			expect(records[1].title).toBe("Untitled");
		});

		it("indexes published changelog entries and skips drafts", () => {
			const data: DoculaData = {
				...baseData,
				changelogEntries: [
					makeChangelogEntry({
						title: "Shipped",
						generatedHtml: "<p>We shipped a thing.</p>",
						urlPath: "/changelog/shipped/index.html",
					}),
					makeChangelogEntry({
						title: "Secret",
						draft: true,
						generatedHtml: "<p>Not public yet.</p>",
						urlPath: "/changelog/secret/index.html",
					}),
				],
			};

			const records = generateSearchRecords(data);
			expect(records).toHaveLength(1);
			expect(records[0]).toMatchObject({
				title: "Shipped",
				url: "/changelog/shipped/",
				text: "We shipped a thing.",
			});
		});

		it("uses Untitled for changelog entries without a title", () => {
			const data: DoculaData = {
				...baseData,
				changelogEntries: [
					makeChangelogEntry({ title: "", generatedHtml: "<p>x</p>" }),
				],
			};
			expect(generateSearchRecords(data)[0].title).toBe("Untitled");
		});
	});

	describe("buildSearchIndex", () => {
		const console = new DoculaConsole();
		console.quiet = true;

		afterEach(async () => {
			await removeTempDirAsync("test/temp/search-test");
			await removeTempDirAsync("test/temp/search-disabled");
		});

		it("does not write a file when search is disabled", async () => {
			const output = "test/temp/search-disabled";
			await buildSearchIndex(console, {
				...baseData,
				output,
				enableSearch: false,
				documents: [makeDocument({ generatedHtml: "<p>x</p>" })],
			});
			expect(fs.existsSync(`${output}/${SEARCH_INDEX_FILENAME}`)).toBe(false);
		});

		it("writes the search index json when enabled", async () => {
			const output = "test/temp/search-test";
			await buildSearchIndex(console, {
				...baseData,
				output,
				enableSearch: true,
				documents: [
					makeDocument({
						navTitle: "Config",
						generatedHtml:
							'<p>Intro.</p><h2 id="opts">Options</h2><p>Body.</p>',
						urlPath: "/docs/config/index.html",
					}),
				],
			});

			const filePath = `${output}/${SEARCH_INDEX_FILENAME}`;
			expect(fs.existsSync(filePath)).toBe(true);

			const parsed = JSON.parse(
				await fs.promises.readFile(filePath, "utf8"),
			) as {
				records: Array<{ title: string; url: string }>;
			};
			expect(parsed.records).toHaveLength(2);
			expect(parsed.records[0].title).toBe("Config");
			expect(parsed.records[1].url).toBe("/docs/config/#opts");
		});
	});

	describe("DoculaBuilder integration", () => {
		afterEach(async () => {
			await removeTempDirAsync("test/temp/search-builder");
		});

		it("builds a search index from real parsed documents", async () => {
			const builder = new DoculaBuilder(
				Object.assign(new DoculaOptions(), { quiet: true }),
			);
			const output = "test/temp/search-builder";
			const data: DoculaData = {
				...baseData,
				output,
				enableSearch: true,
			};
			data.documents = builder.getDocuments(
				"test/fixtures/multi-page-site/docs",
				data,
			);

			await builder.buildSearchIndex(data);

			const filePath = `${output}/${SEARCH_INDEX_FILENAME}`;
			expect(fs.existsSync(filePath)).toBe(true);
			const parsed = JSON.parse(
				await fs.promises.readFile(filePath, "utf8"),
			) as {
				records: unknown[];
			};
			expect(parsed.records.length).toBeGreaterThan(0);
		});
	});
});
