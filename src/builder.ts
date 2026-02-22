import fs from "node:fs";
import path from "node:path";
import { Ecto } from "ecto";
import { Writr } from "writr";
import { DoculaConsole } from "./console.js";
import { Github, type GithubData, type GithubOptions } from "./github.js";
import { DoculaOptions } from "./options.js";

export type DoculaChangelogEntry = {
	title: string;
	date: string;
	formattedDate: string;
	tag?: string;
	tagClass?: string;
	slug: string;
	content: string;
	generatedHtml: string;
	urlPath: string;
};

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
	hasChangelog?: boolean;
	sections?: DoculaSection[];
	documents?: DoculaDocument[];
	sidebarItems?: DoculaSection[];
	announcement?: string;
	openApiUrl?: string;
	changelogEntries?: DoculaChangelogEntry[];
};

export type DoculaTemplates = {
	index: string;
	releases: string;
	docPage?: string;
	api?: string;
	changelog?: string;
	changelogEntry?: string;
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
	documentPath: string;
	urlPath: string;
	isRoot: boolean;
};

export class DoculaBuilder {
	private readonly _options: DoculaOptions = new DoculaOptions();
	private readonly _ecto: Ecto;
	private readonly _console: DoculaConsole = new DoculaConsole();

	// biome-ignore lint/suspicious/noExplicitAny: need to fix
	constructor(options?: DoculaOptions, engineOptions?: any) {
		if (options) {
			this._options = options;
		}

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
			openApiUrl: this.options.openApiUrl,
		};

		// Get data from github
		doculaData.github = await this.getGithubData(this.options.githubPath);
		// Get the documents
		doculaData.documents = this.getDocuments(
			`${doculaData.sitePath}/docs`,
			doculaData,
		);
		// Get the sections
		doculaData.sections = this.getSections(
			`${doculaData.sitePath}/docs`,
			this.options,
		);

		doculaData.hasDocuments = doculaData.documents?.length > 0;

		// Get changelog entries
		const changelogPath = `${doculaData.sitePath}/changelog`;
		doculaData.changelogEntries = this.getChangelogEntries(changelogPath);
		doculaData.hasChangelog = doculaData.changelogEntries.length > 0;

		// Get the templates to use
		doculaData.templates = await this.getTemplates(
			this.options,
			doculaData.hasDocuments,
			doculaData.hasChangelog,
		);

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

		// Build the API documentation page (/api/index.html)
		if (doculaData.openApiUrl) {
			await this.buildApiPage(doculaData);
		}

		// Build changelog pages (/changelog/index.html and /changelog/{slug}/index.html)
		if (doculaData.hasChangelog) {
			await this.buildChangelogPage(doculaData);
			await this.buildChangelogEntryPages(doculaData);
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
		/* v8 ignore next -- @preserve */
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

		// Copy over public folder contents
		this.copyPublicFolder(siteRelativePath, this.options.outputPath);

		const endTime = Date.now();

		const executionTime = endTime - startTime;

		this._console.log(`Build completed in ${executionTime}ms`);
	}

	public validateOptions(options: DoculaOptions): void {
		if (options.githubPath.length < 3) {
			throw new Error("No github options provided");
		}

		if (options.siteDescription.length < 3) {
			throw new Error("No site description options provided");
		}

		if (!options.siteTitle) {
			throw new Error("No site title options provided");
		}

		if (!options.siteUrl) {
			throw new Error("No site url options provided");
		}
	}

	public async getGithubData(githubPath: string): Promise<GithubData> {
		const paths = githubPath.split("/");
		const options: GithubOptions = {
			author: paths[0],
			repo: paths[1],
		};
		const github = new Github(options);
		return github.getData();
	}

	public async getTemplates(
		options: DoculaOptions,
		hasDocuments: boolean,
		hasChangelog = false,
	): Promise<DoculaTemplates> {
		const templates: DoculaTemplates = {
			index: "",
			releases: "",
		};

		if (fs.existsSync(options.templatePath)) {
			const index = await this.getTemplateFile(options.templatePath, "index");
			/* v8 ignore next -- @preserve */
			if (index) {
				templates.index = index;
			}

			/* v8 ignore next -- @preserve */
			const releases = await this.getTemplateFile(
				options.templatePath,
				"releases",
			);

			/* v8 ignore next -- @preserve */
			if (releases) {
				templates.releases = releases;
			}

			const documentPage = hasDocuments
				? await this.getTemplateFile(options.templatePath, "docs")
				: undefined;

			if (documentPage) {
				templates.docPage = documentPage;
			}

			const apiPage = options.openApiUrl
				? await this.getTemplateFile(options.templatePath, "api")
				: undefined;

			if (apiPage) {
				templates.api = apiPage;
			}

			const changelogPage = hasChangelog
				? await this.getTemplateFile(options.templatePath, "changelog")
				: undefined;

			if (changelogPage) {
				templates.changelog = changelogPage;
			}

			const changelogEntryPage = hasChangelog
				? await this.getTemplateFile(options.templatePath, "changelog-entry")
				: undefined;

			if (changelogEntryPage) {
				templates.changelogEntry = changelogEntryPage;
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
		let result: string | undefined;
		const files = await fs.promises.readdir(path);
		for (const file of files) {
			const fileName = file.split(".");
			if (fileName[0].toString().toLowerCase() === name.toLowerCase()) {
				result = file.toString();
				break;
			}
		}

		return result;
	}

	public async buildRobotsPage(options: DoculaOptions): Promise<void> {
		const { sitePath } = options;
		const { outputPath } = options;
		const robotsPath = `${outputPath}/robots.txt`;

		await fs.promises.mkdir(outputPath, { recursive: true });

		await (fs.existsSync(`${sitePath}/robots.txt`)
			? fs.promises.copyFile(`${sitePath}/robots.txt`, robotsPath)
			: fs.promises.writeFile(robotsPath, "User-agent: *\nDisallow:"));
	}

	public async buildSiteMapPage(data: DoculaData): Promise<void> {
		const sitemapPath = `${data.outputPath}/sitemap.xml`;
		const urls = [{ url: data.siteUrl }, { url: `${data.siteUrl}/releases` }];

		if (data.openApiUrl && data.templates?.api) {
			urls.push({ url: `${data.siteUrl}/api` });
		}

		if (data.hasChangelog && data.templates?.changelog) {
			urls.push({ url: `${data.siteUrl}/changelog` });
			for (const entry of data.changelogEntries ?? []) {
				urls.push({
					url: `${data.siteUrl}/changelog/${entry.slug}`,
				});
			}
		}

		// Add all the document urls
		for (const document of data.documents ?? []) {
			let { urlPath } = document;
			/* v8 ignore next -- @preserve */
			if (urlPath.endsWith("index.html")) {
				urlPath = urlPath.slice(0, -10);
			}

			urls.push({ url: `${data.siteUrl}${urlPath}` });
		}

		let xml = '<?xml version="1.0" encoding="UTF-8"?>';
		xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">';

		for (const { url } of urls) {
			xml += "<url>";
			xml += `<loc>${url}</loc>`;
			xml += "</url>";
		}

		xml += "</urlset>";

		await fs.promises.mkdir(data.outputPath, { recursive: true });

		await fs.promises.writeFile(sitemapPath, xml, "utf8");
	}

	public async buildIndexPage(data: DoculaData): Promise<void> {
		if (data.templates) {
			const indexPath = `${data.outputPath}/index.html`;

			await fs.promises.mkdir(data.outputPath, { recursive: true });

			const indexTemplate = `${data.templatePath}/${data.templates.index}`;

			let content: string | undefined;

			if (!data.hasDocuments) {
				content = await this.buildReadmeSection(data);
			}

			const announcement = await this.buildAnnouncementSection(data);

			const indexContent = await this._ecto.renderFromFile(
				indexTemplate,
				{ ...data, content, announcement },
				data.templatePath,
			);
			await fs.promises.writeFile(indexPath, indexContent, "utf8");
		} else {
			throw new Error("No templates found");
		}
	}

	public async buildReleasePage(data: DoculaData): Promise<void> {
		if (data.github && data.templates) {
			const releasesPath = `${data.outputPath}/releases/index.html`;
			const releaseOutputPath = `${data.outputPath}/releases`;

			await fs.promises.mkdir(releaseOutputPath, { recursive: true });

			const releasesTemplate = `${data.templatePath}/${data.templates.releases}`;
			const releasesContent = await this._ecto.renderFromFile(
				releasesTemplate,
				data,
				data.templatePath,
			);
			await fs.promises.writeFile(releasesPath, releasesContent, "utf8");
		} else {
			throw new Error("No github data found");
		}
	}

	public async buildReadmeSection(data: DoculaData): Promise<string> {
		let htmlReadme = "";
		if (fs.existsSync(`${data.sitePath}/README.md`)) {
			const readmeContent = fs.readFileSync(
				`${data.sitePath}/README.md`,
				"utf8",
			);
			htmlReadme = await new Writr(readmeContent).render();
		}

		return htmlReadme;
	}

	public async buildAnnouncementSection(
		data: DoculaData,
	): Promise<string | undefined> {
		const announcementPath = `${data.sitePath}/announcement.md`;
		if (fs.existsSync(announcementPath)) {
			const announcementContent = fs.readFileSync(announcementPath, "utf8");
			return new Writr(announcementContent).render();
		}

		return undefined;
	}

	public async buildDocsPages(data: DoculaData): Promise<void> {
		if (data.templates && data.documents?.length) {
			const documentsTemplate = `${data.templatePath}/${data.templates.docPage}`;
			await fs.promises.mkdir(`${data.outputPath}/docs`, { recursive: true });
			data.sidebarItems = this.generateSidebarItems(data);

			const promises = data.documents.map(async (document) => {
				const folder = document.urlPath.split("/").slice(0, -1).join("/");
				await fs.promises.mkdir(`${data.outputPath}/${folder}`, {
					recursive: true,
				});
				const slug = `${data.outputPath}${document.urlPath}`;
				const documentContent = await this._ecto.renderFromFile(
					documentsTemplate,
					{ ...data, ...document },
					data.templatePath,
				);
				return fs.promises.writeFile(slug, documentContent, "utf8");
			});
			await Promise.all(promises);
		} else {
			throw new Error("No templates found");
		}
	}

	public async buildApiPage(data: DoculaData): Promise<void> {
		if (!data.openApiUrl || !data.templates?.api) {
			return;
		}

		const apiPath = `${data.outputPath}/api/index.html`;
		const apiOutputPath = `${data.outputPath}/api`;

		await fs.promises.mkdir(apiOutputPath, { recursive: true });

		const apiTemplate = `${data.templatePath}/${data.templates.api}`;
		const apiContent = await this._ecto.renderFromFile(
			apiTemplate,
			{ ...data, specUrl: data.openApiUrl },
			data.templatePath,
		);
		await fs.promises.writeFile(apiPath, apiContent, "utf8");
	}

	public getChangelogEntries(changelogPath: string): DoculaChangelogEntry[] {
		const entries: DoculaChangelogEntry[] = [];
		if (!fs.existsSync(changelogPath)) {
			return entries;
		}

		const files = fs.readdirSync(changelogPath);
		for (const file of files) {
			const filePath = `${changelogPath}/${file}`;
			const stats = fs.statSync(filePath);
			if (stats.isFile() && (file.endsWith(".md") || file.endsWith(".mdx"))) {
				const entry = this.parseChangelogEntry(filePath);
				entries.push(entry);
			}
		}

		// Sort by date descending (newest first), invalid dates go to the end
		entries.sort((a, b) => {
			const dateA = new Date(a.date).getTime();
			const dateB = new Date(b.date).getTime();
			if (Number.isNaN(dateA) && Number.isNaN(dateB)) {
				return 0;
			}

			if (Number.isNaN(dateA)) {
				return 1;
			}

			if (Number.isNaN(dateB)) {
				return -1;
			}

			return dateB - dateA;
		});

		return entries;
	}

	public parseChangelogEntry(filePath: string): DoculaChangelogEntry {
		const fileContent = fs.readFileSync(filePath, "utf8");
		const writr = new Writr(fileContent);
		const matterData = writr.frontMatter;
		const markdownContent = writr.body;

		const fileName = path.basename(filePath, path.extname(filePath));
		// Remove leading date prefix pattern (YYYY-MM-DD-) if present
		const slug = fileName.replace(/^\d{4}-\d{2}-\d{2}-/, "");

		const isMdx = filePath.endsWith(".mdx");

		const tag = matterData.tag as string | undefined;
		const tagClass = tag ? tag.toLowerCase().replace(/\s+/g, "-") : undefined;

		// Handle date as Date object or string
		let dateString = "";
		if (matterData.date instanceof Date) {
			dateString = matterData.date.toISOString().split("T")[0];
		} else if (matterData.date) {
			dateString = String(matterData.date);
		}

		// Format date for display; fall back to raw string for unparseable dates
		let formattedDate = dateString;
		const parsedDate = new Date(dateString);
		if (!Number.isNaN(parsedDate.getTime())) {
			formattedDate = parsedDate.toLocaleDateString("en-US", {
				year: "numeric",
				month: "long",
				day: "numeric",
			});
		}

		return {
			title: matterData.title ?? fileName,
			date: dateString,
			formattedDate,
			tag,
			tagClass,
			slug,
			content: markdownContent,
			generatedHtml: new Writr(markdownContent).renderSync({ mdx: isMdx }),
			urlPath: `/changelog/${slug}/index.html`,
		};
	}

	public async buildChangelogPage(data: DoculaData): Promise<void> {
		if (!data.hasChangelog || !data.templates?.changelog) {
			return;
		}

		const changelogOutputPath = `${data.outputPath}/changelog`;
		const changelogIndexPath = `${changelogOutputPath}/index.html`;

		await fs.promises.mkdir(changelogOutputPath, { recursive: true });

		const changelogTemplate = `${data.templatePath}/${data.templates.changelog}`;
		const changelogContent = await this._ecto.renderFromFile(
			changelogTemplate,
			{ ...data, entries: data.changelogEntries },
			data.templatePath,
		);
		await fs.promises.writeFile(changelogIndexPath, changelogContent, "utf8");
	}

	public async buildChangelogEntryPages(data: DoculaData): Promise<void> {
		if (
			!data.hasChangelog ||
			!data.templates?.changelogEntry ||
			!data.changelogEntries?.length
		) {
			return;
		}

		const entryTemplate = `${data.templatePath}/${data.templates.changelogEntry}`;

		const promises = data.changelogEntries.map(async (entry) => {
			const entryOutputPath = `${data.outputPath}/changelog/${entry.slug}`;
			await fs.promises.mkdir(entryOutputPath, { recursive: true });

			const entryContent = await this._ecto.renderFromFile(
				entryTemplate,
				{ ...data, ...entry, entries: data.changelogEntries },
				data.templatePath,
			);

			const entryFilePath = `${entryOutputPath}/index.html`;
			return fs.promises.writeFile(entryFilePath, entryContent, "utf8");
		});

		await Promise.all(promises);
	}

	public generateSidebarItems(data: DoculaData): DoculaSection[] {
		let sidebarItems = [...(data.sections ?? [])];

		for (const document of data.documents ?? []) {
			if (document.isRoot) {
				sidebarItems.unshift({
					path: document.urlPath.replace("index.html", ""),
					name: document.navTitle,
					order: document.order,
				});
			} else {
				const relativeFilePath = document.documentPath.replace(
					`${data.sitePath}/docs/`,
					"",
				);
				const sectionPath = relativeFilePath.slice(
					0,
					Math.max(0, relativeFilePath.lastIndexOf("/")),
				);
				const documentSection = document.section ?? sectionPath;

				const sectionIndex = sidebarItems.findIndex(
					(section) => section.path === documentSection,
				);

				if (sectionIndex === -1) {
					continue;
				}

				sidebarItems[sectionIndex].children ??= [];

				sidebarItems[sectionIndex].children.push({
					path: document.urlPath.replace("index.html", ""),
					name: document.navTitle,
					order: document.order,
				});
			}
		}

		// Sort the sidebarItems children
		sidebarItems = sidebarItems.map((section) => {
			if (section.children) {
				section.children.sort(
					(a, b) =>
						// biome-ignore lint/style/noNonNullAssertion: need to fix
						(a.order ?? section.children!.length) -
						// biome-ignore lint/style/noNonNullAssertion: need to fix
						(b.order ?? section.children!.length),
				);
			}

			return section;
		});

		// Sort the sidebarItems
		sidebarItems.sort(
			(a, b) =>
				(a.order ?? sidebarItems.length) - (b.order ?? sidebarItems.length),
		);

		return sidebarItems;
	}

	public getDocuments(
		sitePath: string,
		doculaData: DoculaData,
	): DoculaDocument[] {
		let documents: DoculaDocument[] = [];
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
		const documents: DoculaDocument[] = [];
		const documentList = fs.readdirSync(sitePath);
		/* v8 ignore next -- @preserve */
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
		documents.sort(
			(a, b) => (a.order ?? documents.length) - (b.order ?? documents.length),
		);

		return documents;
	}

	public getSections(
		sitePath: string,
		doculaOptions: DoculaOptions,
	): DoculaSection[] {
		const sections: DoculaSection[] = [];
		if (fs.existsSync(sitePath)) {
			const documentList = fs.readdirSync(sitePath);
			/* v8 ignore next -- @preserve */
			if (documentList.length > 0) {
				for (const document of documentList) {
					const documentPath = `${sitePath}/${document}`;
					const stats = fs.statSync(documentPath);
					if (stats.isDirectory()) {
						const section: DoculaSection = {
							name: document
								.replaceAll("-", " ")
								.replaceAll(/\b\w/g, (l) => l.toUpperCase()),
							path: document,
						};

						this.mergeSectionWithOptions(section, doculaOptions);

						sections.push(section);
					}
				}
			}

			// Sort the sections by order
			sections.sort(
				(a, b) => (a.order ?? sections.length) - (b.order ?? sections.length),
			);
		}

		return sections;
	}

	public mergeSectionWithOptions(
		section: DoculaSection,
		options: DoculaOptions,
	): DoculaSection {
		if (options.sections) {
			const sectionOptions = options.sections.find(
				(sectionOption) => sectionOption.path === section.path,
			);

			if (sectionOptions) {
				section.name = sectionOptions.name;
				section.order = sectionOptions.order;
				section.path = sectionOptions.path;
			}
		}

		return section;
	}

	public parseDocumentData(documentPath: string): DoculaDocument {
		const documentContent = fs.readFileSync(documentPath, "utf8");
		const writr = new Writr(documentContent);
		const matterData = writr.frontMatter;
		let markdownContent = writr.body;
		markdownContent = markdownContent.replace(/^# .*\n/, "");

		// Detect file extension to determine if it's MDX or MD
		/* v8 ignore next -- @preserve */
		const isMdx = documentPath.endsWith(".mdx");
		/* v8 ignore next -- @preserve */
		const fileExtension = isMdx ? ".mdx" : ".md";

		const documentsFolderIndex = documentPath.lastIndexOf("/docs/");
		let urlPath = documentPath
			.slice(documentsFolderIndex)
			.replace(fileExtension, "/index.html");
		let isRoot = urlPath.split("/").length === 3;
		if (!documentPath.slice(documentsFolderIndex + 6).includes("/")) {
			isRoot = true;
			const filePath = documentPath.slice(documentsFolderIndex + 6);
			if (filePath === "index.md" || filePath === "index.mdx") {
				urlPath = documentPath
					.slice(documentsFolderIndex)
					.replace(fileExtension, ".html");
			}
		}

		// Prepend a TOC heading if none exists so Writr's remark-toc populates it inline
		if (!this.hasTableOfContents(markdownContent)) {
			markdownContent = `## Table of Contents\n\n${markdownContent}`;
		}

		return {
			title: matterData.title,

			navTitle: matterData.navTitle ?? matterData.title,

			description: matterData.description ?? "",

			order: matterData.order ?? undefined,

			section: matterData.section ?? undefined,

			keywords: matterData.keywords ?? [],
			content: documentContent,
			markdown: markdownContent,
			generatedHtml: new Writr(markdownContent).renderSync({
				toc: true,
				mdx: isMdx,
			}),
			documentPath,
			urlPath,
			isRoot,
		};
	}

	private hasTableOfContents(markdown: string): boolean {
		const normalized = markdown.replace(/\r\n/g, "\n");
		const atxHeading = /^#{1,6}\s*(table of contents|toc)\s*$/im;
		const setextHeading = /^(table of contents|toc)\s*\n[-=]{2,}\s*$/im;
		const htmlHeading = /<h[1-6][^>]*>\s*(table of contents|toc)\s*<\/h[1-6]>/i;

		return (
			atxHeading.test(normalized) ||
			setextHeading.test(normalized) ||
			htmlHeading.test(normalized)
		);
	}

	private copyDirectory(source: string, target: string): void {
		const files = fs.readdirSync(source);

		for (const file of files) {
			/* v8 ignore next -- @preserve */
			if (file.startsWith(".")) {
				continue;
			}

			const sourcePath = `${source}/${file}`;
			const targetPath = `${target}/${file}`;

			const stat = fs.lstatSync(sourcePath);

			if (stat.isDirectory()) {
				fs.mkdirSync(targetPath, { recursive: true });
				this.copyDirectory(sourcePath, targetPath);
			} else {
				fs.mkdirSync(target, { recursive: true });
				fs.copyFileSync(sourcePath, targetPath);
			}
		}
	}

	private copyPublicFolder(sitePath: string, outputPath: string): void {
		const publicPath = `${sitePath}/public`;

		if (!fs.existsSync(publicPath)) {
			return;
		}

		this._console.log("Public folder found, copying contents to dist...");

		const resolvedOutputPath = path.resolve(outputPath);
		this.copyPublicDirectory(
			publicPath,
			outputPath,
			publicPath,
			resolvedOutputPath,
		);
	}

	private copyPublicDirectory(
		source: string,
		target: string,
		basePath: string,
		outputPath: string,
	): void {
		const files = fs.readdirSync(source);

		for (const file of files) {
			const sourcePath = `${source}/${file}`;
			const targetPath = `${target}/${file}`;
			const relativePath = sourcePath.replace(`${basePath}/`, "");

			// Skip if source path is inside or equals the output path to prevent recursive copying
			const resolvedSourcePath = path.resolve(sourcePath);
			if (
				resolvedSourcePath === outputPath ||
				resolvedSourcePath.startsWith(`${outputPath}${path.sep}`)
			) {
				continue;
			}

			const stat = fs.lstatSync(sourcePath);

			if (stat.isDirectory()) {
				fs.mkdirSync(targetPath, { recursive: true });
				this.copyPublicDirectory(sourcePath, targetPath, basePath, outputPath);
			} else {
				fs.mkdirSync(target, { recursive: true });
				fs.copyFileSync(sourcePath, targetPath);
				this._console.log(`  Copied: ${relativePath}`);
			}
		}
	}
}
