import fs from "node:fs";
import { CacheableNet } from "@cacheable/net";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	DoculaBuilder,
	type DoculaData,
	type DoculaDocument,
	type DoculaSection,
} from "../src/builder.js";
import { DoculaOptions } from "../src/options.js";

import githubMockContributors from "./fixtures/data-mocks/github-contributors.json";
import githubMockReleases from "./fixtures/data-mocks/github-releases.json";

vi.mock("@cacheable/net");

const defaultPathFields = {
	homeUrl: "/",
	baseUrl: "",
	docsPath: "docs",
	apiPath: "api",
	changelogPath: "changelog",
	docsUrl: "/docs",
	apiUrl: "/api",
	changelogUrl: "/changelog",
};

describe("DoculaBuilder - Documents", () => {
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
		vi.resetAllMocks();
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

			return { data: {} };
		});
	});

	describe("Docula Builder - Build Docs", () => {
		it("should build the docs pages", async () => {
			const builder = new DoculaBuilder(
				Object.assign(new DoculaOptions(), { quiet: true }),
			);
			const data = doculaData;
			data.templates = {
				home: "home.hbs",

				docPage: "docs.hbs",
			};
			data.sitePath = "site";
			data.templatePath = "test/fixtures/template-example";
			data.output = "test/temp/index-test";
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
			const builder = new DoculaBuilder(
				Object.assign(new DoculaOptions(), { quiet: true }),
			);
			const data = doculaData;
			data.templates = undefined;
			data.sitePath = "site";
			data.templatePath = "test/fixtures/no-template-example";
			data.output = "test/temp/index-test";

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
			const builder = new DoculaBuilder(
				Object.assign(new DoculaOptions(), { quiet: true }),
			);
			const documentsPath = "test/fixtures/mega-page-site/docs";
			const documents = builder.getDocumentInDirectory(
				documentsPath,
				documentsPath,
			);
			expect(documents.length).toBe(3);
		});
		it("should get all the documents from the mega fixtures", () => {
			const builder = new DoculaBuilder(
				Object.assign(new DoculaOptions(), { quiet: true }),
			);
			const doculaData: DoculaData = {
				...defaultPathFields,
				siteUrl: "http://foo.com",
				siteTitle: "docula",
				siteDescription: "Beautiful Website for Your Projects",
				sitePath: "test/fixtures/mega-page-site",
				templatePath: "test/fixtures/template-example",
				output: "test/temp/sitemap-test",
			};
			const documentsPath = "test/fixtures/mega-page-site/docs";
			const documents = builder.getDocuments(documentsPath, doculaData);
			expect(documents.length).toBe(21);
		});
	});

	describe("Docula Builder - Sections", () => {
		it("should merge sections based on what you find in options", () => {
			const builder = new DoculaBuilder(
				Object.assign(new DoculaOptions(), { quiet: true }),
			);
			const options = new DoculaOptions();
			options.quiet = true;
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
			const builder = new DoculaBuilder(
				Object.assign(new DoculaOptions(), { quiet: true }),
			);
			const documentsPath = "test/fixtures/mega-page-site/docs";
			const options = new DoculaOptions();
			options.quiet = true;
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
			const builder = new DoculaBuilder(
				Object.assign(new DoculaOptions(), { quiet: true }),
			);
			const options = new DoculaOptions();
			options.quiet = true;
			const sections = builder.getSections(
				"test/fixtures/multi-page-site/docs",
				options,
			);
			const sectionPaths = sections.map((s) => s.path);
			expect(sectionPaths).not.toContain("images");
			expect(sectionPaths).not.toContain("assets");
		});
		it("should not include directories with only nested markdown as sections", () => {
			const builder = new DoculaBuilder(
				Object.assign(new DoculaOptions(), { quiet: true }),
			);
			const options = new DoculaOptions();
			options.quiet = true;
			const sections = builder.getSections(
				"test/fixtures/multi-page-site/docs",
				options,
			);
			const sectionPaths = sections.map((s) => s.path);
			// guides/ only has nested/intro.md, no immediate markdown files
			expect(sectionPaths).not.toContain("guides");
		});
	});

	describe("Docula Builder - Generate Sidebar Items", () => {
		it("generateSidebarItems should return an empty array if sections and documents does not exist", async () => {
			const builder = new DoculaBuilder(
				Object.assign(new DoculaOptions(), { quiet: true }),
			);
			const data = doculaData;
			data.templates = {
				home: "home.hbs",
			};
			data.sitePath = "site";
			data.templatePath = "test/fixtures/template-example";
			data.output = "test/temp/index-test";

			data.sections = undefined;
			data.documents = undefined;

			const sidebarItems = builder.generateSidebarItems(data);
			expect(sidebarItems).toStrictEqual([]);
		});
		it("generateSidebarItems should sort sidebarItems children", async () => {
			const builder = new DoculaBuilder(
				Object.assign(new DoculaOptions(), { quiet: true }),
			);
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
			data.output = "test/temp/index-test";

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
			const builder = new DoculaBuilder(
				Object.assign(new DoculaOptions(), { quiet: true }),
			);
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
			data.output = "test/temp/index-test";

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
			const builder = new DoculaBuilder(
				Object.assign(new DoculaOptions(), { quiet: true }),
			);
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
			data.output = "test/temp/index-test";

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
			const builder = new DoculaBuilder(
				Object.assign(new DoculaOptions(), { quiet: true }),
			);
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
			data.output = "test/temp/index-test";

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
			const builder = new DoculaBuilder(
				Object.assign(new DoculaOptions(), { quiet: true }),
			);

			const documentsPath = "test/fixtures/empty.md";
			const parsedDocument = builder.parseDocumentData(documentsPath);
			expect(parsedDocument.generatedHtml).not.toContain("table-of-contents");
		});

		it("should render inline TOC when markdown already has a table of contents", async () => {
			const builder = new DoculaBuilder(
				Object.assign(new DoculaOptions(), { quiet: true }),
			);

			const documentsPath = "test/fixtures/has-toc.md";
			const parsedDocument = builder.parseDocumentData(documentsPath);
			expect(parsedDocument.generatedHtml).toContain("table-of-contents");
			expect(parsedDocument.generatedHtml).toContain("#overview");
			expect(parsedDocument.generatedHtml).toContain("#details");
		});
	});

	describe("Build Readme Section", async () => {
		it("should build the readme section", async () => {
			const builder = new DoculaBuilder(
				Object.assign(new DoculaOptions(), { quiet: true }),
			);
			const data = doculaData;
			data.sitePath = "test/fixtures/single-page-site";

			const result = await builder.buildReadmeSection(data);

			expect(result).toBeTruthy();
		});
	});

	describe("Build Announcement Section", async () => {
		it("should return undefined when announcement.md does not exist", async () => {
			const builder = new DoculaBuilder(
				Object.assign(new DoculaOptions(), { quiet: true }),
			);
			const data = doculaData;
			data.sitePath = "test/fixtures/single-page-site";

			const result = await builder.buildAnnouncementSection(data);

			expect(result).toBeUndefined();
		});

		it("should build the announcement section when announcement.md exists", async () => {
			const builder = new DoculaBuilder(
				Object.assign(new DoculaOptions(), { quiet: true }),
			);
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

	describe("Docula Builder - OpenGraph Frontmatter Parsing", () => {
		it("should parse ogTitle, ogDescription, ogImage from frontmatter", () => {
			const builder = new DoculaBuilder(
				Object.assign(new DoculaOptions(), { quiet: true }),
			);
			const doc = builder.parseDocumentData(
				"test/fixtures/multi-page-site/docs/opengraph-doc.md",
			);
			expect(doc.ogTitle).toBe("Custom OG Title");
			expect(doc.ogDescription).toBe("Custom OG Description");
			expect(doc.ogImage).toBe("https://example.com/custom-og.png");
		});

		it("should return undefined for og fields when not in frontmatter", () => {
			const builder = new DoculaBuilder(
				Object.assign(new DoculaOptions(), { quiet: true }),
			);
			const doc = builder.parseDocumentData(
				"test/fixtures/multi-page-site/docs/front-matter.md",
			);
			expect(doc.ogTitle).toBeUndefined();
			expect(doc.ogDescription).toBeUndefined();
			expect(doc.ogImage).toBeUndefined();
		});
	});

	describe("Docula Builder - HTML Entity Handling in Code Blocks", () => {
		it("should produce correct HTML entities in generatedHtml for code blocks with generics", () => {
			const builder = new DoculaBuilder(
				Object.assign(new DoculaOptions(), { quiet: true }),
			);
			const doc = builder.parseDocumentData(
				"test/fixtures/multi-page-site/docs/generics-doc.md",
			);
			expect(doc.generatedHtml).toContain("&#x3C;T>");
			expect(doc.generatedHtml).toContain("&#x3C;");
			expect(doc.generatedHtml).not.toMatch(/identity<T>/);
		});

		it("should build docs pages with generics in code blocks without he.decode", async () => {
			const builder = new DoculaBuilder(
				Object.assign(new DoculaOptions(), { quiet: true }),
			);
			const data: DoculaData = {
				...defaultPathFields,
				siteUrl: "http://foo.com",
				siteTitle: "docula",
				siteDescription: "Beautiful Website for Your Projects",
				sitePath: "test/fixtures/multi-page-site",
				templatePath: "test/fixtures/template-example",
				output: "test/temp/generics-test",
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

				expect(content).toContain("Generics Guide");
				expect(content).toContain("<code");
				expect(content).toContain("identity");
				expect(content).toContain("Map");
			} finally {
				await fs.promises.rm(data.output, { recursive: true, force: true });
			}
		});

		it("should build changelog entry pages without he.decode", async () => {
			const builder = new DoculaBuilder(
				Object.assign(new DoculaOptions(), { quiet: true }),
			);
			const generatedHtml =
				"<pre><code>function identity&lt;T&gt;(arg: T): T { return arg; }</code></pre>";
			const data: DoculaData = {
				...defaultPathFields,
				siteUrl: "http://foo.com",
				siteTitle: "docula",
				siteDescription: "Beautiful Website for Your Projects",
				sitePath: "test/fixtures/changelog-site",
				templatePath: "test/fixtures/template-example",
				output: "test/temp/changelog-generics-test",
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
				expect(entryPage).toContain("Generics Support");
				expect(entryPage).toContain("identity");
			} finally {
				await fs.promises.rm(data.output, { recursive: true, force: true });
			}
		});

		it("should handle non-ASCII characters without he.decode", async () => {
			const builder = new DoculaBuilder(
				Object.assign(new DoculaOptions(), { quiet: true }),
			);
			const data: DoculaData = {
				...defaultPathFields,
				siteUrl: "http://foo.com",
				siteTitle: "docula",
				siteDescription: "Beautiful Website for Your Projects",
				sitePath: "test/fixtures/multi-page-site",
				templatePath: "test/fixtures/template-example",
				output: "test/temp/nonascii-test",
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

				expect(content).toBeTruthy();
				expect(content.length).toBeGreaterThan(0);
				expect(content).toContain("Non-ASCII");
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

	describe("Docula Builder - buildDocsHomePage", () => {
		it("should render first document as index.html when no README.md exists", async () => {
			const builder = new DoculaBuilder(
				Object.assign(new DoculaOptions(), { quiet: true }),
			);
			const data: DoculaData = {
				...defaultPathFields,
				siteUrl: "http://foo.com",
				siteTitle: "docula",
				siteDescription: "Beautiful Website for Your Projects",
				sitePath: "test/fixtures/multi-page-site",
				templatePath: "test/fixtures/template-example",
				output: "test/temp/docs-home-test",

				hasDocuments: true,
				sections: [{ name: "getting-started", path: "getting-started" }],
				documents: builder.getDocuments("test/fixtures/multi-page-site/docs", {
					...defaultPathFields,
					siteUrl: "http://foo.com",
					siteTitle: "docula",
					siteDescription: "Beautiful Website for Your Projects",
					sitePath: "test/fixtures/multi-page-site",
					templatePath: "test/fixtures/template-example",
					output: "test/temp/docs-home-test",
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
			const builder = new DoculaBuilder(
				Object.assign(new DoculaOptions(), { quiet: true }),
			);
			const data: DoculaData = {
				...defaultPathFields,
				siteUrl: "http://foo.com",
				siteTitle: "docula",
				siteDescription: "Beautiful Website for Your Projects",
				sitePath: "test/fixtures/multi-page-site",
				templatePath: "test/fixtures/template-example",
				output: "test/temp/docs-home-error-test",

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
			const builder = new DoculaBuilder(
				Object.assign(new DoculaOptions(), { quiet: true }),
			);
			const data: DoculaData = {
				...defaultPathFields,
				siteUrl: "http://foo.com",
				siteTitle: "docula",
				siteDescription: "Beautiful Website for Your Projects",
				sitePath: "test/fixtures/multi-page-site",
				templatePath: "test/fixtures/template-example",
				output: "test/temp/docs-home-empty-test",

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
			const builder = new DoculaBuilder(
				Object.assign(new DoculaOptions(), { quiet: true }),
			);
			const data: DoculaData = {
				...defaultPathFields,
				siteUrl: "http://foo.com",
				siteTitle: "docula",
				siteDescription: "Beautiful Website for Your Projects",
				sitePath: "test/fixtures/multi-page-site",
				templatePath: "test/fixtures/template-example",
				output: "test/temp/docs-home-precomputed-sidebar",

				hasDocuments: true,
				sections: [{ name: "getting-started", path: "getting-started" }],
				documents: builder.getDocuments("test/fixtures/multi-page-site/docs", {
					...defaultPathFields,
					siteUrl: "http://foo.com",
					siteTitle: "docula",
					siteDescription: "Beautiful Website for Your Projects",
					sitePath: "test/fixtures/multi-page-site",
					templatePath: "test/fixtures/template-example",
					output: "test/temp/docs-home-precomputed-sidebar",
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

	describe("Docula Builder - Content Assets", () => {
		it("should copy non-markdown files from docs to output docs", async () => {
			const tempSitePath = "test/temp/content-assets-docs-site";
			fs.cpSync("test/fixtures/multi-page-site", tempSitePath, {
				recursive: true,
				filter: (src) => {
					const base = src.split("/").pop() ?? "";
					return !base.startsWith("dist") && base !== ".cache";
				},
			});
			const options = new DoculaOptions();
			options.output = "test/temp/content-assets-docs";
			options.sitePath = tempSitePath;
			options.githubPath = "jaredwray/docula";
			options.siteTitle = "docula";
			options.siteDescription = "Beautiful Website for Your Projects";
			options.siteUrl = "https://docula.org";
			options.quiet = true;
			const builder = new DoculaBuilder(options);

			try {
				await builder.build();

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

				expect(fs.existsSync(`${options.output}/docs/front-matter.md`)).toBe(
					false,
				);
			} finally {
				fs.rmSync(tempSitePath, { recursive: true, force: true });
				await fs.promises.rm(options.output, {
					recursive: true,
					force: true,
				});
			}
		});

		it("should copy non-markdown files from changelog to output changelog", async () => {
			const tempSitePath = "test/temp/content-assets-changelog-site";
			fs.cpSync("test/fixtures/mega-page-site", tempSitePath, {
				recursive: true,
				filter: (src) => {
					const base = src.split("/").pop() ?? "";
					return !base.startsWith("dist") && base !== ".cache";
				},
			});
			const options = new DoculaOptions();
			options.output = "test/temp/content-assets-changelog";
			options.sitePath = tempSitePath;
			options.githubPath = "jaredwray/docula";
			options.siteTitle = "docula";
			options.siteDescription = "Beautiful Website for Your Projects";
			options.siteUrl = "https://docula.org";
			options.quiet = true;
			const builder = new DoculaBuilder(options);

			try {
				await builder.build();

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

				expect(
					fs.existsSync(
						`${options.output}/changelog/2025-01-15-new-feature.md`,
					),
				).toBe(false);
			} finally {
				fs.rmSync(tempSitePath, { recursive: true, force: true });
				await fs.promises.rm(options.output, {
					recursive: true,
					force: true,
				});
			}
		});

		it("should only copy files with allowed asset extensions", async () => {
			const tempSitePath = "test/temp/content-assets-extensions-site";
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
			options.quiet = true;
			const builder = new DoculaBuilder(options);

			try {
				await builder.build();

				expect(fs.existsSync(`${options.output}/docs/photo.jpg`)).toBe(true);
				expect(fs.existsSync(`${options.output}/docs/script.sh`)).toBe(false);
			} finally {
				await fs.promises.rm(tempSitePath, {
					recursive: true,
					force: true,
				});
			}
		});

		it("should respect custom allowedAssets from options", async () => {
			const tempSitePath = "test/temp/content-assets-custom-ext-site";
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
			options.allowedAssets = [".xyz"];
			options.quiet = true;
			const builder = new DoculaBuilder(options);

			try {
				await builder.build();

				expect(fs.existsSync(`${options.output}/docs/custom.xyz`)).toBe(true);
				expect(fs.existsSync(`${options.output}/docs/photo.jpg`)).toBe(false);
			} finally {
				await fs.promises.rm(tempSitePath, {
					recursive: true,
					force: true,
				});
			}
		});

		it("should copy sibling assets into non-index document output directories", async () => {
			const tempSitePath = "test/temp/content-assets-sibling-site";
			fs.cpSync("test/fixtures/multi-page-site", tempSitePath, {
				recursive: true,
				filter: (src) => {
					const base = src.split("/").pop() ?? "";
					return !base.startsWith("dist") && base !== ".cache";
				},
			});
			const options = new DoculaOptions();
			options.output = "test/temp/content-assets-sibling";
			options.sitePath = tempSitePath;
			options.githubPath = "jaredwray/docula";
			options.siteTitle = "docula";
			options.siteDescription = "Beautiful Website for Your Projects";
			options.siteUrl = "https://docula.org";
			options.quiet = true;
			const builder = new DoculaBuilder(options);

			try {
				await builder.build();

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

				expect(
					fs.existsSync(
						`${options.output}/docs/readme-example/images/diagram.png`,
					),
				).toBe(true);

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
				fs.rmSync(tempSitePath, { recursive: true, force: true });
				await fs.promises.rm(options.output, {
					recursive: true,
					force: true,
				});
			}
		});

		it("should NOT copy unreferenced assets from docs", async () => {
			const tempSitePath = "test/temp/content-assets-unreferenced-site";
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
			options.quiet = true;
			const builder = new DoculaBuilder(options);

			try {
				await builder.build();

				expect(fs.existsSync(`${options.output}/docs/used.png`)).toBe(true);
				expect(fs.existsSync(`${options.output}/docs/unused.png`)).toBe(false);
			} finally {
				await fs.promises.rm(tempSitePath, {
					recursive: true,
					force: true,
				});
			}
		});

		it("should handle docs directory with no non-markdown files", async () => {
			const tempSitePath = "test/temp/content-assets-no-assets-site";
			fs.cpSync("test/fixtures/single-page-site", tempSitePath, {
				recursive: true,
				filter: (src) => {
					const base = src.split("/").pop() ?? "";
					return !base.startsWith("dist") && base !== ".cache";
				},
			});
			const options = new DoculaOptions();
			options.output = "test/temp/content-assets-no-assets";
			options.sitePath = tempSitePath;
			options.githubPath = "jaredwray/docula";
			options.siteTitle = "docula";
			options.siteDescription = "Beautiful Website for Your Projects";
			options.siteUrl = "https://docula.org";
			options.quiet = true;
			const builder = new DoculaBuilder(options);

			try {
				await builder.build();
				expect(fs.existsSync(`${options.output}/index.html`)).toBe(true);
			} finally {
				fs.rmSync(tempSitePath, { recursive: true, force: true });
				await fs.promises.rm(options.output, {
					recursive: true,
					force: true,
				});
			}
		});
	});

	describe("lastModified field", () => {
		it("should include lastModified in YYYY-MM-DD format for parseDocumentData", () => {
			const builder = new DoculaBuilder(
				Object.assign(new DoculaOptions(), { quiet: true }),
			);
			const doc = builder.parseDocumentData(
				"test/fixtures/multi-page-site/docs/front-matter.md",
			);
			expect(doc.lastModified).toBeDefined();
			expect(doc.lastModified).toMatch(/^\d{4}-\d{2}-\d{2}$/);
		});

		it("should include lastModified in YYYY-MM-DD format for parseChangelogEntry", () => {
			const builder = new DoculaBuilder(
				Object.assign(new DoculaOptions(), { quiet: true }),
			);
			const entry = builder.parseChangelogEntry(
				"test/fixtures/changelog-site/changelog/2025-01-15-new-feature.md",
			);
			expect(entry.lastModified).toBeDefined();
			expect(entry.lastModified).toMatch(/^\d{4}-\d{2}-\d{2}$/);
		});

		it("should include lastModified from release date for GitHub release changelog entries", () => {
			const builder = new DoculaBuilder(
				Object.assign(new DoculaOptions(), { quiet: true }),
			);
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
});
