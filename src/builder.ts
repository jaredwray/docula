import fs from "node:fs";
import path from "node:path";
import { Ecto } from "ecto";
import { Hashery } from "hashery";
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
	previewImage?: string;
	urlPath: string;
	lastModified: string;
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
	hasReadme?: boolean;
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
	lastModified?: string;
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
	lastModified: string;
};

export type BuildManifest = {
	version: 1;
	configHash: string;
	templateHash: string;
	docs: Record<string, string>;
	changelog: Record<string, string>;
	assets: Record<string, string>;
};

export class DoculaBuilder {
	private readonly _options: DoculaOptions = new DoculaOptions();
	private readonly _ecto: Ecto;
	private readonly _console: DoculaConsole = new DoculaConsole();
	private readonly _hash = new Hashery();
	public onReleaseChangelog?: (
		entries: DoculaChangelogEntry[],
		console: DoculaConsole,
	) => Promise<DoculaChangelogEntry[]> | DoculaChangelogEntry[];

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

		// Load previous build manifest and compute current hashes
		const previousManifest = this.loadBuildManifest(this.options.sitePath);
		const currentConfigHash = this.hashOptions();
		const currentTemplateHash =
			this.hashTemplateDirectory(resolvedTemplatePath);

		// If config changed, discard manifest (force full rebuild)
		const validManifest =
			previousManifest?.configHash === currentConfigHash
				? previousManifest
				: undefined;

		// Hash all source files for change detection (keys are relative to the dir)
		const currentDocHashes = this.hashSourceFiles(
			`${this.options.sitePath}/docs`,
		);
		const currentChangelogHashes = this.hashSourceFiles(
			`${this.options.sitePath}/changelog`,
		);
		const currentAssetHashes: Record<string, string> = {};

		// Check if anything changed at all (full build skip for watch mode)
		// Only skip if the output directory exists (otherwise we need a full build)
		if (
			validManifest &&
			fs.existsSync(this.options.output) &&
			validManifest.templateHash === currentTemplateHash &&
			this.recordsEqual(validManifest.docs, currentDocHashes) &&
			this.recordsEqual(validManifest.changelog, currentChangelogHashes)
		) {
			// Check assets too
			const assetsChanged = this.hasAssetsChanged(
				this.options.sitePath,
				validManifest.assets,
			);
			if (!assetsChanged) {
				this._console.success("No changes detected, skipping build");
				return;
			}
		}

		// Load cached parsed objects if manifest is valid
		const cachedDocs = validManifest
			? this.loadCachedDocuments(this.options.sitePath)
			: new Map<string, DoculaDocument>();
		const cachedChangelog = validManifest
			? this.loadCachedChangelog(this.options.sitePath)
			: new Map<string, DoculaChangelogEntry>();

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
			hasReadme: fs.existsSync(`${this.options.sitePath}/README.md`),
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
		// Get the documents (using cached parsed objects for unchanged files)
		doculaData.documents = this.getDocuments(
			`${doculaData.sitePath}/docs`,
			doculaData,
			cachedDocs,
			validManifest?.docs ?? {},
			currentDocHashes,
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
		const fileChangelogEntries = this.getChangelogEntries(
			changelogPath,
			cachedChangelog,
			validManifest?.changelog ?? {},
			currentChangelogHashes,
		);

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
			let releaseEntries = this.getReleasesAsChangelogEntries(
				// biome-ignore lint/suspicious/noExplicitAny: GitHub release objects
				doculaData.github.releases as any[],
			);

			if (this.onReleaseChangelog) {
				try {
					releaseEntries = await this.onReleaseChangelog(
						releaseEntries,
						this._console,
					);
				} catch (error) {
					this._console.error(
						`onReleaseChangelog error: ${(error as Error).message}`,
					);
				}
			}

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

		// Set lastModified for pages without a specific source file (home, changelog listing, API)
		doculaData.lastModified = new Date().toISOString().split("T")[0];

		// Build the home page (index.html) based on content detection
		this._console.step("Building pages...");
		if (doculaData.hasReadme) {
			await this.buildIndexPage(doculaData);
			this._console.fileBuilt("index.html");
		} else if (doculaData.hasDocuments) {
			await this.buildDocsHomePage(doculaData);
			this._console.fileBuilt("index.html");
		} else if (doculaData.hasApi) {
			await this.buildApiHomePage(doculaData);
			this._console.fileBuilt("index.html");
		} else {
			this._console.error(
				"No content found for the home page. " +
					"Add a README.md, docs/ folder, or api/swagger.json to your site directory.",
			);
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
		const previousAssets = validManifest?.assets ?? {};

		this._console.step("Copying assets...");

		// Copy over favicon
		if (
			!this.hashAssetAndCheckSkip(
				`${siteRelativePath}/favicon.ico`,
				`${this.options.output}/favicon.ico`,
				"favicon.ico",
				previousAssets,
				currentAssetHashes,
			)
		) {
			await fs.promises.copyFile(
				`${siteRelativePath}/favicon.ico`,
				`${this.options.output}/favicon.ico`,
			);
			this._console.fileCopied("favicon.ico");
		}

		// Copy over logo
		if (
			!this.hashAssetAndCheckSkip(
				`${siteRelativePath}/logo.svg`,
				`${this.options.output}/logo.svg`,
				"logo.svg",
				previousAssets,
				currentAssetHashes,
			)
		) {
			await fs.promises.copyFile(
				`${siteRelativePath}/logo.svg`,
				`${this.options.output}/logo.svg`,
			);
			this._console.fileCopied("logo.svg");
		}

		// Copy over logo_horizontal
		if (
			!this.hashAssetAndCheckSkip(
				`${siteRelativePath}/logo_horizontal.png`,
				`${this.options.output}/logo_horizontal.png`,
				"logo_horizontal.png",
				previousAssets,
				currentAssetHashes,
			)
		) {
			await fs.promises.copyFile(
				`${siteRelativePath}/logo_horizontal.png`,
				`${this.options.output}/logo_horizontal.png`,
			);
			this._console.fileCopied("logo_horizontal.png");
		}

		// Copy over css
		/* v8 ignore next -- @preserve */
		if (fs.existsSync(`${resolvedTemplatePath}/css`)) {
			this.copyDirectoryWithHashing(
				`${resolvedTemplatePath}/css`,
				`${this.options.output}/css`,
				"css",
				previousAssets,
				currentAssetHashes,
			);
			this._console.fileCopied("css/");
		}

		// Copy over js
		/* v8 ignore next -- @preserve */
		if (fs.existsSync(`${resolvedTemplatePath}/js`)) {
			this.copyDirectoryWithHashing(
				`${resolvedTemplatePath}/js`,
				`${this.options.output}/js`,
				"js",
				previousAssets,
				currentAssetHashes,
			);
			this._console.fileCopied("js/");
		}

		// Copy over variables
		if (
			!this.hashAssetAndCheckSkip(
				`${siteRelativePath}/variables.css`,
				`${this.options.output}/css/variables.css`,
				"variables.css",
				previousAssets,
				currentAssetHashes,
			)
		) {
			await fs.promises.copyFile(
				`${siteRelativePath}/variables.css`,
				`${this.options.output}/css/variables.css`,
			);
			this._console.fileCopied("css/variables.css");
		}

		// Record swagger.json hash for change detection
		const swaggerPath = `${siteRelativePath}/api/swagger.json`;
		if (fs.existsSync(swaggerPath)) {
			currentAssetHashes["api/swagger.json"] = this.hashFile(swaggerPath);
		}

		// Copy over public folder contents (differential) and record their hashes
		this.copyPublicFolder(
			siteRelativePath,
			this.options.output,
			validManifest?.assets ?? {},
			currentAssetHashes,
		);

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

		// Save build manifest for differential builds
		this.ensureCacheInGitignore(this.options.sitePath);
		const newManifest: BuildManifest = {
			version: 1,
			configHash: currentConfigHash,
			templateHash: currentTemplateHash,
			docs: currentDocHashes,
			changelog: currentChangelogHashes,
			assets: currentAssetHashes,
		};
		this.saveBuildManifest(this.options.sitePath, newManifest);

		// Save cached parsed objects
		/* v8 ignore next -- @preserve */
		this.saveCachedDocuments(this.options.sitePath, doculaData.documents ?? []);
		this.saveCachedChangelog(this.options.sitePath, fileChangelogEntries);

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
			throw new Error("No docPage template found for docs home page");
		}

		if (!data.documents?.length) {
			throw new Error("No documents found for docs home page");
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

	public async renderApiContent(data: DoculaData): Promise<string> {
		if (!data.openApiUrl || !data.templates?.api) {
			throw new Error("No API template or openApiUrl found");
		}

		// Copy swagger.json to output if it exists in the site directory
		const swaggerSource = `${data.sitePath}/api/swagger.json`;
		const apiOutputPath = `${data.output}/api`;
		await fs.promises.mkdir(apiOutputPath, { recursive: true });
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
		return this._ecto.renderFromFile(
			apiTemplate,
			{ ...data, specUrl: data.openApiUrl, apiSpec },
			data.templatePath,
		);
	}

	public async buildApiPage(data: DoculaData): Promise<void> {
		if (!data.openApiUrl || !data.templates?.api) {
			return;
		}

		const apiPath = `${data.output}/api/index.html`;
		const apiContent = await this.renderApiContent(data);
		await fs.promises.writeFile(apiPath, apiContent, "utf8");
	}

	public async buildApiHomePage(data: DoculaData): Promise<void> {
		const indexPath = `${data.output}/index.html`;
		await fs.promises.mkdir(data.output, { recursive: true });
		const apiContent = await this.renderApiContent(data);
		await fs.promises.writeFile(indexPath, apiContent, "utf8");
	}

	public getChangelogEntries(
		changelogPath: string,
		cachedEntries?: Map<string, DoculaChangelogEntry>,
		previousHashes?: Record<string, string>,
		currentHashes?: Record<string, string>,
	): DoculaChangelogEntry[] {
		const entries: DoculaChangelogEntry[] = [];
		if (!fs.existsSync(changelogPath)) {
			return entries;
		}

		const files = fs.readdirSync(changelogPath);
		for (const file of files) {
			const filePath = `${changelogPath}/${file}`;
			const stats = fs.statSync(filePath);
			if (stats.isFile() && (file.endsWith(".md") || file.endsWith(".mdx"))) {
				// Check if we can use cached parsed entry
				if (cachedEntries && previousHashes && currentHashes) {
					const slug = path.basename(file, path.extname(file));
					/* v8 ignore next -- @preserve */
					const hash = currentHashes[file] ?? this.hashFile(filePath);
					const prevHash = previousHashes[file];
					const cached = cachedEntries.get(slug);
					if (cached && prevHash === hash) {
						entries.push(cached);
						continue;
					}
				}

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
		const slug = fileName;

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

		const previewImage = matterData.previewImage as string | undefined;

		return {
			title: matterData.title ?? fileName,
			date: dateString,
			formattedDate,
			tag,
			tagClass,
			slug,
			content: markdownContent,
			generatedHtml: new Writr(markdownContent).renderSync({ mdx: isMdx }),
			preview: this.generateChangelogPreview(markdownContent, 500, isMdx),
			previewImage,
			urlPath: `/changelog/${slug}/index.html`,
			lastModified: fs.statSync(filePath).mtime.toISOString().split("T")[0],
		};
	}

	public generateChangelogPreview(
		markdown: string,
		maxLength = 500,
		mdx = false,
	): string {
		const minLength = 300;

		// Step 1: Strip markdown headings
		let cleaned = markdown
			.split("\n")
			.filter((line) => !/^#{1,6}\s/.test(line))
			.join("\n");

		// Step 2: Strip leading blank lines
		cleaned = cleaned.replace(/^\n+/, "");

		// Step 3: Clean up link syntax — remove images, convert links to text
		cleaned = cleaned.replace(/!\[[^\]]*\]\([^)]*\)/g, "");
		cleaned = cleaned.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1");

		// Strip leading blank lines after image removal
		cleaned = cleaned.replace(/^\n+/, "").trim();

		if (cleaned.length <= minLength) {
			return new Writr(cleaned).renderSync({ mdx });
		}

		// Step 4: Split on paragraph boundaries within the target range
		const searchArea = cleaned.slice(0, maxLength);
		let splitIndex = -1;

		// Look for last paragraph break (\n\n) that is >= minLength
		let pos = searchArea.lastIndexOf("\n\n");
		while (pos >= 0) {
			if (pos >= minLength) {
				splitIndex = pos;
				break;
			}

			// Accept any paragraph break within the max range
			if (splitIndex === -1) {
				splitIndex = pos;
			}

			pos = searchArea.lastIndexOf("\n\n", pos - 1);
		}

		// For list-heavy content, try splitting at last complete list item
		if (splitIndex === -1) {
			const lastNewline = searchArea.lastIndexOf("\n");
			if (lastNewline >= minLength) {
				// Check if the next line starts a list item
				const nextLine = cleaned.slice(lastNewline + 1);
				if (/^[-*]\s/.test(nextLine) || /^\d+\.\s/.test(nextLine)) {
					splitIndex = lastNewline;
				}
			}

			// Also try finding the last list item boundary before maxLength
			if (splitIndex === -1) {
				const lines = searchArea.split("\n");
				let charCount = 0;
				let lastItemEnd = -1;
				for (const line of lines) {
					const lineEnd = charCount + line.length;
					if (
						lineEnd <= maxLength &&
						(/^[-*]\s/.test(line) || /^\d+\.\s/.test(line))
					) {
						// The end of the previous line is a valid split point
						if (charCount > 0 && charCount >= minLength) {
							lastItemEnd = charCount - 1;
						}
					}

					charCount = lineEnd + 1; // +1 for newline
				}

				if (lastItemEnd > 0) {
					splitIndex = lastItemEnd;
				}
			}
		}

		// Step 5: Truncate and apply ellipsis only when force-truncated
		if (splitIndex > 0) {
			const truncated = cleaned.slice(0, splitIndex).trim();
			return new Writr(truncated).renderSync({ mdx });
		}

		// Fallback: truncate at word boundary with ellipsis
		let truncated = cleaned.slice(0, maxLength);
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
			lastModified: dateString,
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

		/* v8 ignore next -- @preserve */
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
				hasPagination: totalPages > 1,
				hasNextPage: page < totalPages,
				hasPrevPage: page > 1,
				nextPageUrl: page < totalPages ? `/changelog/page/${page + 1}/` : "",
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
		cachedDocs?: Map<string, DoculaDocument>,
		previousDocHashes?: Record<string, string>,
		currentDocHashes?: Record<string, string>,
	): DoculaDocument[] {
		let documents: DoculaDocument[] = [];
		if (fs.existsSync(sitePath)) {
			// Get top level documents
			documents = this.getDocumentInDirectory(
				sitePath,
				sitePath,
				cachedDocs,
				previousDocHashes,
				currentDocHashes,
			);

			// Get all sections and parse them
			doculaData.sections = this.getSections(sitePath, this.options);

			// Get all documents in each section
			for (const section of doculaData.sections) {
				const sectionPath = `${sitePath}/${section.path}`;
				const sectionDocuments = this.getDocumentInDirectory(
					sectionPath,
					sitePath,
					cachedDocs,
					previousDocHashes,
					currentDocHashes,
				);
				documents = [...documents, ...sectionDocuments];
			}
		}

		return documents;
	}

	public getDocumentInDirectory(
		sitePath: string,
		docsRootPath: string,
		cachedDocs?: Map<string, DoculaDocument>,
		previousDocHashes?: Record<string, string>,
		currentDocHashes?: Record<string, string>,
	): DoculaDocument[] {
		const documents: DoculaDocument[] = [];
		const documentList = fs.readdirSync(sitePath);
		/* v8 ignore next -- @preserve */
		if (documentList.length > 0) {
			for (const document of documentList) {
				const documentPath = `${sitePath}/${document}`;
				const relativeKey = path.relative(docsRootPath, documentPath);
				const stats = fs.statSync(documentPath);
				if (
					stats.isFile() &&
					(document.endsWith(".md") || document.endsWith(".mdx"))
				) {
					// Check if we can use cached parsed document
					if (cachedDocs && previousDocHashes && currentDocHashes) {
						const hash =
							currentDocHashes[relativeKey] ?? this.hashFile(documentPath);
						const prevHash = previousDocHashes[relativeKey];
						const cached = cachedDocs.get(relativeKey);
						if (cached && prevHash === hash) {
							documents.push(cached);
							continue;
						}
					}

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
			lastModified: fs.statSync(documentPath).mtime.toISOString().split("T")[0],
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

		// Check if we can reuse or incrementally update the existing cache
		if (fs.existsSync(cacheDir)) {
			const diff = this.getChangedOverrides(
				overrideDir,
				cacheDir,
				overrideFiles,
			);

			if (diff) {
				const hasChanges =
					diff.added.length > 0 ||
					diff.changed.length > 0 ||
					diff.removed.length > 0;

				if (!hasChanges) {
					this._console.step("Using cached template overrides...");
					return cacheDir;
				}

				// Apply incremental updates
				this._console.step("Updating template overrides...");

				for (const file of diff.added) {
					this._console.info(`Template override added: ${file}`);
					const targetPath = path.join(cacheDir, file);
					fs.mkdirSync(path.dirname(targetPath), { recursive: true });
					fs.copyFileSync(path.join(overrideDir, file), targetPath);
				}

				for (const file of diff.changed) {
					this._console.info(`Template override changed: ${file}`);
					const targetPath = path.join(cacheDir, file);
					fs.mkdirSync(path.dirname(targetPath), { recursive: true });
					fs.copyFileSync(path.join(overrideDir, file), targetPath);
				}

				for (const file of diff.removed) {
					this._console.info(`Template override removed: ${file}`);
					const cachedPath = path.join(cacheDir, file);
					// Restore original template file if it exists
					const originalPath = path.join(resolvedTemplatePath, file);
					/* v8 ignore next 4 -- @preserve */
					if (fs.existsSync(originalPath)) {
						fs.copyFileSync(originalPath, cachedPath);
					} else if (fs.existsSync(cachedPath)) {
						fs.unlinkSync(cachedPath);
					}
				}

				// Update manifest with current hashes
				const manifestPath = path.join(cacheDir, ".manifest.json");
				fs.writeFileSync(manifestPath, JSON.stringify(diff.currentHashes));

				return cacheDir;
			}
		}

		// Full rebuild: no cache or corrupt manifest
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

		// Write manifest with content hashes
		const currentHashes: Record<string, string> = {};
		for (const file of overrideFiles) {
			currentHashes[file] = this.hashFile(path.join(overrideDir, file));
		}

		const manifestPath = path.join(cacheDir, ".manifest.json");
		fs.writeFileSync(manifestPath, JSON.stringify(currentHashes));

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

	private getChangedOverrides(
		overrideDir: string,
		cacheDir: string,
		overrideFiles: string[],
	):
		| {
				added: string[];
				changed: string[];
				removed: string[];
				currentHashes: Record<string, string>;
		  }
		| undefined {
		const manifestPath = path.join(cacheDir, ".manifest.json");
		if (!fs.existsSync(manifestPath)) {
			return undefined;
		}

		let previousHashes: Record<string, string>;
		try {
			previousHashes = JSON.parse(
				fs.readFileSync(manifestPath, "utf8"),
			) as Record<string, string>;
		} catch {
			return undefined;
		}

		// Compute current hashes
		const currentHashes: Record<string, string> = {};
		for (const file of overrideFiles) {
			currentHashes[file] = this.hashFile(path.join(overrideDir, file));
		}

		const added: string[] = [];
		const changed: string[] = [];
		const removed: string[] = [];

		// Find added and changed files
		for (const file of overrideFiles) {
			if (!(file in previousHashes)) {
				added.push(file);
			} else if (currentHashes[file] !== previousHashes[file]) {
				changed.push(file);
			}
		}

		// Find removed files
		for (const file of Object.keys(previousHashes)) {
			if (!overrideFiles.includes(file)) {
				removed.push(file);
			}
		}

		return { added, changed, removed, currentHashes };
	}

	private hashFile(filePath: string): string {
		const content = fs.readFileSync(filePath);
		return this._hash.toHashSync(content);
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

	private copyPublicFolder(
		sitePath: string,
		output: string,
		previousAssets: Record<string, string>,
		currentAssets: Record<string, string>,
	): void {
		const publicPath = `${sitePath}/public`;

		if (!fs.existsSync(publicPath)) {
			return;
		}

		this._console.step("Copying public folder...");

		const resolvedOutput = path.resolve(output);
		this.copyPublicDirectory(
			publicPath,
			output,
			publicPath,
			resolvedOutput,
			previousAssets,
			currentAssets,
		);
	}

	private copyPublicDirectory(
		source: string,
		target: string,
		basePath: string,
		output: string,
		previousAssets: Record<string, string>,
		currentAssets: Record<string, string>,
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
				this.copyPublicDirectory(
					sourcePath,
					targetPath,
					basePath,
					output,
					previousAssets,
					currentAssets,
				);
			} else {
				const assetKey = `public/${relativePath}`;
				const hash = this.hashFile(sourcePath);
				currentAssets[assetKey] = hash;

				// Skip copy if file hasn't changed
				if (previousAssets[assetKey] === hash && fs.existsSync(targetPath)) {
					continue;
				}

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

	private loadBuildManifest(sitePath: string): BuildManifest | undefined {
		const manifestPath = path.join(
			sitePath,
			".cache",
			"build",
			"manifest.json",
		);
		if (!fs.existsSync(manifestPath)) {
			return undefined;
		}

		try {
			const data = JSON.parse(
				fs.readFileSync(manifestPath, "utf8"),
			) as BuildManifest;
			if (data.version !== 1) {
				return undefined;
			}

			return data;
		} catch {
			return undefined;
		}
	}

	private saveBuildManifest(sitePath: string, manifest: BuildManifest): void {
		const dir = path.join(sitePath, ".cache", "build");
		fs.mkdirSync(dir, { recursive: true });
		fs.writeFileSync(path.join(dir, "manifest.json"), JSON.stringify(manifest));
	}

	private hashOptions(): string {
		const relevant = {
			siteUrl: this.options.siteUrl,
			siteTitle: this.options.siteTitle,
			siteDescription: this.options.siteDescription,
			githubPath: this.options.githubPath,
			template: this.options.template,
			templatePath: this.options.templatePath,
			enableLlmsTxt: this.options.enableLlmsTxt,
			changelogPerPage: this.options.changelogPerPage,
			enableReleaseChangelog: this.options.enableReleaseChangelog,
			sections: this.options.sections,
			openApiUrl: this.options.openApiUrl,
			themeMode: this.options.themeMode,
			cookieAuth: this.options.cookieAuth,
			headerLinks: this.options.headerLinks,
		};
		return this._hash.toHashSync(JSON.stringify(relevant));
	}

	private hashTemplateDirectory(templatePath: string): string {
		/* v8 ignore next 3 -- @preserve */
		if (!fs.existsSync(templatePath)) {
			return "";
		}

		const files = this.listFilesRecursive(templatePath);
		const hashes = files.map((f) => this.hashFile(path.join(templatePath, f)));
		return this._hash.toHashSync(hashes.join(""));
	}

	private loadCachedDocuments(sitePath: string): Map<string, DoculaDocument> {
		const cachePath = path.join(sitePath, ".cache", "build", "documents.json");
		/* v8 ignore next 3 -- @preserve */
		if (!fs.existsSync(cachePath)) {
			return new Map();
		}

		try {
			const data = JSON.parse(fs.readFileSync(cachePath, "utf8")) as Record<
				string,
				DoculaDocument
			>;
			return new Map(Object.entries(data));
		} catch {
			/* v8 ignore next -- @preserve */
			return new Map();
		}
	}

	private saveCachedDocuments(
		sitePath: string,
		documents: DoculaDocument[],
	): void {
		const dir = path.join(sitePath, ".cache", "build");
		fs.mkdirSync(dir, { recursive: true });
		const docsRoot = path.join(sitePath, "docs");
		const map: Record<string, DoculaDocument> = {};
		for (const doc of documents) {
			const relativeKey = path.relative(docsRoot, doc.documentPath);
			map[relativeKey] = doc;
		}

		fs.writeFileSync(path.join(dir, "documents.json"), JSON.stringify(map));
	}

	private loadCachedChangelog(
		sitePath: string,
	): Map<string, DoculaChangelogEntry> {
		const cachePath = path.join(sitePath, ".cache", "build", "changelog.json");
		/* v8 ignore next 3 -- @preserve */
		if (!fs.existsSync(cachePath)) {
			return new Map();
		}

		try {
			const data = JSON.parse(fs.readFileSync(cachePath, "utf8")) as Record<
				string,
				DoculaChangelogEntry
			>;
			return new Map(Object.entries(data));
		} catch {
			return new Map();
		}
	}

	private saveCachedChangelog(
		sitePath: string,
		entries: DoculaChangelogEntry[],
	): void {
		const dir = path.join(sitePath, ".cache", "build");
		fs.mkdirSync(dir, { recursive: true });
		const map: Record<string, DoculaChangelogEntry> = {};
		for (const entry of entries) {
			map[entry.slug] = entry;
		}

		fs.writeFileSync(path.join(dir, "changelog.json"), JSON.stringify(map));
	}

	private hashSourceFiles(dir: string): Record<string, string> {
		const hashes: Record<string, string> = {};
		if (!fs.existsSync(dir)) {
			return hashes;
		}

		const files = this.listFilesRecursive(dir);
		for (const file of files) {
			const fullPath = path.join(dir, file);
			hashes[file] = this.hashFile(fullPath);
		}

		return hashes;
	}

	private recordsEqual(
		a: Record<string, string>,
		b: Record<string, string>,
	): boolean {
		const keysA = Object.keys(a);
		const keysB = Object.keys(b);
		if (keysA.length !== keysB.length) {
			return false;
		}

		for (const key of keysA) {
			if (a[key] !== b[key]) {
				return false;
			}
		}

		return true;
	}

	private hasAssetsChanged(
		sitePath: string,
		previousAssets: Record<string, string>,
	): boolean {
		const assetFiles = [
			"favicon.ico",
			"logo.svg",
			"logo_horizontal.png",
			"variables.css",
			"api/swagger.json",
		];
		for (const file of assetFiles) {
			const filePath = path.join(sitePath, file);
			if (fs.existsSync(filePath)) {
				const hash = this.hashFile(filePath);
				if (previousAssets[file] !== hash) {
					return true;
				}
			} else if (previousAssets[file]) {
				return true;
			}
		}

		// Check public folder
		const publicPath = path.join(sitePath, "public");
		if (fs.existsSync(publicPath)) {
			const publicHashes = this.hashSourceFiles(publicPath);
			for (const [file, hash] of Object.entries(publicHashes)) {
				if (previousAssets[`public/${file}`] !== hash) {
					return true;
				}
			}
		}

		return false;
	}

	/**
	 * Hashes the source file, records it in currentAssets, and returns
	 * whether the copy can be skipped (unchanged from previous build).
	 */
	private hashAssetAndCheckSkip(
		sourcePath: string,
		targetPath: string,
		assetKey: string,
		previousAssets: Record<string, string>,
		currentAssets: Record<string, string>,
	): boolean {
		if (!fs.existsSync(sourcePath)) {
			return true;
		}

		const hash = this.hashFile(sourcePath);
		currentAssets[assetKey] = hash;

		if (previousAssets[assetKey] === hash && fs.existsSync(targetPath)) {
			return true;
		}

		return false;
	}

	private copyDirectoryWithHashing(
		source: string,
		target: string,
		prefix: string,
		previousAssets: Record<string, string>,
		currentAssets: Record<string, string>,
	): void {
		/* v8 ignore next 3 -- @preserve */
		if (!fs.existsSync(source)) {
			return;
		}

		const files = fs.readdirSync(source);
		for (const file of files) {
			/* v8 ignore next -- @preserve */
			if (file.startsWith(".")) {
				continue;
			}

			const sourcePath = `${source}/${file}`;
			const targetPath = `${target}/${file}`;
			/* v8 ignore next -- @preserve */
			const assetKey = prefix ? `${prefix}/${file}` : file;
			const stat = fs.lstatSync(sourcePath);

			/* v8 ignore next 3 -- @preserve */
			if (stat.isSymbolicLink()) {
				continue;
			}

			if (stat.isDirectory()) {
				this.copyDirectoryWithHashing(
					sourcePath,
					targetPath,
					assetKey,
					previousAssets,
					currentAssets,
				);
			} else {
				const hash = this.hashFile(sourcePath);
				currentAssets[assetKey] = hash;
				if (previousAssets[assetKey] === hash && fs.existsSync(targetPath)) {
					continue;
				}

				fs.mkdirSync(target, { recursive: true });
				fs.copyFileSync(sourcePath, targetPath);
			}
		}
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
