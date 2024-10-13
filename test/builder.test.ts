import fs from 'node:fs';
import {
	afterEach, beforeEach, expect, it, describe, vi,
} from 'vitest';
import axios from 'axios';
import {
	DoculaBuilder, type DoculaSection, type DoculaData, type DoculaDocument,
} from '../src/builder.js';
import {DoculaOptions} from '../src/options.js';
import githubMockContributors from './fixtures/data-mocks/github-contributors.json';
import githubMockReleases from './fixtures/data-mocks/github-releases.json';

vi.mock('axios');

describe('DoculaBuilder', () => {
	const doculaData: DoculaData = {
		siteUrl: 'http://foo.com',
		siteTitle: 'docula',
		siteDescription: 'Beautiful Website for Your Projects',
		sitePath: 'test/fixtures/single-page-site',
		templatePath: 'test/fixtures/template-example',
		outputPath: 'test/temp-sitemap-test',
	};

	afterEach(() => {
		// Reset the mock after each test
		vi.resetAllMocks();
	});
	beforeEach(() => {
		// eslint-disable-next-line @typescript-eslint/no-unsafe-call
		(axios.get as any).mockImplementation(async (url: string) => {
			if (url.endsWith('releases')) {
				return {data: githubMockReleases};
			}

			if (url.endsWith('contributors')) {
				return {data: githubMockContributors};
			}

			// Default response or throw an error if you prefer
			return {data: {}};
		});
	});

	describe('Docula Builder', () => {
		it('should initiate', () => {
			const builder = new DoculaBuilder();
			expect(builder).toBeTruthy();
		});

		it('should initiate with options', () => {
			const options = new DoculaOptions();
			const builder = new DoculaBuilder(options);
			expect(builder).toBeTruthy();
			expect(builder.options).toBe(options);
		});
	});

	describe('Docula Builder - Build', () => {
		it('should build single page', async () => {
			const options = new DoculaOptions();
			options.outputPath = 'test/temp-build-test';
			const builder = new DoculaBuilder(options);
			const consoleLog = console.log;
			let consoleMessage = '';
			console.log = message => {
				consoleMessage = message as string;
			};

			try {
				await builder.build();
			} finally {
				await fs.promises.rm(builder.options.outputPath, {recursive: true});
			}

			expect(consoleMessage).toContain('Build');

			console.log = consoleLog;
		});
		it('should build multi page', async () => {
			const options = new DoculaOptions();
			options.outputPath = 'test/temp-build-test';
			options.sitePath = 'test/fixtures/multi-page-site';
			const builder = new DoculaBuilder(options);
			const consoleLog = console.log;
			let consoleMessage = '';
			console.log = message => {
				consoleMessage = message as string;
			};

			try {
				await builder.build();
			} finally {
				await fs.promises.rm(builder.options.outputPath, {recursive: true});
			}

			expect(consoleMessage).toContain('Build');

			console.log = consoleLog;
		});
	});

	describe('Docula Builder - Validate Options', () => {
		it('should validate githubPath options', async () => {
			const builder = new DoculaBuilder();
			const options = new DoculaOptions();
			try {
				options.githubPath = '';
				builder.validateOptions(options);
			} catch (error: any) {
				expect(error.message).toBe('No github options provided');
			}
		});
		it('should validate siteDescription options', async () => {
			const builder = new DoculaBuilder();
			const options = new DoculaOptions();
			try {
				options.siteDescription = '';
				builder.validateOptions(options);
			} catch (error: any) {
				expect(error.message).toBe('No site description options provided');
			}
		});
		it('should validate site title options', async () => {
			const builder = new DoculaBuilder();
			const options = new DoculaOptions();
			try {
				options.siteTitle = '';
				builder.validateOptions(options);
			} catch (error: any) {
				expect(error.message).toBe('No site title options provided');
			}
		});
		it('should validate site url options', async () => {
			const builder = new DoculaBuilder();
			const options = new DoculaOptions();
			try {
				options.siteUrl = '';
				builder.validateOptions(options);
			} catch (error: any) {
				expect(error.message).toBe('No site url options provided');
			}
		});
	});

	describe('Docula Builder - Get Data', () => {
		it('should get github data', async () => {
			const builder = new DoculaBuilder();
			vi.spyOn(axios, 'get').mockResolvedValue({data: {}});
			const githubData = await builder.getGithubData('jaredwray/docula');
			expect(githubData).toBeTruthy();
			vi.resetAllMocks();
		});
	});

	describe('Docula Builder - Get Templates', () => {
		it('should get the file without extension', async () => {
			const builder = new DoculaBuilder();
			const file = await builder.getTemplateFile('test/fixtures/template-example/', 'index');
			expect(file).toBe('index.hbs');
		});
		it('should not get the file without extension', async () => {
			const builder = new DoculaBuilder();
			const file = await builder.getTemplateFile('test/fixtures/template-example/', 'foo');
			expect(file).toBe(undefined);
		});
		it('should get the template data', async () => {
			const builder = new DoculaBuilder();
			const options = new DoculaOptions();
			options.templatePath = 'test/fixtures/template-example/';
			const templateData = await builder.getTemplates(options, false);
			expect(templateData.releases).toBe('releases.hbs');
		});
		it('should throw error when template path doesnt exist', async () => {
			const builder = new DoculaBuilder();
			const options = new DoculaOptions();
			options.templatePath = 'test/fixtures/template-example1/';
			try {
				await builder.getTemplates(options, false);
			} catch (error: any) {
				expect(error.message).toContain('No template path found');
			}
		});
	});

	describe('Docula Builder - Build Robots and Sitemap', () => {
		it('should build the robots.txt (/robots.txt)', async () => {
			const builder = new DoculaBuilder();
			const options = new DoculaOptions();
			options.sitePath = 'test/fixtures/single-page-site';
			options.outputPath = 'test/temp-robots-test';

			if (fs.existsSync(options.outputPath)) {
				await fs.promises.rmdir(options.outputPath, {recursive: true});
			}

			try {
				await builder.buildRobotsPage(options);
				const robots = await fs.promises.readFile(`${options.outputPath}/robots.txt`, 'utf8');
				expect(robots).toBe('User-agent: *\nDisallow:');
			} finally {
				if (fs.existsSync(options.outputPath)) {
					await fs.promises.rmdir(options.outputPath, {recursive: true});
				}
			}
		});
		it('should copy the robots.txt (/robots.txt)', async () => {
			const builder = new DoculaBuilder();
			const options = new DoculaOptions();
			options.sitePath = 'test/fixtures/multi-page-site';
			options.outputPath = 'test/temp-robots-test-copy';

			if (fs.existsSync(options.outputPath)) {
				await fs.promises.rmdir(options.outputPath, {recursive: true});
			}

			try {
				await builder.buildRobotsPage(options);
				const robots = await fs.promises.readFile(`${options.outputPath}/robots.txt`, 'utf8');
				expect(robots).toBe('User-agent: *\nDisallow: /meow');
			} finally {
				if (fs.existsSync(options.outputPath)) {
					await fs.promises.rmdir(options.outputPath, {recursive: true});
				}
			}
		});
		it('should build the sitemap.xml (/sitemap.xml)', async () => {
			const builder = new DoculaBuilder();
			const data = doculaData;

			if (fs.existsSync(data.outputPath)) {
				await fs.promises.rmdir(data.outputPath, {recursive: true});
			}

			try {
				await builder.buildSiteMapPage(data);
				const sitemap = await fs.promises.readFile(`${data.outputPath}/sitemap.xml`, 'utf8');
				expect(sitemap).toContain('<loc>http://foo.com</loc>');
			} finally {
				if (fs.existsSync(data.outputPath)) {
					await fs.promises.rmdir(data.outputPath, {recursive: true});
				}
			}
		});
	});

	describe('Docula Builder - Build Index', () => {
		it('should build the index.html (/index.html)', async () => {
			const builder = new DoculaBuilder();
			const data = doculaData;
			data.templates = {
				index: 'index.hbs',
				releases: 'releases.hbs',
			};
			data.sitePath = 'site';
			data.templatePath = 'test/fixtures/template-example';
			data.outputPath = 'test/temp-index-test';

			if (fs.existsSync(data.outputPath)) {
				await fs.promises.rmdir(data.outputPath, {recursive: true});
			}

			try {
				await builder.buildIndexPage(data);
				const index = await fs.promises.readFile(`${data.outputPath}/index.html`, 'utf8');
				expect(index).toContain('<title>docula</title>');
			} finally {
				if (fs.existsSync(data.outputPath)) {
					await fs.promises.rmdir(data.outputPath, {recursive: true});
				}
			}
		});
		it('should throw an error build the index.html (/index.html)', async () => {
			const builder = new DoculaBuilder();
			const data = doculaData;
			data.sitePath = 'template';
			data.outputPath = 'test/temp-index-test';
			data.templates = undefined;

			try {
				await builder.buildIndexPage(data);
			} catch (error: any) {
				expect(error.message).toBe('No templates found');
			} finally {
				if (fs.existsSync(data.outputPath)) {
					await fs.promises.rmdir(data.outputPath, {recursive: true});
				}
			}
		});
	});

	describe('Docula Builder - Build Release', () => {
		it('should build release page (/releases/index.html)', async () => {
			const builder = new DoculaBuilder();
			const data = doculaData;
			data.templates = {
				index: 'index.hbs',
				releases: 'releases.hbs',
			};
			data.sitePath = 'site';
			data.templatePath = 'template';
			data.outputPath = 'test/temp-release-test';

			data.github = {
				releases: {},
				contributors: {},
			};

			if (fs.existsSync(data.outputPath)) {
				await fs.promises.rmdir(data.outputPath, {recursive: true});
			}

			try {
				await builder.buildReleasePage(data);
				const index = await fs.promises.readFile(`${data.outputPath}/releases/index.html`, 'utf8');
				expect(index).toContain('<title>docula Releases</title>');
			} finally {
				if (fs.existsSync(data.outputPath)) {
					await fs.promises.rmdir(data.outputPath, {recursive: true});
				}
			}
		});
		it('should error on build release page (/releases/index.html)', async () => {
			const builder = new DoculaBuilder();
			const data = doculaData;
			data.templates = {
				index: 'index.hbs',
				releases: 'releases.hbs',
			};
			data.sitePath = 'site';
			data.templatePath = 'template';
			data.outputPath = 'test/temp-release-test';

			data.github = undefined;

			if (fs.existsSync(data.outputPath)) {
				await fs.promises.rmdir(data.outputPath, {recursive: true});
			}

			try {
				await builder.buildReleasePage(data);
			} catch (error: any) {
				expect(error.message).toBe('No github data found');
			} finally {
				if (fs.existsSync(data.outputPath)) {
					await fs.promises.rmdir(data.outputPath, {recursive: true});
				}
			}
		});
	});

	describe('Docula Builder - Build Docs', () => {
		it('should build the docs pages', async () => {
			const builder = new DoculaBuilder();
			const data = doculaData;
			data.templates = {
				index: 'index.hbs',
				releases: 'releases.hbs',
				docPage: 'docs.hbs',
			};
			data.sitePath = 'site';
			data.templatePath = 'test/fixtures/template-example';
			data.outputPath = 'test/temp-index-test';
			data.hasDocuments = true;
			data.sections = [{
				name: 'foo', path: 'foo',
			}];
			data.documents = [{
				title: 'Document title',
				navTitle: 'Document',
				description: 'Document description',
				keywords: [],
				content: '',
				markdown: '',
				generatedHtml: '',
				documentPath: '',
				urlPath: '/docs/document.html',
				isRoot: true,
			}];

			if (fs.existsSync(data.outputPath)) {
				await fs.promises.rmdir(data.outputPath, {recursive: true});
			}

			try {
				await builder.buildDocsPages(data);
				expect(fs.existsSync(`${data.outputPath}/docs/document.html`)).toBe(true);
			} finally {
				if (fs.existsSync(data.outputPath)) {
					await fs.promises.rmdir(data.outputPath, {recursive: true});
				}
			}
		});
		it('should throw error when template doesnt exist', async () => {
			const builder = new DoculaBuilder();
			const data = doculaData;
			data.templates = undefined;
			data.sitePath = 'site';
			data.templatePath = 'test/fixtures/no-template-example';
			data.outputPath = 'test/temp-index-test';

			if (fs.existsSync(data.outputPath)) {
				await fs.promises.rmdir(data.outputPath, {recursive: true});
			}

			try {
				await builder.buildDocsPages(data);
			} catch (error: any) {
				expect(error.message).toBe('No templates found');
			}
		});
		it('should get top level documents from mega fixtures', () => {
			const builder = new DoculaBuilder();
			const documentsPath = 'test/fixtures/mega-page-site/docs';
			const documents = builder.getDocumentInDirectory(documentsPath);
			expect(documents.length).toBe(3);
		});
		it('should get all the documents from the mega fixtures', () => {
			const builder = new DoculaBuilder();
			const doculaData: DoculaData = {
				siteUrl: 'http://foo.com',
				siteTitle: 'docula',
				siteDescription: 'Beautiful Website for Your Projects',
				sitePath: 'test/fixtures/mega-page-site',
				templatePath: 'test/fixtures/template-example',
				outputPath: 'test/temp-sitemap-test',
			};
			const documentsPath = 'test/fixtures/mega-page-site/docs';
			const documents = builder.getDocuments(documentsPath, doculaData);
			expect(documents.length).toBe(21);
		});
	});

	describe('Docula Builder - Sections', () => {
		it('should merge sections based on what you find in options', () => {
			const builder = new DoculaBuilder();
			const options = new DoculaOptions();
			options.sections = [
				{name: 'foo snizzle', path: 'caching', order: 1},
				{name: 'bar', path: 'bar', order: 2},
			];

			const section: DoculaSection = {
				name: 'foo',
				path: 'caching',
			};

			const mergedSection = builder.mergeSectionWithOptions(section, options);
			expect(mergedSection.name).toBe('foo snizzle');
			expect(mergedSection.order).toBe(1);
		});
		it('should get all the sections from the mega fixtures', () => {
			const builder = new DoculaBuilder();
			const documentsPath = 'test/fixtures/mega-page-site/docs';
			const options = new DoculaOptions();
			options.sections = [
				{name: 'Caching', path: 'caching', order: 2},
				{name: 'Compression', path: 'compression', order: 1},
			];
			const sections = builder.getSections(documentsPath, options);
			expect(sections.length).toBe(3);
			expect(sections[0].name).toBe('Compression');
			expect(sections[1].name).toBe('Caching');
			expect(sections[2].name).toBe('Storage Adapters');
			expect(sections[2].order).toBe(undefined);
		});
	});

	describe('Docula Builder - Generate Sidebar Items', () => {
		it('generateSidebarItems should return an empty array if sections and documents does not exist', async () => {
			const builder = new DoculaBuilder();
			const data = doculaData;
			data.templates = {
				index: 'index.hbs',
				releases: 'releases.hbs',
			};
			data.sitePath = 'site';
			data.templatePath = 'test/fixtures/template-example';
			data.outputPath = 'test/temp-index-test';

			data.sections = undefined;
			data.documents = undefined;

			const sidebarItems = builder.generateSidebarItems(data);
			expect(sidebarItems).toStrictEqual([]);
		});
		it('generateSidebarItems should sort sidebarItems children', async () => {
			const builder = new DoculaBuilder();
			const fooChildren = {name: 'foo', path: 'foo', order: 1};
			const barChildren = {name: 'bar', path: 'bar', order: 2};
			const fooChildreNoOrder = {name: 'foo', path: 'foo'};
			const barChildrenNoOrder = {name: 'bar', path: 'bar'};

			const data = doculaData;
			data.templates = {
				index: 'index.hbs',
				releases: 'releases.hbs',
			};
			data.sitePath = 'site';
			data.templatePath = 'test/fixtures/template-example';
			data.outputPath = 'test/temp-index-test';

			data.sections = [{
				name: 'foo', path: 'foo', order: 2, children: [barChildren, fooChildren],
			}];

			const sidebarItems = builder.generateSidebarItems(data);
			expect(sidebarItems[0].children).toStrictEqual([fooChildren, barChildren]);

			data.sections = [{
				name: 'foo', path: 'foo', children: [barChildrenNoOrder, fooChildreNoOrder],
			}];
			const sidebarItemsNoOrder = builder.generateSidebarItems(data);
			expect(sidebarItemsNoOrder[0].children).toStrictEqual([barChildrenNoOrder, fooChildreNoOrder]);
		});
		it('generateSidebarItems should sort sidebarItems children with documents', async () => {
			const builder = new DoculaBuilder();
			const fooChildren = {name: 'foo', path: 'foo', order: 1};
			const barChildren = {name: 'bar', path: 'bar', order: 2};
			const documentChildren = {name: 'Document', path: 'document', order: undefined};
			const documents: DoculaDocument[] = [{
				title: 'Document title',
				navTitle: 'Document',
				description: 'Document description',
				keywords: [],
				content: '',
				markdown: '',
				generatedHtml: '',
				documentPath: '',
				urlPath: 'document',
				isRoot: false,
				section: 'foo',
			}];

			const data = doculaData;
			data.templates = {
				index: 'index.hbs',
				releases: 'releases.hbs',
			};
			data.sitePath = 'site';
			data.templatePath = 'test/fixtures/template-example';
			data.outputPath = 'test/temp-index-test';

			data.sections = [{
				name: 'foo', path: 'foo', order: 2, children: [barChildren, fooChildren],
			}];
			data.documents = documents;

			const sidebarItems = builder.generateSidebarItems(data);
			expect(sidebarItems[0].children).toStrictEqual([fooChildren, barChildren, documentChildren]);
		});
		it('generateSidebarItems should ignore a document if documentPath does not have a valid section', async () => {
			const builder = new DoculaBuilder();
			const documents: DoculaDocument[] = [{
				title: 'Document title',
				navTitle: 'Document',
				description: 'Document description',
				keywords: [],
				content: '',
				markdown: '',
				generatedHtml: '',
				documentPath: '/site/docs/bar/document.html',
				urlPath: 'document',
				isRoot: false,
			}];

			const data = doculaData;
			data.templates = {
				index: 'index.hbs',
				releases: 'releases.hbs',
			};
			data.sitePath = 'site';
			data.templatePath = 'test/fixtures/template-example';
			data.outputPath = 'test/temp-index-test';

			data.sections = [{
				name: 'foo', path: 'foo', order: 2,
			}];
			data.documents = documents;

			const sidebarItems = builder.generateSidebarItems(data);
			expect(sidebarItems[0].children).toBeUndefined();
		});
	});

	describe('Docula Builder - Document Parser', () => {
		it('should return tableOfContents undefined if markdown does not have data', async () => {
			const builder = new DoculaBuilder();

			const documentsPath = 'test/fixtures/empty.md';
			const parsedDocument = builder.parseDocumentData(documentsPath);
			expect(parsedDocument.tableOfContents).toBeUndefined();
		});
	});

	describe('Build Readme Section', async () => {
		it('should build the readme section', async () => {
			const builder = new DoculaBuilder();
			const data = doculaData;
			data.sitePath = 'site';

			const result = await builder.buildReadmeSection(data);

			expect(result).toBeTruthy();
		});

		it('no file so will return empty', async () => {
			const builder = new DoculaBuilder();
			const data = doculaData;
			data.sitePath = 'test/fixtures/single-page-site';

			const result = await builder.buildReadmeSection(data);

			expect(result).toBe('');
		});
	});
});
