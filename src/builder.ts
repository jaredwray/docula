
import fs from 'node:fs';
import {Ecto} from 'ecto';
import {Writr} from 'writr';
import he from 'he';
import * as cheerio from 'cheerio';
import {DoculaOptions} from './options.js';
import {DoculaConsole} from './console.js';
import {Github, type GithubData, type GithubOptions} from './github.js';

export type DoculaData = {
	siteUrl: string;
	siteTitle: string;
	siteDescription: string;
	sitePath: string;
	templatePath: string;
	outputPath: string;
	githubPath?: string;
	github?: GithubData;
	templates?: DoculaTemplates;
	hasDocuments?: boolean;
	sections?: DoculaSection[];
	documents?: DoculaDocument[];
	sidebarItems?: DoculaSection[];
};

export type DoculaTemplates = {
	index: string;
	releases: string;
	docPage?: string;
};

export type DoculaSection = {
	name: string;
	order?: number;
	path: string;
	children?: DoculaSection[];
};

export type DoculaDocument = {
	title: string;
	navTitle: string;
	description: string;
	order?: number;
	section?: string;
	keywords: string[];
	content: string;
	markdown: string;
	generatedHtml: string;
	tableOfContents?: string;
	documentPath: string;
	urlPath: string;
	isRoot: boolean;
};

export class DoculaBuilder {
	private readonly _options: DoculaOptions = new DoculaOptions();
	private readonly _ecto: Ecto;
	private readonly _console: DoculaConsole = new DoculaConsole();

	constructor(options?: DoculaOptions, engineOptions?: any) {
		if (options) {
			this._options = options;
		}

		// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
		this._ecto = new Ecto(engineOptions);
	}

	public get options(): DoculaOptions {
		return this._options;
	}

	public async build(): Promise<void> {
		const startTime = Date.now();

		// Validate the options
		this.validateOptions(this.options);
		// Set the site options
		const doculaData: DoculaData = {
			siteUrl: this.options.siteUrl,
			siteTitle: this.options.siteTitle,
			siteDescription: this.options.siteDescription,
			sitePath: this.options.sitePath,
			templatePath: this.options.templatePath,
			outputPath: this.options.outputPath,
			githubPath: this.options.githubPath,
			sections: this.options.sections,
		};

		// Get data from github
		doculaData.github = await this.getGithubData(this.options.githubPath);
		// Get the documents
		doculaData.documents = this.getDocuments(`${doculaData.sitePath}/docs`, doculaData);
		// Get the sections
		doculaData.sections = this.getSections(`${doculaData.sitePath}/docs`, this.options);

		doculaData.hasDocuments = doculaData.documents?.length > 0;

		// Get the templates to use
		doculaData.templates = await this.getTemplates(this.options, doculaData.hasDocuments);

		// Build the home page (index.html)
		await this.buildIndexPage(doculaData);

		// Build the releases page (/releases/index.html)
		await this.buildReleasePage(doculaData);

		// Build the sitemap (/sitemap.xml)
		await this.buildSiteMapPage(doculaData);

		// Build the robots.txt (/robots.txt)
		await this.buildRobotsPage(this.options);

		if (doculaData.hasDocuments) {
			await this.buildDocsPages(doculaData);
		}

		const siteRelativePath = this.options.sitePath;

		// Copy over favicon
		if (fs.existsSync(`${siteRelativePath}/favicon.ico`)) {
			await fs.promises.copyFile(
				`${siteRelativePath}/favicon.ico`,
				`${this.options.outputPath}/favicon.ico`,
			);
		}

		// Copy over logo
		if (fs.existsSync(`${siteRelativePath}/logo.svg`)) {
			await fs.promises.copyFile(
				`${siteRelativePath}/logo.svg`,
				`${this.options.outputPath}/logo.svg`,
			);
		}

		// Copy over logo_horizontal
		if (fs.existsSync(`${siteRelativePath}/logo_horizontal.png`)) {
			await fs.promises.copyFile(
				`${siteRelativePath}/logo_horizontal.png`,
				`${this.options.outputPath}/logo_horizontal.png`,
			);
		}

		// Copy over css
		if (fs.existsSync(`${this.options.templatePath}/css`)) {
			this.copyDirectory(
				`${this.options.templatePath}/css`,
				`${this.options.outputPath}/css`,
			);
		}

		// Copy over variables
		if (fs.existsSync(`${siteRelativePath}/variables.css`)) {
			await fs.promises.copyFile(
				`${siteRelativePath}/variables.css`,
				`${this.options.outputPath}/css/variables.css`,
			);
		}

		const endTime = Date.now();

		const executionTime = endTime - startTime;

		this._console.log(`Build completed in ${executionTime}ms`);
	}

	public validateOptions(options: DoculaOptions): void {
		if (options.githubPath.length < 3) {
			throw new Error('No github options provided');
		}

		if (options.siteDescription.length < 3) {
			throw new Error('No site description options provided');
		}

		if (!options.siteTitle) {
			throw new Error('No site title options provided');
		}

		if (!options.siteUrl) {
			throw new Error('No site url options provided');
		}
	}

	public async getGithubData(githubPath: string): Promise<GithubData> {
		const paths = githubPath.split('/');
		const options: GithubOptions = {
			author: paths[0],
			repo: paths[1],
		};
		const github = new Github(options);
		return github.getData();
	}

	public async getTemplates(options: DoculaOptions, hasDocuments: boolean): Promise<DoculaTemplates> {
		const templates: DoculaTemplates = {
			index: '',
			releases: '',
		};

		if (fs.existsSync(options.templatePath)) {
			const index = await this.getTemplateFile(options.templatePath, 'index');
			if (index) {
				templates.index = index;
			}

			const releases = await this.getTemplateFile(
				options.templatePath,
				'releases',
			);
			if (releases) {
				templates.releases = releases;
			}

			const documentPage = hasDocuments
				? await this.getTemplateFile(
					options.templatePath,
					'docs',
				)
				: undefined;

			if (documentPage) {
				templates.docPage = documentPage;
			}
		} else {
			throw new Error(`No template path found at ${options.templatePath}`);
		}

		return templates;
	}

	public async getTemplateFile(
		path: string,
		name: string,
	): Promise<string | undefined> {
		let result;
		const files = await fs.promises.readdir(path);
		for (const file of files) {
			const fileName = file.split('.');
			if (fileName[0].toString().toLowerCase() === name.toLowerCase()) {
				result = file.toString();
				break;
			}
		}

		return result;
	}

	public async buildRobotsPage(options: DoculaOptions): Promise<void> {
		const {sitePath} = options;
		const {outputPath} = options;
		const robotsPath = `${outputPath}/robots.txt`;

		await fs.promises.mkdir(outputPath, {recursive: true});

		await ((fs.existsSync(`${sitePath}/robots.txt`))
			? fs.promises.copyFile(`${sitePath}/robots.txt`, robotsPath)
			: fs.promises.writeFile(robotsPath, 'User-agent: *\nDisallow:'));
	}

	public async buildSiteMapPage(data: DoculaData): Promise<void> {
		const sitemapPath = `${data.outputPath}/sitemap.xml`;
		const urls = [{url: data.siteUrl}, {url: `${data.siteUrl}/releases`}];

		// Add all the document urls
		for (const document of data.documents ?? []) {
			let {urlPath} = document;
			if (urlPath.endsWith('index.html')) {
				urlPath = urlPath.slice(0, -10);
			}

			urls.push({url: `${data.siteUrl}${urlPath}`});
		}

		let xml = '<?xml version="1.0" encoding="UTF-8"?>';
		xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">';

		for (const {url} of urls) {
			xml += '<url>';
			xml += `<loc>${url}</loc>`;
			xml += '</url>';
		}

		xml += '</urlset>';

		await fs.promises.mkdir(data.outputPath, {recursive: true});

		await fs.promises.writeFile(sitemapPath, xml, 'utf8');
	}

	public async buildIndexPage(data: DoculaData): Promise<void> {
		if (data.templates) {
			const indexPath = `${data.outputPath}/index.html`;

			await fs.promises.mkdir(data.outputPath, {recursive: true});

			const indexTemplate = `${data.templatePath}/${data.templates.index}`;

			let content;

			if (!data.hasDocuments) {
				content = await this.buildReadmeSection(data);
			}

			const indexContent = await this._ecto.renderFromFile(
				indexTemplate,
				{...data, content},
				data.templatePath,
			);
			await fs.promises.writeFile(indexPath, indexContent, 'utf8');
		} else {
			throw new Error('No templates found');
		}
	}

	public async buildReleasePage(data: DoculaData): Promise<void> {
		if (data.github && data.templates) {
			const releasesPath = `${data.outputPath}/releases/index.html`;
			const releaseOutputPath = `${data.outputPath}/releases`;

			await fs.promises.mkdir(releaseOutputPath, {recursive: true});

			const releasesTemplate = `${data.templatePath}/${data.templates.releases}`;
			const releasesContent = await this._ecto.renderFromFile(
				releasesTemplate,
				data,
				data.templatePath,
			);
			await fs.promises.writeFile(releasesPath, releasesContent, 'utf8');
		} else {
			throw new Error('No github data found');
		}
	}

	public async buildReadmeSection(data: DoculaData): Promise<string> {
		let htmlReadme = '';
		if (fs.existsSync(`${data.sitePath}/README.md`)) {
			const readmeContent = fs.readFileSync(
				`${data.sitePath}/README.md`,
				'utf8',
			);
			htmlReadme = await this._ecto.render(readmeContent, undefined, 'markdown');
		}

		return htmlReadme;
	}

	public async buildDocsPages(data: DoculaData): Promise<void> {
		if (data.templates && data.documents?.length) {
			const documentsTemplate = `${data.templatePath}/${data.templates.docPage}`;
			await fs.promises.mkdir(`${data.outputPath}/docs`, {recursive: true});
			data.sidebarItems = this.generateSidebarItems(data);

			const promises = data.documents.map(async document => {
				const folder = document.urlPath.split('/').slice(0, -1).join('/');
				await fs.promises.mkdir(`${data.outputPath}/${folder}`, {recursive: true});
				const slug = `${data.outputPath}${document.urlPath}`;
				let documentContent = await this._ecto.renderFromFile(
					documentsTemplate,
					{...data, ...document},
					data.templatePath,
				);
				documentContent = he.decode(documentContent);

				return fs.promises.writeFile(slug, documentContent, 'utf8');
			});
			await Promise.all(promises);
		} else {
			throw new Error('No templates found');
		}
	}

	public generateSidebarItems(data: DoculaData): DoculaSection[] {
		let sidebarItems = [...(data.sections ?? [])];

		for (const document of (data.documents ?? [])) {
			if (document.isRoot) {
				sidebarItems.unshift({
					path: document.urlPath.replace('index.html', ''),
					name: document.navTitle,
					order: document.order,
				});
			} else {
				const relativeFilePath = document.documentPath.replace(`${data.sitePath}/docs/`, '');
				const sectionPath = relativeFilePath.slice(0, Math.max(0, relativeFilePath.lastIndexOf('/')));
				const documentSection = document.section ?? sectionPath;

				const sectionIndex = sidebarItems.findIndex(section => section.path === documentSection);

				if (sectionIndex === -1) {
					continue;
				}

				sidebarItems[sectionIndex].children ??= [];

				sidebarItems[sectionIndex].children.push({
					path: document.urlPath.replace('index.html', ''),
					name: document.navTitle,
					order: document.order,
				});
			}
		}

		// Sort the sidebarItems children
		sidebarItems = sidebarItems.map(section => {
			if (section.children) {
				section.children.sort((a, b) => (a.order ?? section.children!.length) - (b.order ?? section.children!.length));
			}

			return section;
		});

		// Sort the sidebarItems
		sidebarItems.sort((a, b) => (a.order ?? sidebarItems.length) - (b.order ?? sidebarItems.length));

		return sidebarItems;
	}

	public getDocuments(sitePath: string, doculaData: DoculaData): DoculaDocument[] {
		let documents = new Array<DoculaDocument>();
		if (fs.existsSync(sitePath)) {
			// Get top level documents
			documents = this.getDocumentInDirectory(sitePath);

			// Get all sections and parse them
			doculaData.sections = this.getSections(sitePath, this.options);

			// Get all documents in each section
			for (const section of doculaData.sections) {
				const sectionPath = `${sitePath}/${section.path}`;
				const sectionDocuments = this.getDocumentInDirectory(sectionPath);
				documents = [...documents, ...sectionDocuments];
			}
		}

		return documents;
	}

	public getDocumentInDirectory(sitePath: string): DoculaDocument[] {
		const documents = new Array<DoculaDocument>();
		const documentList = fs.readdirSync(sitePath);
		if (documentList.length > 0) {
			for (const document of documentList) {
				const documentPath = `${sitePath}/${document}`;
				const stats = fs.statSync(documentPath);
				if (stats.isFile()) {
					const documentData = this.parseDocumentData(documentPath);
					documents.push(documentData);
				}
			}
		}

		// Sort the documents by order
		documents.sort((a, b) => (a.order ?? documents.length) - (b.order ?? documents.length));

		return documents;
	}

	public getSections(sitePath: string, doculaOptions: DoculaOptions): DoculaSection[] {
		const sections = new Array<DoculaSection>();
		if (fs.existsSync(sitePath)) {
			const documentList = fs.readdirSync(sitePath);
			if (documentList.length > 0) {
				for (const document of documentList) {
					const documentPath = `${sitePath}/${document}`;
					const stats = fs.statSync(documentPath);
					if (stats.isDirectory()) {
						const section: DoculaSection = {
							name: document.replaceAll('-', ' ').replaceAll(/\b\w/g, l => l.toUpperCase()),
							path: document,
						};

						this.mergeSectionWithOptions(section, doculaOptions);

						sections.push(section);
					}
				}
			}

			// Sort the sections by order
			sections.sort((a, b) => (a.order ?? sections.length) - (b.order ?? sections.length));
		}

		return sections;
	}

	public mergeSectionWithOptions(section: DoculaSection, options: DoculaOptions): DoculaSection {
		if (options.sections) {
			const sectionOptions = options.sections.find(sectionOption => sectionOption.path === section.path);

			if (sectionOptions) {
				section.name = sectionOptions.name;
				section.order = sectionOptions.order;
				section.path = sectionOptions.path;
			}
		}

		return section;
	}

	public parseDocumentData(documentPath: string): DoculaDocument {
		const documentContent = fs.readFileSync(documentPath, 'utf8');
		const writr = new Writr(documentContent);
		const matterData = writr.frontMatter;
		let markdownContent = writr.body;
		markdownContent = markdownContent.replace(/^# .*\n/, '');
		const documentsFolderIndex = documentPath.lastIndexOf('/docs/');
		let urlPath = documentPath.slice(documentsFolderIndex).replace('.md', '/index.html');
		let isRoot = urlPath.split('/').length === 3;
		if (!documentPath.slice(documentsFolderIndex + 6).includes('/')) {
			isRoot = true;
			const filePath = documentPath.slice(documentsFolderIndex + 6);
			if (filePath === 'index.md') {
				urlPath = documentPath.slice(documentsFolderIndex).replace('.md', '.html');
			}
		}

		return {

			title: matterData.title,

			navTitle: matterData.navTitle ?? matterData.title,

			description: matterData.description ?? '',

			order: matterData.order ?? undefined,

			section: matterData.section ?? undefined,

			keywords: matterData.keywords ?? [],
			content: documentContent,
			markdown: markdownContent,
			generatedHtml: this._ecto.renderSync(markdownContent, undefined, 'markdown'),
			tableOfContents: this.getTableOfContents(markdownContent),
			documentPath,
			urlPath,
			isRoot,
		};
	}

	private getTableOfContents(markdown: string): string | undefined {
		markdown = `## Table of Contents\n\n${markdown}`;
		const html = this._ecto.renderSync(markdown, undefined, 'markdown');
		const $ = cheerio.load(html);
		const tocTitle = $('h2').first();
		const tocContent = tocTitle.next('ul').toString();
		if (tocContent) {
			return tocTitle.toString() + tocContent;
		}

		return undefined;
	}

	private copyDirectory(source: string, target: string): void {
		const files = fs.readdirSync(source);

		for (const file of files) {
			/* c8 ignore next 3 */
			if (file.startsWith('.')) {
				continue;
			}

			const sourcePath = `${source}/${file}`;
			const targetPath = `${target}/${file}`;

			const stat = fs.lstatSync(sourcePath);

			if (stat.isDirectory()) {
				fs.mkdirSync(targetPath, {recursive: true});
				this.copyDirectory(sourcePath, targetPath);
			} else {
				fs.mkdirSync(target, {recursive: true});
				fs.copyFileSync(sourcePath, targetPath);
			}
		}
	}
}
