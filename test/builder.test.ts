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

describe("DoculaBuilder", () => {
	const doculaData: DoculaData = {
		siteUrl: "http://foo.com",
		siteTitle: "docula",
		siteDescription: "Beautiful Website for Your Projects",
		sitePath: "test/fixtures/single-page-site",
		templatePath: "test/fixtures/template-example",
		outputPath: "test/temp-sitemap-test",
	};

	afterEach(() => {
		// Reset the mock after each test
		vi.resetAllMocks();
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
			options.outputPath = "test/temp-build-test";
			const builder = new DoculaBuilder(options);
			const consoleLog = console.log;
			let consoleMessage = "";
			console.log = (message) => {
				consoleMessage = message as string;
			};

			try {
				await builder.build();
			} finally {
				await fs.promises.rm(builder.options.outputPath, { recursive: true });
			}

			expect(consoleMessage).toContain("Build");

			console.log = consoleLog;
		});
		it("should build multi page", async () => {
			const options = new DoculaOptions();
			options.outputPath = "test/temp-build-test";
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
				await fs.promises.rm(builder.options.outputPath, { recursive: true });
			}

			expect(consoleMessage).toContain("Build");

			console.log = consoleLog;
		});
	});

	describe("Docula Builder - Validate Options", () => {
		it("should validate githubPath options", async () => {
			const builder = new DoculaBuilder();
			const options = new DoculaOptions();
			try {
				options.githubPath = "";
				builder.validateOptions(options);
			} catch (error) {
				expect((error as Error).message).toBe("No github options provided");
			}
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
				"index",
			);
			expect(file).toBe("index.hbs");
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
			const options = new DoculaOptions();
			options.templatePath = "test/fixtures/template-example/";
			const templateData = await builder.getTemplates(options, false);
			expect(templateData.releases).toBe("releases.hbs");
		});
		it("should throw error when template path doesnt exist", async () => {
			const builder = new DoculaBuilder();
			const options = new DoculaOptions();
			options.templatePath = "test/fixtures/template-example1/";
			try {
				await builder.getTemplates(options, false);
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
			options.outputPath = "test/temp-robots-test";

			if (fs.existsSync(options.outputPath)) {
				await fs.promises.rm(options.outputPath, { recursive: true });
			}

			try {
				await builder.buildRobotsPage(options);
				const robots = await fs.promises.readFile(
					`${options.outputPath}/robots.txt`,
					"utf8",
				);
				expect(robots).toBe("User-agent: *\nDisallow:");
			} finally {
				if (fs.existsSync(options.outputPath)) {
					await fs.promises.rm(options.outputPath, { recursive: true });
				}
			}
		});
		it("should copy the robots.txt (/robots.txt)", async () => {
			const builder = new DoculaBuilder();
			const options = new DoculaOptions();
			options.sitePath = "test/fixtures/multi-page-site";
			options.outputPath = "test/temp-robots-test-copy";

			if (fs.existsSync(options.outputPath)) {
				await fs.promises.rm(options.outputPath, { recursive: true });
			}

			try {
				await builder.buildRobotsPage(options);
				const robots = await fs.promises.readFile(
					`${options.outputPath}/robots.txt`,
					"utf8",
				);
				expect(robots).toBe("User-agent: *\nDisallow: /meow");
			} finally {
				if (fs.existsSync(options.outputPath)) {
					await fs.promises.rm(options.outputPath, { recursive: true });
				}
			}
		});
		it("should build the sitemap.xml (/sitemap.xml)", async () => {
			const builder = new DoculaBuilder();
			const data = doculaData;

			if (fs.existsSync(data.outputPath)) {
				await fs.promises.rm(data.outputPath, { recursive: true });
			}

			try {
				await builder.buildSiteMapPage(data);
				const sitemap = await fs.promises.readFile(
					`${data.outputPath}/sitemap.xml`,
					"utf8",
				);
				expect(sitemap).toContain("<loc>http://foo.com</loc>");
			} finally {
				if (fs.existsSync(data.outputPath)) {
					await fs.promises.rm(data.outputPath, { recursive: true });
				}
			}
		});
	});

	describe("Docula Builder - Build Index", () => {
		it("should build the index.html (/index.html)", async () => {
			const builder = new DoculaBuilder();
			const data = doculaData;
			data.templates = {
				index: "index.hbs",
				releases: "releases.hbs",
			};
			data.sitePath = "site";
			data.templatePath = "test/fixtures/template-example";
			data.outputPath = "test/temp-index-test";

			if (fs.existsSync(data.outputPath)) {
				await fs.promises.rm(data.outputPath, { recursive: true });
			}

			try {
				await builder.buildIndexPage(data);
				const index = await fs.promises.readFile(
					`${data.outputPath}/index.html`,
					"utf8",
				);
				expect(index).toContain("<title>docula</title>");
			} finally {
				if (fs.existsSync(data.outputPath)) {
					await fs.promises.rm(data.outputPath, { recursive: true });
				}
			}
		});
		it("should throw an error build the index.html (/index.html)", async () => {
			const builder = new DoculaBuilder();
			const data = doculaData;
			data.sitePath = "template";
			data.outputPath = "test/temp-index-test";
			data.templates = undefined;

			try {
				await builder.buildIndexPage(data);
			} catch (error) {
				expect((error as Error).message).toBe("No templates found");
			} finally {
				if (fs.existsSync(data.outputPath)) {
					await fs.promises.rm(data.outputPath, { recursive: true });
				}
			}
		});
	});

	describe("Docula Builder - Build Release", () => {
		it("should build release page (/releases/index.html)", async () => {
			const builder = new DoculaBuilder();
			const data = doculaData;
			data.templates = {
				index: "index.hbs",
				releases: "releases.hbs",
			};
			data.sitePath = "site";
			data.templatePath = "template";
			data.outputPath = "test/temp-release-test";

			data.github = {
				releases: {},
				contributors: {},
			};

			if (fs.existsSync(data.outputPath)) {
				await fs.promises.rm(data.outputPath, { recursive: true });
			}

			try {
				await builder.buildReleasePage(data);
				const index = await fs.promises.readFile(
					`${data.outputPath}/releases/index.html`,
					"utf8",
				);
				expect(index).toContain("<title>docula Releases</title>");
			} finally {
				if (fs.existsSync(data.outputPath)) {
					await fs.promises.rm(data.outputPath, { recursive: true });
				}
			}
		});
		it("should error on build release page (/releases/index.html)", async () => {
			const builder = new DoculaBuilder();
			const data = doculaData;
			data.templates = {
				index: "index.hbs",
				releases: "releases.hbs",
			};
			data.sitePath = "site";
			data.templatePath = "template";
			data.outputPath = "test/temp-release-test";

			data.github = undefined;

			if (fs.existsSync(data.outputPath)) {
				await fs.promises.rm(data.outputPath, { recursive: true });
			}

			try {
				await builder.buildReleasePage(data);
			} catch (error) {
				expect((error as Error).message).toBe("No github data found");
			} finally {
				if (fs.existsSync(data.outputPath)) {
					await fs.promises.rm(data.outputPath, { recursive: true });
				}
			}
		});
	});

	describe("Docula Builder - Build Docs", () => {
		it("should build the docs pages", async () => {
			const builder = new DoculaBuilder();
			const data = doculaData;
			data.templates = {
				index: "index.hbs",
				releases: "releases.hbs",
				docPage: "docs.hbs",
			};
			data.sitePath = "site";
			data.templatePath = "test/fixtures/template-example";
			data.outputPath = "test/temp-index-test";
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
				},
			];

			if (fs.existsSync(data.outputPath)) {
				await fs.promises.rm(data.outputPath, { recursive: true });
			}

			try {
				await builder.buildDocsPages(data);
				expect(fs.existsSync(`${data.outputPath}/docs/document.html`)).toBe(
					true,
				);
			} finally {
				if (fs.existsSync(data.outputPath)) {
					await fs.promises.rm(data.outputPath, { recursive: true });
				}
			}
		});
		it("should throw error when template doesnt exist", async () => {
			const builder = new DoculaBuilder();
			const data = doculaData;
			data.templates = undefined;
			data.sitePath = "site";
			data.templatePath = "test/fixtures/no-template-example";
			data.outputPath = "test/temp-index-test";

			if (fs.existsSync(data.outputPath)) {
				await fs.promises.rm(data.outputPath, { recursive: true });
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
			const documents = builder.getDocumentInDirectory(documentsPath);
			expect(documents.length).toBe(3);
		});
		it("should get all the documents from the mega fixtures", () => {
			const builder = new DoculaBuilder();
			const doculaData: DoculaData = {
				siteUrl: "http://foo.com",
				siteTitle: "docula",
				siteDescription: "Beautiful Website for Your Projects",
				sitePath: "test/fixtures/mega-page-site",
				templatePath: "test/fixtures/template-example",
				outputPath: "test/temp-sitemap-test",
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
	});

	describe("Docula Builder - Generate Sidebar Items", () => {
		it("generateSidebarItems should return an empty array if sections and documents does not exist", async () => {
			const builder = new DoculaBuilder();
			const data = doculaData;
			data.templates = {
				index: "index.hbs",
				releases: "releases.hbs",
			};
			data.sitePath = "site";
			data.templatePath = "test/fixtures/template-example";
			data.outputPath = "test/temp-index-test";

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
				index: "index.hbs",
				releases: "releases.hbs",
			};
			data.sitePath = "site";
			data.templatePath = "test/fixtures/template-example";
			data.outputPath = "test/temp-index-test";

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
				},
			];

			const data = doculaData;
			data.templates = {
				index: "index.hbs",
				releases: "releases.hbs",
			};
			data.sitePath = "site";
			data.templatePath = "test/fixtures/template-example";
			data.outputPath = "test/temp-index-test";

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
				},
			];

			const data = doculaData;
			data.templates = {
				index: "index.hbs",
				releases: "releases.hbs",
			};
			data.sitePath = "site";
			data.templatePath = "test/fixtures/template-example";
			data.outputPath = "test/temp-index-test";

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
	});

	describe("Docula Builder - Document Parser", () => {
		it("should include TOC heading in generatedHtml for empty markdown", async () => {
			const builder = new DoculaBuilder();

			const documentsPath = "test/fixtures/empty.md";
			const parsedDocument = builder.parseDocumentData(documentsPath);
			expect(parsedDocument.generatedHtml).toContain("table-of-contents");
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
			options.outputPath = "test/temp-public-folder-test";
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
					consoleMessages.some((msg) => msg.includes("Public folder found")),
				).toBe(true);

				// Verify files were copied
				expect(fs.existsSync(`${options.outputPath}/images/test.png`)).toBe(
					true,
				);
				expect(fs.existsSync(`${options.outputPath}/sample.pdf`)).toBe(true);

				// Verify copied file contents
				const testPngContent = await fs.promises.readFile(
					`${options.outputPath}/images/test.png`,
					"utf8",
				);
				expect(testPngContent).toBe("test image content\n");

				const samplePdfContent = await fs.promises.readFile(
					`${options.outputPath}/sample.pdf`,
					"utf8",
				);
				expect(samplePdfContent).toBe("test pdf content\n");

				// Verify dotfiles are also copied
				expect(fs.existsSync(`${options.outputPath}/.nojekyll`)).toBe(true);
				expect(
					fs.existsSync(`${options.outputPath}/.well-known/security.txt`),
				).toBe(true);
			} finally {
				await fs.promises.rm(builder.options.outputPath, { recursive: true });
				console.log = consoleLog;
			}
		});

		it("should not log anything when public folder does not exist", async () => {
			const options = new DoculaOptions();
			options.outputPath = "test/temp-no-public-folder-test";
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
					consoleMessages.some((msg) => msg.includes("Public folder found")),
				).toBe(false);
			} finally {
				await fs.promises.rm(builder.options.outputPath, { recursive: true });
				console.log = consoleLog;
			}
		});

		it("should skip outputPath when it is inside public folder to prevent recursive copy", async () => {
			// Create a temporary site with public folder where outputPath is inside public
			const tempSitePath = "test/temp-recursive-site";
			const publicPath = `${tempSitePath}/public`;
			const outputPath = `${publicPath}/dist`;

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
			options.outputPath = outputPath;
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
					consoleMessages.some((msg) => msg.includes("Build completed")),
				).toBe(true);

				// Verify files were copied but dist folder itself was skipped
				expect(fs.existsSync(`${outputPath}/test.txt`)).toBe(true);
				expect(fs.existsSync(`${outputPath}/assets/image.png`)).toBe(true);

				// Verify no recursive dist/dist folder was created
				expect(fs.existsSync(`${outputPath}/dist`)).toBe(false);
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
				siteUrl: "http://foo.com",
				siteTitle: "docula",
				siteDescription: "Beautiful Website for Your Projects",
				sitePath: "test/fixtures/single-page-site",
				templatePath: "template",
				outputPath: "test/temp-api-test",
				openApiUrl: "https://petstore.swagger.io/v2/swagger.json",
				templates: {
					index: "index.hbs",
					releases: "releases.hbs",
					api: "api.hbs",
				},
			};

			if (fs.existsSync(data.outputPath)) {
				await fs.promises.rm(data.outputPath, { recursive: true });
			}

			try {
				await builder.buildApiPage(data);
				const apiPage = await fs.promises.readFile(
					`${data.outputPath}/api/index.html`,
					"utf8",
				);
				expect(apiPage).toContain("docutopia");
				expect(apiPage).toContain(
					"https://petstore.swagger.io/v2/swagger.json",
				);
			} finally {
				if (fs.existsSync(data.outputPath)) {
					await fs.promises.rm(data.outputPath, { recursive: true });
				}
			}
		});

		it("should not build API page when openApiUrl is not configured", async () => {
			const builder = new DoculaBuilder();
			const data: DoculaData = {
				siteUrl: "http://foo.com",
				siteTitle: "docula",
				siteDescription: "Beautiful Website for Your Projects",
				sitePath: "test/fixtures/single-page-site",
				templatePath: "template",
				outputPath: "test/temp-api-test-no-url",
				templates: {
					index: "index.hbs",
					releases: "releases.hbs",
				},
			};

			if (fs.existsSync(data.outputPath)) {
				await fs.promises.rm(data.outputPath, { recursive: true });
			}

			try {
				await builder.buildApiPage(data);
				expect(fs.existsSync(`${data.outputPath}/api/index.html`)).toBe(false);
			} finally {
				if (fs.existsSync(data.outputPath)) {
					await fs.promises.rm(data.outputPath, { recursive: true });
				}
			}
		});

		it("should not build API page when api template is not configured", async () => {
			const builder = new DoculaBuilder();
			const data: DoculaData = {
				siteUrl: "http://foo.com",
				siteTitle: "docula",
				siteDescription: "Beautiful Website for Your Projects",
				sitePath: "test/fixtures/single-page-site",
				templatePath: "template",
				outputPath: "test/temp-api-test-no-template",
				openApiUrl: "https://petstore.swagger.io/v2/swagger.json",
				templates: {
					index: "index.hbs",
					releases: "releases.hbs",
				},
			};

			if (fs.existsSync(data.outputPath)) {
				await fs.promises.rm(data.outputPath, { recursive: true });
			}

			try {
				await builder.buildApiPage(data);
				expect(fs.existsSync(`${data.outputPath}/api/index.html`)).toBe(false);
			} finally {
				if (fs.existsSync(data.outputPath)) {
					await fs.promises.rm(data.outputPath, { recursive: true });
				}
			}
		});

		it("should include /api in sitemap when openApiUrl and api template are configured", async () => {
			const builder = new DoculaBuilder();
			const data: DoculaData = {
				siteUrl: "http://foo.com",
				siteTitle: "docula",
				siteDescription: "Beautiful Website for Your Projects",
				sitePath: "test/fixtures/single-page-site",
				templatePath: "template",
				outputPath: "test/temp-sitemap-api-test",
				openApiUrl: "https://petstore.swagger.io/v2/swagger.json",
				templates: {
					index: "index.hbs",
					releases: "releases.hbs",
					api: "api.hbs",
				},
			};

			if (fs.existsSync(data.outputPath)) {
				await fs.promises.rm(data.outputPath, { recursive: true });
			}

			try {
				await builder.buildSiteMapPage(data);
				const sitemap = await fs.promises.readFile(
					`${data.outputPath}/sitemap.xml`,
					"utf8",
				);
				expect(sitemap).toContain("<loc>http://foo.com/api</loc>");
			} finally {
				if (fs.existsSync(data.outputPath)) {
					await fs.promises.rm(data.outputPath, { recursive: true });
				}
			}
		});

		it("should not include /api in sitemap when openApiUrl is configured but api template is missing", async () => {
			const builder = new DoculaBuilder();
			const data: DoculaData = {
				siteUrl: "http://foo.com",
				siteTitle: "docula",
				siteDescription: "Beautiful Website for Your Projects",
				sitePath: "test/fixtures/single-page-site",
				templatePath: "template",
				outputPath: "test/temp-sitemap-no-api-test",
				openApiUrl: "https://petstore.swagger.io/v2/swagger.json",
				templates: {
					index: "index.hbs",
					releases: "releases.hbs",
				},
			};

			if (fs.existsSync(data.outputPath)) {
				await fs.promises.rm(data.outputPath, { recursive: true });
			}

			try {
				await builder.buildSiteMapPage(data);
				const sitemap = await fs.promises.readFile(
					`${data.outputPath}/sitemap.xml`,
					"utf8",
				);
				expect(sitemap).not.toContain("<loc>http://foo.com/api</loc>");
			} finally {
				if (fs.existsSync(data.outputPath)) {
					await fs.promises.rm(data.outputPath, { recursive: true });
				}
			}
		});

		it("should get api template when openApiUrl is configured", async () => {
			const builder = new DoculaBuilder();
			const options = new DoculaOptions();
			options.templatePath = "template";
			options.openApiUrl = "https://petstore.swagger.io/v2/swagger.json";
			const templateData = await builder.getTemplates(options, false);
			expect(templateData.api).toBe("api.hbs");
		});

		it("should not get api template when openApiUrl is not configured", async () => {
			const builder = new DoculaBuilder();
			const options = new DoculaOptions();
			options.templatePath = "template";
			const templateData = await builder.getTemplates(options, false);
			expect(templateData.api).toBeUndefined();
		});

		it("should build with openApiUrl configured", async () => {
			const options = new DoculaOptions();
			options.outputPath = "test/temp-build-api-test";
			options.openApiUrl = "https://petstore.swagger.io/v2/swagger.json";
			const builder = new DoculaBuilder(options);
			const consoleLog = console.log;
			let consoleMessage = "";
			console.log = (message) => {
				consoleMessage = message as string;
			};

			try {
				await builder.build();
				expect(fs.existsSync(`${options.outputPath}/api/index.html`)).toBe(
					true,
				);
			} finally {
				await fs.promises.rm(builder.options.outputPath, { recursive: true });
			}

			expect(consoleMessage).toContain("Build");

			console.log = consoleLog;
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
			expect(entries[0].slug).toBe("bug-fix");
			expect(entries[1].title).toBe("New Feature Released");
			expect(entries[2].title).toBe("Performance Improvements");
			// Invalid dates should be at the end
			const lastTwo = entries.slice(3).map((e) => e.title);
			expect(lastTwo).toContain("String Date Entry");
			expect(lastTwo).toContain("No Date Entry");
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
			expect(entry.slug).toBe("new-feature");
			expect(entry.urlPath).toBe("/changelog/new-feature/index.html");
			expect(entry.generatedHtml).toContain("Feature A");
		});

		it("should handle string dates in changelog entries", () => {
			const builder = new DoculaBuilder();
			const entry = builder.parseChangelogEntry(
				"test/fixtures/changelog-site/changelog/2024-11-01-string-date.md",
			);
			expect(entry.title).toBe("String Date Entry");
			expect(entry.date).toBe("Q1 2025");
			expect(entry.slug).toBe("string-date");
		});

		it("should build changelog listing page", async () => {
			const builder = new DoculaBuilder();
			const data: DoculaData = {
				siteUrl: "http://foo.com",
				siteTitle: "docula",
				siteDescription: "Beautiful Website for Your Projects",
				sitePath: "test/fixtures/changelog-site",
				templatePath: "test/fixtures/template-example",
				outputPath: "test/temp-changelog-test",
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
						urlPath: "/changelog/test-entry/index.html",
					},
				],
				templates: {
					index: "index.hbs",
					releases: "releases.hbs",
					changelog: "changelog.hbs",
					changelogEntry: "changelog-entry.hbs",
				},
			};

			if (fs.existsSync(data.outputPath)) {
				await fs.promises.rm(data.outputPath, { recursive: true });
			}

			try {
				await builder.buildChangelogPage(data);
				const changelog = await fs.promises.readFile(
					`${data.outputPath}/changelog/index.html`,
					"utf8",
				);
				expect(changelog).toContain("<title>docula Changelog</title>");
				expect(changelog).toContain("Test Entry");
				expect(changelog).toContain("Added");
			} finally {
				if (fs.existsSync(data.outputPath)) {
					await fs.promises.rm(data.outputPath, { recursive: true });
				}
			}
		});

		it("should build changelog entry pages", async () => {
			const builder = new DoculaBuilder();
			const data: DoculaData = {
				siteUrl: "http://foo.com",
				siteTitle: "docula",
				siteDescription: "Beautiful Website for Your Projects",
				sitePath: "test/fixtures/changelog-site",
				templatePath: "test/fixtures/template-example",
				outputPath: "test/temp-changelog-entry-test",
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
						urlPath: "/changelog/test-entry/index.html",
					},
				],
				templates: {
					index: "index.hbs",
					releases: "releases.hbs",
					changelog: "changelog.hbs",
					changelogEntry: "changelog-entry.hbs",
				},
			};

			if (fs.existsSync(data.outputPath)) {
				await fs.promises.rm(data.outputPath, { recursive: true });
			}

			try {
				await builder.buildChangelogEntryPages(data);
				expect(
					fs.existsSync(`${data.outputPath}/changelog/test-entry/index.html`),
				).toBe(true);
				const entryPage = await fs.promises.readFile(
					`${data.outputPath}/changelog/test-entry/index.html`,
					"utf8",
				);
				expect(entryPage).toContain("<title>docula - Test Entry</title>");
				expect(entryPage).toContain("Test content");
			} finally {
				if (fs.existsSync(data.outputPath)) {
					await fs.promises.rm(data.outputPath, { recursive: true });
				}
			}
		});

		it("should not build changelog page when hasChangelog is false", async () => {
			const builder = new DoculaBuilder();
			const data: DoculaData = {
				siteUrl: "http://foo.com",
				siteTitle: "docula",
				siteDescription: "Beautiful Website for Your Projects",
				sitePath: "test/fixtures/single-page-site",
				templatePath: "test/fixtures/template-example",
				outputPath: "test/temp-no-changelog-test",
				hasChangelog: false,
			};

			if (fs.existsSync(data.outputPath)) {
				await fs.promises.rm(data.outputPath, { recursive: true });
			}

			try {
				await builder.buildChangelogPage(data);
				expect(fs.existsSync(`${data.outputPath}/changelog/index.html`)).toBe(
					false,
				);
			} finally {
				if (fs.existsSync(data.outputPath)) {
					await fs.promises.rm(data.outputPath, { recursive: true });
				}
			}
		});

		it("should not build changelog entry pages when no entries exist", async () => {
			const builder = new DoculaBuilder();
			const data: DoculaData = {
				siteUrl: "http://foo.com",
				siteTitle: "docula",
				siteDescription: "Beautiful Website for Your Projects",
				sitePath: "test/fixtures/single-page-site",
				templatePath: "test/fixtures/template-example",
				outputPath: "test/temp-no-changelog-entries-test",
				hasChangelog: false,
				changelogEntries: [],
			};

			try {
				await builder.buildChangelogEntryPages(data);
				expect(fs.existsSync(`${data.outputPath}/changelog`)).toBe(false);
			} finally {
				if (fs.existsSync(data.outputPath)) {
					await fs.promises.rm(data.outputPath, { recursive: true });
				}
			}
		});

		it("should include /changelog in sitemap when changelog exists", async () => {
			const builder = new DoculaBuilder();
			const data: DoculaData = {
				siteUrl: "http://foo.com",
				siteTitle: "docula",
				siteDescription: "Beautiful Website for Your Projects",
				sitePath: "test/fixtures/changelog-site",
				templatePath: "test/fixtures/template-example",
				outputPath: "test/temp-sitemap-changelog-test",
				hasChangelog: true,
				changelogEntries: [
					{
						title: "Test Entry",
						date: "2025-01-15",
						formattedDate: "January 15, 2025",
						slug: "test-entry",
						content: "",
						generatedHtml: "",
						urlPath: "/changelog/test-entry/index.html",
					},
				],
				templates: {
					index: "index.hbs",
					releases: "releases.hbs",
					changelog: "changelog.hbs",
				},
			};

			if (fs.existsSync(data.outputPath)) {
				await fs.promises.rm(data.outputPath, { recursive: true });
			}

			try {
				await builder.buildSiteMapPage(data);
				const sitemap = await fs.promises.readFile(
					`${data.outputPath}/sitemap.xml`,
					"utf8",
				);
				expect(sitemap).toContain("<loc>http://foo.com/changelog</loc>");
				expect(sitemap).toContain(
					"<loc>http://foo.com/changelog/test-entry</loc>",
				);
			} finally {
				if (fs.existsSync(data.outputPath)) {
					await fs.promises.rm(data.outputPath, { recursive: true });
				}
			}
		});

		it("should not include /changelog in sitemap when changelog does not exist", async () => {
			const builder = new DoculaBuilder();
			const data: DoculaData = {
				siteUrl: "http://foo.com",
				siteTitle: "docula",
				siteDescription: "Beautiful Website for Your Projects",
				sitePath: "test/fixtures/single-page-site",
				templatePath: "test/fixtures/template-example",
				outputPath: "test/temp-sitemap-no-changelog-test",
				hasChangelog: false,
				templates: {
					index: "index.hbs",
					releases: "releases.hbs",
				},
			};

			if (fs.existsSync(data.outputPath)) {
				await fs.promises.rm(data.outputPath, { recursive: true });
			}

			try {
				await builder.buildSiteMapPage(data);
				const sitemap = await fs.promises.readFile(
					`${data.outputPath}/sitemap.xml`,
					"utf8",
				);
				expect(sitemap).not.toContain("<loc>http://foo.com/changelog</loc>");
			} finally {
				if (fs.existsSync(data.outputPath)) {
					await fs.promises.rm(data.outputPath, { recursive: true });
				}
			}
		});

		it("should get changelog template when hasChangelog is true", async () => {
			const builder = new DoculaBuilder();
			const options = new DoculaOptions();
			options.templatePath = "test/fixtures/template-example/";
			const templateData = await builder.getTemplates(options, false, true);
			expect(templateData.changelog).toBe("changelog.hbs");
			expect(templateData.changelogEntry).toBe("changelog-entry.hbs");
		});

		it("should not get changelog template when hasChangelog is false", async () => {
			const builder = new DoculaBuilder();
			const options = new DoculaOptions();
			options.templatePath = "test/fixtures/template-example/";
			const templateData = await builder.getTemplates(options, false, false);
			expect(templateData.changelog).toBeUndefined();
			expect(templateData.changelogEntry).toBeUndefined();
		});

		it("should build with changelog", async () => {
			const options = new DoculaOptions();
			options.outputPath = "test/temp-build-changelog-test";
			options.sitePath = "test/fixtures/changelog-site";
			const builder = new DoculaBuilder(options);
			const consoleLog = console.log;
			let consoleMessage = "";
			console.log = (message) => {
				consoleMessage = message as string;
			};

			try {
				await builder.build();
				expect(
					fs.existsSync(`${options.outputPath}/changelog/index.html`),
				).toBe(true);
				expect(
					fs.existsSync(
						`${options.outputPath}/changelog/new-feature/index.html`,
					),
				).toBe(true);
				expect(
					fs.existsSync(`${options.outputPath}/changelog/bug-fix/index.html`),
				).toBe(true);
				expect(
					fs.existsSync(
						`${options.outputPath}/changelog/improvements/index.html`,
					),
				).toBe(true);
			} finally {
				await fs.promises.rm(builder.options.outputPath, {
					recursive: true,
				});
			}

			expect(consoleMessage).toContain("Build");

			console.log = consoleLog;
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
				siteUrl: "http://foo.com",
				siteTitle: "docula",
				siteDescription: "Beautiful Website for Your Projects",
				sitePath: "test/fixtures/multi-page-site",
				templatePath: "test/fixtures/template-example",
				outputPath: "test/temp-generics-test",
				hasDocuments: true,
				sections: [],
				documents: builder.getDocumentInDirectory(
					"test/fixtures/multi-page-site/docs",
				),
				templates: {
					index: "index.hbs",
					releases: "releases.hbs",
					docPage: "docs.hbs",
				},
			};

			data.sidebarItems = builder.generateSidebarItems(data);

			await fs.promises.rm(data.outputPath, { recursive: true, force: true });

			try {
				await builder.buildDocsPages(data);
				const genericsDoc = data.documents?.find(
					(d) => d.title === "Generics Guide",
				);
				expect(genericsDoc).toBeDefined();

				const outputFile = `${data.outputPath}${genericsDoc?.urlPath}`;
				const content = await fs.promises.readFile(outputFile, "utf8");

				// The docs page should render successfully
				expect(content).toContain("Generics Guide");
				expect(content).toContain("<code");
				// Verify the page contains the code block content
				expect(content).toContain("identity");
				expect(content).toContain("Map");
			} finally {
				await fs.promises.rm(data.outputPath, { recursive: true, force: true });
			}
		});

		it("should build changelog entry pages without he.decode", async () => {
			const builder = new DoculaBuilder();
			const generatedHtml =
				"<pre><code>function identity&lt;T&gt;(arg: T): T { return arg; }</code></pre>";
			const data: DoculaData = {
				siteUrl: "http://foo.com",
				siteTitle: "docula",
				siteDescription: "Beautiful Website for Your Projects",
				sitePath: "test/fixtures/changelog-site",
				templatePath: "test/fixtures/template-example",
				outputPath: "test/temp-changelog-generics-test",
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
						urlPath: "/changelog/generics-support/index.html",
					},
				],
				templates: {
					index: "index.hbs",
					releases: "releases.hbs",
					changelog: "changelog.hbs",
					changelogEntry: "changelog-entry.hbs",
				},
			};

			await fs.promises.rm(data.outputPath, { recursive: true, force: true });

			try {
				await builder.buildChangelogEntryPages(data);
				const entryPage = await fs.promises.readFile(
					`${data.outputPath}/changelog/generics-support/index.html`,
					"utf8",
				);
				// The page should render and contain the code block content
				expect(entryPage).toContain("Generics Support");
				expect(entryPage).toContain("identity");
			} finally {
				await fs.promises.rm(data.outputPath, { recursive: true, force: true });
			}
		});

		it("should handle non-ASCII characters without he.decode", async () => {
			const builder = new DoculaBuilder();
			const data: DoculaData = {
				siteUrl: "http://foo.com",
				siteTitle: "docula",
				siteDescription: "Beautiful Website for Your Projects",
				sitePath: "test/fixtures/multi-page-site",
				templatePath: "test/fixtures/template-example",
				outputPath: "test/temp-nonascii-test",
				hasDocuments: true,
				sections: [],
				documents: builder.getDocumentInDirectory(
					"test/fixtures/multi-page-site/docs",
				),
				templates: {
					index: "index.hbs",
					releases: "releases.hbs",
					docPage: "docs.hbs",
				},
			};

			data.sidebarItems = builder.generateSidebarItems(data);

			await fs.promises.rm(data.outputPath, { recursive: true, force: true });

			try {
				await builder.buildDocsPages(data);
				const genericsDoc = data.documents?.find(
					(d) => d.title === "Generics Guide",
				);
				expect(genericsDoc).toBeDefined();

				const outputFile = `${data.outputPath}${genericsDoc?.urlPath}`;
				const content = await fs.promises.readFile(outputFile, "utf8");

				// Page should render with non-ASCII content intact
				expect(content).toBeTruthy();
				expect(content.length).toBeGreaterThan(0);
				// Non-ASCII section should be present
				expect(content).toContain("Non-ASCII");
			} finally {
				await fs.promises.rm(data.outputPath, { recursive: true, force: true });
			}
		});
	});
});
