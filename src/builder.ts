import fs from "node:fs";
import path from "node:path";
import { Ecto } from "ecto";
import { Writr } from "writr";
import { type ApiSpecData, parseOpenApiSpec } from "./api-parser.js";
import { DoculaConsole } from "./console.js";
import {
	Github,
	type GithubCacheConfig,
	type GithubData,
	type GithubOptions,
} from "./github.js";
import { DoculaOptions } from "./options.js";
import { resolveTemplatePath } from "./template-resolver.js";

export type DoculaChangelogEntry = {
	title: string;
	date: string;
	formattedDate: string;
	tag?: string;
	tagClass?: string;
	slug: string;
	content: string;
	generatedHtml: string;
	preview: string;
	urlPath: string;
};

export type DoculaData = {
	siteUrl: string;
	siteTitle: string;
	siteDescription: string;
	sitePath: string;
	templatePath: string;
	output: string;
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
	hasApi?: boolean;
	apiSpec?: ApiSpecData;
	changelogEntries?: DoculaChangelogEntry[];
	homePage?: boolean;
	themeMode?: string;
	cookieAuth?: {
		loginUrl: string;
		cookieName?: string;
		logoutUrl?: string;
	};
	headerLinks?: Array<{
		label: string;
		url: string;
		icon?: string;
	}>;
	enableLlmsTxt?: boolean;
	hasFeed?: boolean;
};

export type DoculaTemplates = {
	home: string;
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

		// Resolve the template path from options and apply any local overrides
		const resolvedTemplatePath = this.mergeTemplateOverrides(
			resolveTemplatePath(this.options.templatePath, this.options.template),
			this.options.sitePath,
			this.options.template,
		);

		// Set the site options
		const doculaData: DoculaData = {
			siteUrl: this.options.siteUrl,
			siteTitle: this.options.siteTitle,
			siteDescription: this.options.siteDescription,
			sitePath: this.options.sitePath,
			templatePath: resolvedTemplatePath,
			output: this.options.output,
			githubPath: this.options.githubPath,
			sections: this.options.sections,
			openApiUrl: this.options.openApiUrl,
			homePage: this.options.homePage,
			themeMode: this.options.themeMode,
			cookieAuth: this.options.cookieAuth,
			headerLinks: this.options.headerLinks,
			enableLlmsTxt: this.options.enableLlmsTxt,
		};

		// Auto-detect swagger.json if openApiUrl is not set
		if (
			!doculaData.openApiUrl &&
			fs.existsSync(`${doculaData.sitePath}/api/swagger.json`)
		) {
			doculaData.openApiUrl = "/api/swagger.json";
		}

		// Get data from github
		if (this.options.githubPath) {
			doculaData.github = await this.getGithubData(this.options.githubPath);
		}
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
		doculaData.hasFeed = doculaData.hasDocuments;

		// Get file-based changelog entries
		const changelogPath = `${doculaData.sitePath}/changelog`;
		const fileChangelogEntries = this.getChangelogEntries(changelogPath);

		// Check if a changelog template exists
		const hasChangelogTemplate =
			(await this.getTemplateFile(resolvedTemplatePath, "changelog")) !==
			undefined;

		// Merge release-based changelog entries if enabled
		let allChangelogEntries = [...fileChangelogEntries];
		if (
			this._options.enableReleaseChangelog &&
			hasChangelogTemplate &&
			doculaData.github?.releases &&
			Array.isArray(doculaData.github.releases) &&
			doculaData.github.releases.length > 0
		) {
			const releaseEntries = this.getReleasesAsChangelogEntries(
				// biome-ignore lint/suspicious/noExplicitAny: GitHub release objects
				doculaData.github.releases as any[],
			);
			allChangelogEntries = [...allChangelogEntries, ...releaseEntries];
		}

		// Sort merged entries by date descending (newest first), invalid dates go to the end
		allChangelogEntries.sort((a, b) => {
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

		doculaData.changelogEntries = allChangelogEntries;
		doculaData.hasChangelog =
			allChangelogEntries.length > 0 && hasChangelogTemplate;

		// Get the templates to use
		doculaData.templates = await this.getTemplates(
			resolvedTemplatePath,
			doculaData.hasDocuments,
			doculaData.hasChangelog,
		);
		doculaData.hasApi = Boolean(
			doculaData.openApiUrl && doculaData.templates?.api,
		);

		// Build the home page (index.html)
		this._console.step("Building pages...");
		if (!this.options.homePage && doculaData.hasDocuments) {
			await this.buildDocsHomePage(doculaData);
			this._console.fileBuilt("index.html");
		} else if (!this.options.homePage && !doculaData.hasDocuments) {
			this._console.error(
				"homePage is set to false but no documents were found in the docs directory. " +
					"Add documents to the docs/ folder or set homePage to true.",
			);
		} else {
			await this.buildIndexPage(doculaData);
			this._console.fileBuilt("index.html");
		}

		// Build the sitemap (/sitemap.xml)
		await this.buildSiteMapPage(doculaData);
		this._console.fileBuilt("sitemap.xml");

		// Build the robots.txt (/robots.txt)
		await this.buildRobotsPage(this.options);
		this._console.fileBuilt("robots.txt");

		// Build the RSS feed (/feed.xml)
		if (doculaData.hasDocuments) {
			await this.buildFeedPage(doculaData);
			this._console.fileBuilt("feed.xml");
		}

		if (doculaData.hasDocuments) {
			this._console.step("Building documentation pages...");
			await this.buildDocsPages(doculaData);
			/* v8 ignore next 3 -- @preserve */
			for (const document of doculaData.documents ?? []) {
				this._console.fileBuilt(document.urlPath);
			}
		}

		// Build the API documentation page (/api/index.html)
		if (doculaData.hasApi) {
			this._console.step("Building API page...");
			await this.buildApiPage(doculaData);
			this._console.fileBuilt("api/index.html");
		}

		// Build changelog pages (/changelog/index.html and /changelog/{slug}/index.html)
		if (doculaData.hasChangelog) {
			this._console.step("Building changelog...");
			await this.buildChangelogPage(doculaData);
			this._console.fileBuilt("changelog/index.html");
			await this.buildChangelogEntryPages(doculaData);
			/* v8 ignore next 3 -- @preserve */
			for (const entry of doculaData.changelogEntries ?? []) {
				this._console.fileBuilt(`changelog/${entry.slug}/index.html`);
			}
		}

		const siteRelativePath = this.options.sitePath;

		this._console.step("Copying assets...");

		// Copy over favicon
		if (fs.existsSync(`${siteRelativePath}/favicon.ico`)) {
			await fs.promises.copyFile(
				`${siteRelativePath}/favicon.ico`,
				`${this.options.output}/favicon.ico`,
			);
			this._console.fileCopied("favicon.ico");
		}

		// Copy over logo
		if (fs.existsSync(`${siteRelativePath}/logo.svg`)) {
			await fs.promises.copyFile(
				`${siteRelativePath}/logo.svg`,
				`${this.options.output}/logo.svg`,
			);
			this._console.fileCopied("logo.svg");
		}

		// Copy over logo_horizontal
		if (fs.existsSync(`${siteRelativePath}/logo_horizontal.png`)) {
			await fs.promises.copyFile(
				`${siteRelativePath}/logo_horizontal.png`,
				`${this.options.output}/logo_horizontal.png`,
			);
			this._console.fileCopied("logo_horizontal.png");
		}

		// Copy over css
		/* v8 ignore next -- @preserve */
		if (fs.existsSync(`${resolvedTemplatePath}/css`)) {
			this.copyDirectory(
				`${resolvedTemplatePath}/css`,
				`${this.options.output}/css`,
			);
			this._console.fileCopied("css/");
		}

		// Copy over js
		/* v8 ignore next -- @preserve */
		if (fs.existsSync(`${resolvedTemplatePath}/js`)) {
			this.copyDirectory(
				`${resolvedTemplatePath}/js`,
				`${this.options.output}/js`,
			);
			this._console.fileCopied("js/");
		}

		// Copy over variables
		if (fs.existsSync(`${siteRelativePath}/variables.css`)) {
			await fs.promises.copyFile(
				`${siteRelativePath}/variables.css`,
				`${this.options.output}/css/variables.css`,
			);
			this._console.fileCopied("css/variables.css");
		}

		// Copy over public folder contents
		this.copyPublicFolder(siteRelativePath, this.options.output);

		// Copy non-markdown assets from changelog/ to output
		this.copyContentAssets(
			`${doculaData.sitePath}/changelog`,
			`${this.options.output}/changelog`,
		);

		// Copy assets from each document's source directory into its output directory
		// so that relative paths in markdown (e.g. images/diagram.png) resolve correctly
		if (doculaData.documents?.length) {
			this.copyDocumentSiblingAssets(doculaData);
		}

		// Build LLM index/content files after static assets are in place
		/* v8 ignore next 3 -- @preserve */
		if (this.options.enableLlmsTxt) {
			this._console.step("Building LLM files...");
		}

		await this.buildLlmsFiles(doculaData);

		const endTime = Date.now();

		const executionTime = endTime - startTime;

		this._console.success(`Build completed in ${executionTime}ms`);
	}

	public validateOptions(options: DoculaOptions): void {
		if (options.githubPath && !options.githubPath.includes("/")) {
			throw new Error("githubPath must be in 'owner/repo' format");
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
		let cacheConfig: GithubCacheConfig | undefined;
		/* v8 ignore next 5 -- @preserve */
		if (this._options.cache.github.ttl > 0) {
			cacheConfig = {
				cachePath: path.join(this._options.sitePath, ".cache"),
				ttl: this._options.cache.github.ttl,
			};
		}

		const github = new Github(options, cacheConfig);
		return github.getData();
	}

	public async getTemplates(
		templatePath: string,
		hasDocuments: boolean,
		hasChangelog = false,
	): Promise<DoculaTemplates> {
		const templates: DoculaTemplates = {
			home: "",
		};

		if (fs.existsSync(templatePath)) {
			const home = await this.getTemplateFile(templatePath, "home");
			/* v8 ignore next -- @preserve */
			if (home) {
				templates.home = home;
			}

			const documentPage = hasDocuments
				? await this.getTemplateFile(templatePath, "docs")
				: undefined;

			if (documentPage) {
				templates.docPage = documentPage;
			}

			const apiPage = await this.getTemplateFile(templatePath, "api");

			if (apiPage) {
				templates.api = apiPage;
			}

			const changelogPage = hasChangelog
				? await this.getTemplateFile(templatePath, "changelog")
				: undefined;

			if (changelogPage) {
				templates.changelog = changelogPage;
			}

			const changelogEntryPage = hasChangelog
				? await this.getTemplateFile(templatePath, "changelog-entry")
				: undefined;

			if (changelogEntryPage) {
				templates.changelogEntry = changelogEntryPage;
			}
		} else {
			throw new Error(`No template path found at ${templatePath}`);
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
		const { output } = options;
		const robotsPath = `${output}/robots.txt`;

		await fs.promises.mkdir(output, { recursive: true });

		await (fs.existsSync(`${sitePath}/robots.txt`)
			? fs.promises.copyFile(`${sitePath}/robots.txt`, robotsPath)
			: fs.promises.writeFile(robotsPath, "User-agent: *\nDisallow:"));
	}

	public async buildSiteMapPage(data: DoculaData): Promise<void> {
		const sitemapPath = `${data.output}/sitemap.xml`;
		const urls = [{ url: data.siteUrl }];

		if (data.documents?.length) {
			urls.push({ url: `${data.siteUrl}/feed.xml` });
		}

		if (data.openApiUrl && data.templates?.api) {
			urls.push({ url: `${data.siteUrl}/api` });
		}

		if (data.hasChangelog && data.templates?.changelog) {
			urls.push({ url: `${data.siteUrl}/changelog` });

			const perPage = this.options.changelogPerPage;
			const totalPages = Math.max(
				1,
				Math.ceil((data.changelogEntries ?? []).length / perPage),
			);
			for (let page = 2; page <= totalPages; page++) {
				urls.push({
					url: `${data.siteUrl}/changelog/page/${page}`,
				});
			}

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

		await fs.promises.mkdir(data.output, { recursive: true });

		await fs.promises.writeFile(sitemapPath, xml, "utf8");
	}

	public async buildFeedPage(data: DoculaData): Promise<void> {
		if (!data.documents?.length) {
			return;
		}

		const feedPath = `${data.output}/feed.xml`;
		const channelLink = this.buildAbsoluteSiteUrl(data.siteUrl, "/");
		const feedUrl = this.buildAbsoluteSiteUrl(data.siteUrl, "/feed.xml");
		let xml = '<?xml version="1.0" encoding="UTF-8"?>';
		xml += '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">';
		xml += "<channel>";
		xml += `<title>${this.escapeXml(data.siteTitle)}</title>`;
		xml += `<link>${this.escapeXml(channelLink)}</link>`;
		xml += `<description>${this.escapeXml(data.siteDescription)}</description>`;
		xml += `<lastBuildDate>${this.escapeXml(new Date().toUTCString())}</lastBuildDate>`;
		xml += `<atom:link href="${this.escapeXml(feedUrl)}" rel="self" type="application/rss+xml" />`;

		for (const document of data.documents) {
			const itemTitle = document.navTitle || document.title || document.urlPath;
			const itemLink = this.buildAbsoluteSiteUrl(
				data.siteUrl,
				this.normalizePathForUrl(document.urlPath),
			);
			const summary =
				document.description ||
				this.summarizeMarkdown(new Writr(document.content).body);
			xml += "<item>";
			xml += `<title>${this.escapeXml(itemTitle)}</title>`;
			xml += `<link>${this.escapeXml(itemLink)}</link>`;
			xml += `<guid isPermaLink="true">${this.escapeXml(itemLink)}</guid>`;
			xml += `<description>${this.escapeXml(summary)}</description>`;
			xml += "</item>";
		}

		xml += "</channel>";
		xml += "</rss>";

		await fs.promises.mkdir(data.output, { recursive: true });
		await fs.promises.writeFile(feedPath, xml, "utf8");
	}

	public async buildLlmsFiles(data: DoculaData): Promise<void> {
		if (!this.options.enableLlmsTxt) {
			return;
		}

		await fs.promises.mkdir(data.output, { recursive: true });

		const llmsOutputPath = `${data.output}/llms.txt`;
		const llmsFullOutputPath = `${data.output}/llms-full.txt`;
		const llmsOverrideContent = await this.getSafeSiteOverrideFileContent(
			data.sitePath,
			"llms.txt",
		);
		const llmsFullOverrideContent = await this.getSafeSiteOverrideFileContent(
			data.sitePath,
			"llms-full.txt",
		);

		if (llmsOverrideContent !== undefined) {
			await fs.promises.writeFile(llmsOutputPath, llmsOverrideContent, "utf8");
		} else {
			const llmsContent = this.generateLlmsIndexContent(data);
			await fs.promises.writeFile(llmsOutputPath, llmsContent, "utf8");
		}

		this._console.fileBuilt("llms.txt");

		if (llmsFullOverrideContent !== undefined) {
			await fs.promises.writeFile(
				llmsFullOutputPath,
				llmsFullOverrideContent,
				"utf8",
			);
		} else {
			const llmsFullContent = await this.generateLlmsFullContent(data);
			await fs.promises.writeFile(llmsFullOutputPath, llmsFullContent, "utf8");
		}

		this._console.fileBuilt("llms-full.txt");
	}

	private generateLlmsIndexContent(data: DoculaData): string {
		const lines: string[] = [];
		const documents = data.documents ?? [];
		const changelogEntries = data.changelogEntries ?? [];

		lines.push(`# ${data.siteTitle}`);
		lines.push("");
		lines.push(data.siteDescription);
		lines.push("");
		lines.push(
			`- [Full LLM Content](${this.buildAbsoluteSiteUrl(data.siteUrl, "/llms-full.txt")})`,
		);
		lines.push("");
		lines.push("## Documentation");

		if (documents.length > 0) {
			for (const document of documents) {
				const documentUrl = this.buildAbsoluteSiteUrl(
					data.siteUrl,
					this.normalizePathForUrl(document.urlPath),
				);
				const description = document.description
					? ` - ${document.description}`
					: "";
				lines.push(`- [${document.navTitle}](${documentUrl})${description}`);
			}
		} else {
			lines.push("- Not available.");
		}

		lines.push("");
		lines.push("## API Reference");
		if (data.hasApi) {
			lines.push(
				`- [API Documentation](${this.buildAbsoluteSiteUrl(data.siteUrl, "/api")})`,
			);
		} else {
			lines.push("- Not available.");
		}

		lines.push("");
		lines.push("## Changelog");
		if (data.hasChangelog) {
			lines.push(
				`- [Changelog](${this.buildAbsoluteSiteUrl(data.siteUrl, "/changelog")})`,
			);
			for (const entry of changelogEntries.slice(0, 20)) {
				/* v8 ignore next -- @preserve */
				const date = entry.formattedDate || entry.date || "No date";
				lines.push(
					`- [${entry.title}](${this.buildAbsoluteSiteUrl(data.siteUrl, `/changelog/${entry.slug}`)}) (${date})`,
				);
			}
		} else {
			lines.push("- Not available.");
		}

		lines.push("");

		return lines.join("\n");
	}

	private async generateLlmsFullContent(data: DoculaData): Promise<string> {
		const lines: string[] = [];
		const documents = data.documents ?? [];
		const changelogEntries = data.changelogEntries ?? [];

		lines.push(`# ${data.siteTitle}`);
		lines.push("");
		lines.push(data.siteDescription);
		lines.push("");
		lines.push(
			`Source Index: ${this.buildAbsoluteSiteUrl(data.siteUrl, "/llms.txt")}`,
		);
		lines.push("");
		lines.push("## Documentation");

		if (documents.length > 0) {
			for (const document of documents) {
				const documentUrl = this.buildAbsoluteSiteUrl(
					data.siteUrl,
					this.normalizePathForUrl(document.urlPath),
				);
				const markdownBody = new Writr(document.content).body.trim();

				lines.push("");
				lines.push(`### ${document.navTitle}`);
				lines.push(`URL: ${documentUrl}`);
				if (document.description) {
					lines.push(`Description: ${document.description}`);
				}
				lines.push("");
				/* v8 ignore next -- @preserve */
				lines.push(markdownBody || "_No content_");
			}
		} else {
			lines.push("- Not available.");
		}

		lines.push("");
		lines.push("## API Reference");
		if (data.hasApi) {
			lines.push(`URL: ${this.buildAbsoluteSiteUrl(data.siteUrl, "/api")}`);
			lines.push("");

			const localOpenApiSpec = await this.getSafeLocalOpenApiSpec(data);
			if (localOpenApiSpec) {
				lines.push(
					`OpenAPI Spec Source: ${this.toPosixPath(localOpenApiSpec.sourcePath)}`,
				);
				lines.push("");
				/* v8 ignore next -- @preserve */
				lines.push(localOpenApiSpec.content || "_No content_");
			} else {
				const openApiSpecUrl = this.resolveOpenApiSpecUrl(data);
				if (openApiSpecUrl) {
					lines.push(`OpenAPI Spec URL: ${openApiSpecUrl}`);
				}
			}
		} else {
			lines.push("- Not available.");
		}

		lines.push("");
		lines.push("## Changelog");
		if (data.hasChangelog && changelogEntries.length > 0) {
			lines.push(
				`URL: ${this.buildAbsoluteSiteUrl(data.siteUrl, "/changelog")}`,
			);

			for (const entry of changelogEntries) {
				lines.push("");
				lines.push(`### ${entry.title}`);
				lines.push(
					`URL: ${this.buildAbsoluteSiteUrl(data.siteUrl, `/changelog/${entry.slug}`)}`,
				);
				/* v8 ignore next 2 -- @preserve */
				if (entry.formattedDate || entry.date) {
					lines.push(`Date: ${entry.formattedDate || entry.date}`);
				}
				if (entry.tag) {
					lines.push(`Tag: ${entry.tag}`);
				}
				lines.push("");
				lines.push(entry.content.trim() || "_No content_");
			}
		} else {
			lines.push("- Not available.");
		}

		lines.push("");

		return lines.join("\n");
	}

	private buildAbsoluteSiteUrl(siteUrl: string, urlPath: string): string {
		const normalizedSiteUrl = siteUrl.endsWith("/")
			? siteUrl.slice(0, -1)
			: siteUrl;
		/* v8 ignore next -- @preserve */
		const normalizedPath = urlPath.startsWith("/") ? urlPath : `/${urlPath}`;
		return `${normalizedSiteUrl}${normalizedPath}`;
	}

	private normalizePathForUrl(urlPath: string): string {
		if (urlPath.endsWith("index.html")) {
			return urlPath.slice(0, -10);
		}

		return urlPath;
	}

	private escapeXml(value: string | undefined): string {
		return String(value ?? "")
			.replaceAll("&", "&amp;")
			.replaceAll("<", "&lt;")
			.replaceAll(">", "&gt;")
			.replaceAll('"', "&quot;")
			.replaceAll("'", "&apos;");
	}

	private summarizeMarkdown(markdown: string, maxLength = 240): string {
		const plainText = markdown
			.replace(/^#{1,6}\s+.*$/gm, " ")
			.replace(/^\s*[-*+]\s+/gm, " ")
			.replace(/^\s*---+\s*$/gm, " ")
			.replace(/```[\s\S]*?```/g, " ")
			.replace(/`([^`]+)`/g, "$1")
			.replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
			.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
			.replace(/[*_~>#]+/g, " ")
			.replace(/\s+/g, " ")
			.trim();

		if (plainText.length <= maxLength) {
			return plainText;
		}

		return `${plainText.slice(0, maxLength).trimEnd()}...`;
	}

	private isRemoteUrl(url: string): boolean {
		return /^https?:\/\//i.test(url);
	}

	private resolveOpenApiSpecUrl(data: DoculaData): string | undefined {
		if (!data.openApiUrl) {
			return undefined;
		}

		if (this.isRemoteUrl(data.openApiUrl)) {
			return data.openApiUrl;
		}

		const normalizedPath = data.openApiUrl.startsWith("/")
			? data.openApiUrl
			: `/${data.openApiUrl}`;
		return this.buildAbsoluteSiteUrl(data.siteUrl, normalizedPath);
	}

	private resolveLocalOpenApiPath(data: DoculaData): string | undefined {
		if (!data.openApiUrl || this.isRemoteUrl(data.openApiUrl)) {
			return undefined;
		}

		const openApiPathWithoutQuery = data.openApiUrl.split(/[?#]/)[0];
		if (!openApiPathWithoutQuery) {
			return undefined;
		}

		const normalizedPath = openApiPathWithoutQuery.startsWith("/")
			? openApiPathWithoutQuery.slice(1)
			: openApiPathWithoutQuery;
		return path.join(data.sitePath, normalizedPath);
	}

	private async getSafeSiteOverrideFileContent(
		sitePath: string,
		fileName: "llms.txt" | "llms-full.txt",
	): Promise<string | undefined> {
		const resolvedSitePath = path.resolve(sitePath);
		const candidatePath = path.resolve(sitePath, fileName);

		if (!this.isPathWithinBasePath(candidatePath, resolvedSitePath)) {
			return undefined;
		}

		let candidateStats: fs.Stats;
		try {
			candidateStats = await fs.promises.lstat(candidatePath);
		} catch {
			return undefined;
		}

		// Do not follow symbolic links for site-level llms override files.
		if (!candidateStats.isFile() || candidateStats.isSymbolicLink()) {
			return undefined;
		}

		let realSitePath: string;
		let realCandidatePath: string;
		try {
			realSitePath = await fs.promises.realpath(resolvedSitePath);
			realCandidatePath = await fs.promises.realpath(candidatePath);
		} catch {
			return undefined;
		}

		if (!this.isPathWithinBasePath(realCandidatePath, realSitePath)) {
			return undefined;
		}

		return fs.promises.readFile(realCandidatePath, "utf8");
	}

	private async getSafeLocalOpenApiSpec(
		data: DoculaData,
	): Promise<{ sourcePath: string; content: string } | undefined> {
		const localOpenApiPath = this.resolveLocalOpenApiPath(data);
		if (!localOpenApiPath) {
			return undefined;
		}

		const resolvedSitePath = path.resolve(data.sitePath);
		const resolvedLocalOpenApiPath = path.resolve(localOpenApiPath);

		if (
			!this.isPathWithinBasePath(resolvedLocalOpenApiPath, resolvedSitePath)
		) {
			return undefined;
		}

		let localOpenApiStats: fs.Stats;
		try {
			localOpenApiStats = await fs.promises.lstat(resolvedLocalOpenApiPath);
		} catch {
			return undefined;
		}

		// Do not follow symbolic links for local OpenAPI spec ingestion.
		if (!localOpenApiStats.isFile() || localOpenApiStats.isSymbolicLink()) {
			return undefined;
		}

		let realSitePath: string;
		let realLocalOpenApiPath: string;
		try {
			realSitePath = await fs.promises.realpath(resolvedSitePath);
			realLocalOpenApiPath = await fs.promises.realpath(
				resolvedLocalOpenApiPath,
			);
		} catch {
			return undefined;
		}

		if (!this.isPathWithinBasePath(realLocalOpenApiPath, realSitePath)) {
			return undefined;
		}

		const localOpenApiContent = (
			await fs.promises.readFile(realLocalOpenApiPath, "utf8")
		).trim();
		return {
			sourcePath: realLocalOpenApiPath,
			content: localOpenApiContent,
		};
	}

	private isPathWithinBasePath(
		candidatePath: string,
		basePath: string,
	): boolean {
		const relativePath = path.relative(
			path.resolve(basePath),
			path.resolve(candidatePath),
		);

		return (
			relativePath === "" ||
			(!relativePath.startsWith("..") && !path.isAbsolute(relativePath))
		);
	}

	private toPosixPath(filePath: string): string {
		return filePath.replaceAll(path.sep, path.posix.sep);
	}

	public async buildIndexPage(data: DoculaData): Promise<void> {
		if (data.templates) {
			const indexPath = `${data.output}/index.html`;

			await fs.promises.mkdir(data.output, { recursive: true });

			const indexTemplate = `${data.templatePath}/${data.templates.home}`;

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

	public async buildDocsHomePage(data: DoculaData): Promise<void> {
		if (!data.templates?.docPage) {
			throw new Error("No docPage template found for homePage");
		}

		if (!data.documents?.length) {
			throw new Error("No documents found for homePage");
		}

		const indexPath = `${data.output}/index.html`;
		await fs.promises.mkdir(data.output, { recursive: true });

		const documentsTemplate = `${data.templatePath}/${data.templates.docPage}`;
		const firstDocument = data.documents[0];

		if (!data.sidebarItems) {
			data.sidebarItems = this.generateSidebarItems(data);
		}

		const documentContent = await this._ecto.renderFromFile(
			documentsTemplate,
			{ ...data, ...firstDocument },
			data.templatePath,
		);
		await fs.promises.writeFile(indexPath, documentContent, "utf8");
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
			await fs.promises.mkdir(`${data.output}/docs`, { recursive: true });
			data.sidebarItems = this.generateSidebarItems(data);

			const promises = data.documents.map(async (document) => {
				const folder = document.urlPath.split("/").slice(0, -1).join("/");
				await fs.promises.mkdir(`${data.output}/${folder}`, {
					recursive: true,
				});
				const slug = `${data.output}${document.urlPath}`;
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

		const apiPath = `${data.output}/api/index.html`;
		const apiOutputPath = `${data.output}/api`;

		await fs.promises.mkdir(apiOutputPath, { recursive: true });

		// Copy swagger.json to output if it exists in the site directory
		const swaggerSource = `${data.sitePath}/api/swagger.json`;
		if (fs.existsSync(swaggerSource)) {
			await fs.promises.copyFile(
				swaggerSource,
				`${apiOutputPath}/swagger.json`,
			);
		}

		// Parse the OpenAPI spec for native rendering
		let apiSpec: ApiSpecData | undefined;
		const localSpec = await this.getSafeLocalOpenApiSpec(data);
		if (localSpec) {
			apiSpec = parseOpenApiSpec(localSpec.content);
			/* v8 ignore next 9 -- @preserve */
		} else if (data.openApiUrl && this.isRemoteUrl(data.openApiUrl)) {
			try {
				const response = await fetch(data.openApiUrl);
				const specContent = await response.text();
				apiSpec = parseOpenApiSpec(specContent);
			} catch {
				// If remote fetch fails, render page without parsed spec
			}
		}

		// Render Markdown descriptions to HTML
		/* v8 ignore next -- @preserve */
		if (apiSpec) {
			apiSpec.info.description = new Writr(
				apiSpec.info.description,
			).renderSync();
			for (const group of apiSpec.groups) {
				group.description = new Writr(group.description).renderSync();
				for (const op of group.operations) {
					op.description = new Writr(op.description).renderSync();
				}
			}
		}

		const apiTemplate = `${data.templatePath}/${data.templates.api}`;
		const apiContent = await this._ecto.renderFromFile(
			apiTemplate,
			{ ...data, specUrl: data.openApiUrl, apiSpec },
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
			preview: this.generateChangelogPreview(markdownContent, 200, isMdx),
			urlPath: `/changelog/${slug}/index.html`,
		};
	}

	public generateChangelogPreview(
		markdown: string,
		maxLength = 200,
		mdx = false,
	): string {
		if (markdown.length <= maxLength) {
			return new Writr(markdown).renderSync({ mdx });
		}

		// Truncate at word boundary
		let truncated = markdown.slice(0, maxLength);
		const lastSpace = truncated.lastIndexOf(" ");
		if (lastSpace > 0) {
			truncated = truncated.slice(0, lastSpace);
		}

		truncated += "...";
		return new Writr(truncated).renderSync({ mdx });
	}

	public convertReleaseToChangelogEntry(
		// biome-ignore lint/suspicious/noExplicitAny: GitHub release object
		release: Record<string, any>,
	): DoculaChangelogEntry {
		const tagName = (release.tag_name as string) ?? "";
		const slug = tagName.replace(/\./g, "-");
		const name = (release.name as string) || tagName;
		const body = (release.body as string) ?? "";
		const publishedAt = (release.published_at as string) ?? "";
		const prerelease = (release.prerelease as boolean) ?? false;

		let dateString = "";
		let formattedDate = "";
		if (publishedAt) {
			const parsedDate = new Date(publishedAt);
			if (!Number.isNaN(parsedDate.getTime())) {
				dateString = parsedDate.toISOString().split("T")[0];
				formattedDate = parsedDate.toLocaleDateString("en-US", {
					year: "numeric",
					month: "long",
					day: "numeric",
				});
			}
		}

		const tag = prerelease ? "Pre-release" : "Release";
		const tagClass = tag.toLowerCase().replace(/\s+/g, "-");

		return {
			title: name,
			date: dateString,
			formattedDate,
			tag,
			tagClass,
			slug,
			content: body,
			generatedHtml: new Writr(body).renderSync(),
			preview: this.generateChangelogPreview(body),
			urlPath: `/changelog/${slug}/index.html`,
		};
	}

	public getReleasesAsChangelogEntries(
		// biome-ignore lint/suspicious/noExplicitAny: GitHub release objects
		releases: any[],
	): DoculaChangelogEntry[] {
		const entries: DoculaChangelogEntry[] = [];
		for (const release of releases) {
			if (release.draft) {
				continue;
			}

			entries.push(this.convertReleaseToChangelogEntry(release));
		}

		return entries;
	}

	public async buildChangelogPage(data: DoculaData): Promise<void> {
		if (!data.hasChangelog || !data.templates?.changelog) {
			return;
		}

		const allEntries = data.changelogEntries ?? [];
		const perPage = this.options.changelogPerPage;
		const totalPages = Math.max(1, Math.ceil(allEntries.length / perPage));
		const changelogTemplate = `${data.templatePath}/${data.templates.changelog}`;

		const promises = [];
		for (let page = 1; page <= totalPages; page++) {
			const startIndex = (page - 1) * perPage;
			const pageEntries = allEntries.slice(startIndex, startIndex + perPage);

			const outputPath =
				page === 1
					? `${data.output}/changelog`
					: `${data.output}/changelog/page/${page}`;
			const indexPath = `${outputPath}/index.html`;

			const paginationData = {
				...data,
				entries: pageEntries,
				currentPage: page,
				totalPages,
				hasNextPage: page < totalPages,
				hasPrevPage: page > 1,
				nextPageUrl:
					page < totalPages ? `/changelog/page/${page + 1}/` : "",
				prevPageUrl:
					page > 1
						? page === 2
							? "/changelog/"
							: `/changelog/page/${page - 1}/`
						: "",
			};

			promises.push(
				(async () => {
					await fs.promises.mkdir(outputPath, { recursive: true });
					const content = await this._ecto.renderFromFile(
						changelogTemplate,
						paginationData,
						data.templatePath,
					);
					await fs.promises.writeFile(indexPath, content, "utf8");
				})(),
			);
		}

		await Promise.all(promises);
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
			const entryOutputPath = `${data.output}/changelog/${entry.slug}`;
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
		let sidebarItems: DoculaSection[] = (data.sections ?? []).map(
			(section) => ({
				...section,
				children: section.children ? [...section.children] : undefined,
			}),
		);

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
				if (
					stats.isFile() &&
					(document.endsWith(".md") || document.endsWith(".mdx"))
				) {
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
					if (
						stats.isDirectory() &&
						this.directoryContainsMarkdown(documentPath)
					) {
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

		// Only insert a TOC heading when the page has multiple sections.
		// Place it just before the first ## heading so intro content is preserved.
		if (!this.hasTableOfContents(markdownContent)) {
			const h2Matches = markdownContent.match(/^## /gm);
			if (h2Matches && h2Matches.length >= 2) {
				const firstH2 = markdownContent.search(/^## /m);
				markdownContent = `${markdownContent.slice(0, firstH2)}## Table of Contents\n\n${markdownContent.slice(firstH2)}`;
			}
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

	private directoryContainsMarkdown(dirPath: string): boolean {
		const entries = fs.readdirSync(dirPath);
		for (const entry of entries) {
			const fullPath = `${dirPath}/${entry}`;
			const stat = fs.statSync(fullPath);
			if (stat.isFile() && (entry.endsWith(".md") || entry.endsWith(".mdx"))) {
				return true;
			}
		}

		return false;
	}

	private mergeTemplateOverrides(
		resolvedTemplatePath: string,
		sitePath: string,
		templateName: string,
	): string {
		// Only apply overrides for built-in templates (not custom templatePath)
		if (this.options.templatePath) {
			return resolvedTemplatePath;
		}

		const overrideDir = path.join(sitePath, "templates", templateName);
		const cacheDir = path.join(sitePath, ".cache", "templates", templateName);

		// Validate that resolved paths stay within sitePath to prevent path traversal
		if (
			!this.isPathWithinBasePath(overrideDir, sitePath) ||
			!this.isPathWithinBasePath(cacheDir, sitePath)
		) {
			return resolvedTemplatePath;
		}

		if (!fs.existsSync(overrideDir)) {
			return resolvedTemplatePath;
		}

		const overrideFiles = this.listFilesRecursive(overrideDir);

		// Check if we can reuse the existing cache by comparing modification times
		if (
			fs.existsSync(cacheDir) &&
			this.isCacheFresh(overrideDir, cacheDir, overrideFiles)
		) {
			this._console.step("Using cached template overrides...");
			return cacheDir;
		}

		// Log overridden files
		/* v8 ignore next 5 -- @preserve */
		if (overrideFiles.length > 0) {
			this._console.step("Applying template overrides...");
			for (const file of overrideFiles) {
				this._console.info(`Template override: ${file}`);
			}
		}

		// Ensure .cache is in .gitignore before first creation
		this.ensureCacheInGitignore(sitePath);

		// Create cache directory and merge templates
		if (fs.existsSync(cacheDir)) {
			fs.rmSync(cacheDir, { recursive: true, force: true });
		}

		fs.mkdirSync(cacheDir, { recursive: true });

		// Copy built-in template first
		this.copyDirectory(resolvedTemplatePath, cacheDir);

		// Overlay user overrides on top
		this.copyDirectory(overrideDir, cacheDir);

		// Write manifest so isCacheFresh can detect deleted/renamed overrides
		const manifestPath = path.join(cacheDir, ".manifest.json");
		fs.writeFileSync(manifestPath, JSON.stringify(overrideFiles));

		return cacheDir;
	}

	private ensureCacheInGitignore(sitePath: string): void {
		if (!this.options.autoUpdateIgnores) {
			return;
		}

		// Only act when .cache doesn't exist yet (first creation)
		const cacheDir = path.join(sitePath, ".cache");
		if (fs.existsSync(cacheDir)) {
			return;
		}

		const gitignorePath = path.join(sitePath, ".gitignore");
		const entry = ".cache";

		if (fs.existsSync(gitignorePath)) {
			const content = fs.readFileSync(gitignorePath, "utf8");
			if (!content.split("\n").some((line) => line.trim() === entry)) {
				fs.appendFileSync(gitignorePath, `\n${entry}\n`);
				this._console.info(`Added ${entry} to .gitignore`);
			}
		} else {
			fs.writeFileSync(gitignorePath, `${entry}\n`);
			this._console.info("Created .gitignore with .cache");
		}
	}

	private isCacheFresh(
		overrideDir: string,
		cacheDir: string,
		overrideFiles: string[],
	): boolean {
		// Check manifest to detect deleted/renamed override files
		const manifestPath = path.join(cacheDir, ".manifest.json");
		if (!fs.existsSync(manifestPath)) {
			return false;
		}

		try {
			const previousFiles = JSON.parse(
				fs.readFileSync(manifestPath, "utf8"),
			) as string[];
			if (
				previousFiles.length !== overrideFiles.length ||
				!previousFiles.every((f, i) => f === overrideFiles[i])
			) {
				return false;
			}
		} catch {
			return false;
		}

		// Every override file must exist in cache and be older or equal in mtime
		for (const file of overrideFiles) {
			const overridePath = path.join(overrideDir, file);
			const cachedPath = path.join(cacheDir, file);

			/* v8 ignore next 3 -- @preserve */
			if (!fs.existsSync(cachedPath)) {
				return false;
			}

			const overrideMtime = fs.statSync(overridePath).mtimeMs;
			const cachedMtime = fs.statSync(cachedPath).mtimeMs;

			if (overrideMtime > cachedMtime) {
				return false;
			}
		}

		return true;
	}

	private listFilesRecursive(dir: string, prefix = ""): string[] {
		const results: string[] = [];
		const entries = fs.readdirSync(dir);
		for (const entry of entries) {
			/* v8 ignore next -- @preserve */
			if (entry.startsWith(".")) {
				continue;
			}

			const fullPath = path.join(dir, entry);
			const relativePath = prefix ? `${prefix}/${entry}` : entry;
			const stat = fs.lstatSync(fullPath);
			/* v8 ignore next 3 -- @preserve */
			if (stat.isSymbolicLink()) {
				continue;
			}

			if (stat.isDirectory()) {
				results.push(...this.listFilesRecursive(fullPath, relativePath));
			} else {
				results.push(relativePath);
			}
		}

		return results;
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

			// Skip symbolic links to prevent copying sensitive files
			/* v8 ignore next 3 -- @preserve */
			if (stat.isSymbolicLink()) {
				continue;
			}

			if (stat.isDirectory()) {
				fs.mkdirSync(targetPath, { recursive: true });
				this.copyDirectory(sourcePath, targetPath);
			} else {
				fs.mkdirSync(target, { recursive: true });
				fs.copyFileSync(sourcePath, targetPath);
			}
		}
	}

	private copyPublicFolder(sitePath: string, output: string): void {
		const publicPath = `${sitePath}/public`;

		if (!fs.existsSync(publicPath)) {
			return;
		}

		this._console.step("Copying public folder...");

		const resolvedOutput = path.resolve(output);
		this.copyPublicDirectory(publicPath, output, publicPath, resolvedOutput);
	}

	private copyPublicDirectory(
		source: string,
		target: string,
		basePath: string,
		output: string,
	): void {
		const files = fs.readdirSync(source);

		for (const file of files) {
			const sourcePath = `${source}/${file}`;
			const targetPath = `${target}/${file}`;
			const relativePath = sourcePath.replace(`${basePath}/`, "");

			// Skip if source path is inside or equals the output path to prevent recursive copying
			const resolvedSourcePath = path.resolve(sourcePath);
			if (
				resolvedSourcePath === output ||
				resolvedSourcePath.startsWith(`${output}${path.sep}`)
			) {
				continue;
			}

			const stat = fs.lstatSync(sourcePath);

			// Skip symbolic links to prevent copying sensitive files
			/* v8 ignore next 3 -- @preserve */
			if (stat.isSymbolicLink()) {
				continue;
			}

			if (stat.isDirectory()) {
				fs.mkdirSync(targetPath, { recursive: true });
				this.copyPublicDirectory(sourcePath, targetPath, basePath, output);
			} else {
				fs.mkdirSync(target, { recursive: true });
				fs.copyFileSync(sourcePath, targetPath);
				this._console.fileCopied(relativePath);
			}
		}
	}

	private copyDocumentSiblingAssets(data: DoculaData): void {
		/* v8 ignore next 4 -- @preserve */
		if (!data.documents) {
			return;
		}

		for (const document of data.documents) {
			const sourceDir = path.dirname(document.documentPath);
			const outputDir = `${data.output}${path.dirname(document.urlPath)}`;
			const availableAssets = this.listContentAssets(sourceDir);

			for (const assetRelPath of availableAssets) {
				if (document.markdown.includes(assetRelPath)) {
					const source = path.join(sourceDir, assetRelPath);
					// Skip symbolic links to prevent copying sensitive files
					/* v8 ignore next 3 -- @preserve */
					if (fs.lstatSync(source).isSymbolicLink()) {
						continue;
					}

					const target = path.join(outputDir, assetRelPath);
					fs.mkdirSync(path.dirname(target), { recursive: true });
					fs.copyFileSync(source, target);
				}
			}
		}
	}

	private listContentAssets(sourcePath: string, basePath?: string): string[] {
		const root = basePath ?? sourcePath;
		const results: string[] = [];

		/* v8 ignore start -- @preserve */
		if (!fs.existsSync(sourcePath)) {
			return results;
		}

		const files = fs.readdirSync(sourcePath);

		for (const file of files) {
			if (file.startsWith(".")) {
				continue;
			}
			/* v8 ignore stop */

			const fullPath = `${sourcePath}/${file}`;
			const stat = fs.lstatSync(fullPath);

			// Skip symbolic links to prevent exposing sensitive files
			/* v8 ignore next 3 -- @preserve */
			if (stat.isSymbolicLink()) {
				continue;
			}

			if (stat.isDirectory()) {
				results.push(...this.listContentAssets(fullPath, root));
			} else {
				const ext = path.extname(file).toLowerCase();
				if (this.options.allowedAssets.includes(ext)) {
					results.push(path.relative(root, fullPath));
				}
			}
		}

		return results;
	}

	private copyContentAssets(sourcePath: string, targetPath: string): void {
		if (!fs.existsSync(sourcePath)) {
			return;
		}

		const files = fs.readdirSync(sourcePath);

		for (const file of files) {
			/* v8 ignore next -- @preserve */
			if (file.startsWith(".")) {
				continue;
			}

			const source = `${sourcePath}/${file}`;
			const target = `${targetPath}/${file}`;
			const stat = fs.lstatSync(source);

			// Skip symbolic links to prevent copying sensitive files
			/* v8 ignore next 3 -- @preserve */
			if (stat.isSymbolicLink()) {
				continue;
			}

			if (stat.isDirectory()) {
				this.copyContentAssets(source, target);
			} else {
				const ext = path.extname(file).toLowerCase();
				if (this.options.allowedAssets.includes(ext)) {
					fs.mkdirSync(targetPath, { recursive: true });
					fs.copyFileSync(source, target);
				}
			}
		}
	}
}
