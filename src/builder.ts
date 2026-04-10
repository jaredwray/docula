import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { Ecto } from "ecto";
import { Hashery } from "hashery";
import { Writr, type WritrOptions } from "writr";
import {
	createAIModel,
	enrichChangelogEntries,
	enrichDocuments,
	enrichReadme,
	loadAIMetadataCache,
	saveAIMetadataCache,
} from "./builder-ai.js";
import {
	buildAllApiPages as _buildAllApiPages,
	buildApiHomePage as _buildApiHomePage,
	buildApiPage as _buildApiPage,
	renderApiContent as _renderApiContent,
} from "./builder-api.js";
import {
	ensureCacheInGitignore,
	hasAssetsChanged,
	hashAssetAndCheckSkip,
	hashFile,
	hashOptions,
	hashSourceFiles,
	hashTemplateDirectory,
	loadBuildManifest,
	loadCachedChangelog,
	loadCachedDocuments,
	recordsEqual,
	saveBuildManifest,
	saveCachedChangelog,
	saveCachedDocuments,
} from "./builder-cache.js";
import {
	buildChangelogEntryPages as _buildChangelogEntryPages,
	buildChangelogFeedJson as _buildChangelogFeedJson,
	buildChangelogLatestFeedJson as _buildChangelogLatestFeedJson,
	buildChangelogPage as _buildChangelogPage,
	convertReleaseToChangelogEntry as _convertReleaseToChangelogEntry,
	generateChangelogPreview as _generateChangelogPreview,
	getChangelogEntries as _getChangelogEntries,
	getReleasesAsChangelogEntries as _getReleasesAsChangelogEntries,
	parseChangelogEntry as _parseChangelogEntry,
} from "./builder-changelog.js";
import {
	generateSidebarItems as _generateSidebarItems,
	getDocumentInDirectory as _getDocumentInDirectory,
	getDocuments as _getDocuments,
	getSections as _getSections,
	mergeSectionWithOptions as _mergeSectionWithOptions,
	parseDocumentData as _parseDocumentData,
} from "./builder-documents.js";
import {
	copyContentAssets,
	copyDirectoryWithHashing,
	copyDocumentSiblingAssets,
	copyPublicFolder,
	mergeTemplateOverrides,
} from "./builder-files.js";
import { buildLlmsFiles as _buildLlmsFiles } from "./builder-llm.js";
import {
	buildFeedPage as _buildFeedPage,
	buildRobotsPage as _buildRobotsPage,
	buildSiteMapPage as _buildSiteMapPage,
	resolveJsonLd as _resolveJsonLd,
	resolveOpenGraphData as _resolveOpenGraphData,
} from "./builder-seo.js";
import { buildUrlPath, isRemoteUrl } from "./builder-utils.js";
import { DoculaConsole } from "./console.js";
import {
	Github,
	type GithubCacheConfig,
	type GithubData,
	type GithubOptions,
} from "./github.js";
import { DoculaOptions } from "./options.js";
import { resolveTemplatePath } from "./template-resolver.js";
import type {
	BuildManifest,
	DoculaChangelogEntry,
	DoculaData,
	DoculaDocument,
	DoculaSection,
	DoculaTemplates,
} from "./types.js";

// Re-export all types for backward compatibility
export type {
	BuildManifest,
	DoculaChangelogEntry,
	DoculaData,
	DoculaDocument,
	DoculaSection,
	DoculaTemplates,
} from "./types.js";

const writrOptions: WritrOptions = {
	throwOnEmitError: false,
	throwOnEmptyListeners: false,
};

export type DoculaBuilderOptions = {
	console?: DoculaConsole;
} & DoculaOptions;

export class DoculaBuilder {
	private readonly _options: DoculaOptions = new DoculaOptions();
	private readonly _ecto: Ecto;
	private readonly _console: DoculaConsole;
	private readonly _hash = new Hashery();
	public onReleaseChangelog?: (
		entries: DoculaChangelogEntry[],
		console: DoculaConsole,
	) => Promise<DoculaChangelogEntry[]> | DoculaChangelogEntry[];

	public get console(): DoculaConsole {
		return this._console;
	}

	// biome-ignore lint/suspicious/noExplicitAny: need to fix
	constructor(options?: DoculaBuilderOptions, engineOptions?: any) {
		if (options) {
			this._options = options;
		}

		if (options?.console) {
			this._console = options?.console;
		} else {
			this._console = new DoculaConsole();
			if (options?.quiet) {
				this._console.quiet = true;
			}
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
		const resolvedTemplatePath = mergeTemplateOverrides(
			this._options,
			this._console,
			this._hash,
			resolveTemplatePath(this.options.templatePath, this.options.template),
			this.options.sitePath,
			this.options.template,
		);

		// Load previous build manifest and compute current hashes
		const previousManifest = loadBuildManifest(this.options.sitePath);
		const currentConfigHash = hashOptions(this._hash, this._options);
		const currentTemplateHash = hashTemplateDirectory(
			this._hash,
			resolvedTemplatePath,
		);

		// If config changed, discard manifest (force full rebuild)
		const validManifest =
			previousManifest?.configHash === currentConfigHash
				? previousManifest
				: undefined;

		// Hash all source files for change detection (keys are relative to the dir)
		const currentDocHashes = hashSourceFiles(
			this._hash,
			`${this.options.sitePath}/docs`,
		);
		const currentChangelogHashes = hashSourceFiles(
			this._hash,
			`${this.options.sitePath}/changelog`,
		);
		const currentAssetHashes: Record<string, string> = {};

		// Check if anything changed at all (full build skip for watch mode)
		// Only skip if the output directory exists (otherwise we need a full build)
		if (
			validManifest &&
			fs.existsSync(this.options.output) &&
			validManifest.templateHash === currentTemplateHash &&
			recordsEqual(validManifest.docs, currentDocHashes) &&
			recordsEqual(validManifest.changelog, currentChangelogHashes)
		) {
			// Check assets too
			const assetsChanged = hasAssetsChanged(
				this._hash,
				this.options.sitePath,
				validManifest.assets,
				this.options.autoReadme,
			);
			if (!assetsChanged) {
				this._console.success("No changes detected, skipping build");
				return;
			}
		}

		// Load cached parsed objects if manifest is valid
		const cachedDocs = validManifest
			? loadCachedDocuments(this.options.sitePath)
			: new Map<string, DoculaDocument>();
		const cachedChangelog = validManifest
			? loadCachedChangelog(this.options.sitePath)
			: new Map<string, DoculaChangelogEntry>();

		// Resolve project root README.md for the home page when not already
		// present in the site path. The README is rendered in place without
		// being copied into sitePath.
		const autoReadmeResult = await this.autoReadme();
		const siteReadmeExists = fs.existsSync(
			`${this.options.sitePath}/README.md`,
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
			hasReadme: siteReadmeExists || autoReadmeResult !== undefined,
			readmeContent: autoReadmeResult?.content,
			themeMode: this.options.themeMode,
			cookieAuth: this.options.cookieAuth,
			headerLinks: this.options.headerLinks,
			googleTagManager: this.options.googleTagManager,
			isGtag: this.options.googleTagManager?.startsWith("G-") ?? false,
			enableLlmsTxt: this.options.enableLlmsTxt,
			homeUrl: this.options.homeUrl,
			baseUrl: this.options.baseUrl,
			docsPath: this.options.docsPath,
			apiPath: this.options.apiPath,
			changelogPath: this.options.changelogPath,
			docsUrl: buildUrlPath(this.options.baseUrl, this.options.docsPath),
			apiUrl: buildUrlPath(this.options.baseUrl, this.options.apiPath),
			changelogUrl: buildUrlPath(
				this.options.baseUrl,
				this.options.changelogPath,
			),
			editPageUrl: this.options.editPageUrl,
			openGraph: this.options.openGraph,
		};

		// Track README.md in asset hashes for change detection. Prefer the
		// site README when it exists; otherwise track the root README that
		// autoReadme resolved so edits to it still invalidate the cache.
		if (siteReadmeExists) {
			currentAssetHashes["README.md"] = hashFile(
				this._hash,
				`${this.options.sitePath}/README.md`,
			);
		} else if (autoReadmeResult) {
			currentAssetHashes.__autoReadme = hashFile(
				this._hash,
				autoReadmeResult.sourcePath,
			);
		}

		// Normalize API specs into openApiSpecs array
		if (Array.isArray(this.options.openApiUrl)) {
			doculaData.openApiSpecs = this.options.openApiUrl.map((spec) => ({
				name: spec.name,
				url: isRemoteUrl(spec.url)
					? spec.url
					: buildUrlPath(this.options.apiPath, spec.url),
				...(typeof spec.order === "number" && { order: spec.order }),
			}));
		} else if (typeof this.options.openApiUrl === "string") {
			doculaData.openApiSpecs = [
				{ name: "API Reference", url: this.options.openApiUrl },
			];
		} else {
			const detectedSpecs: Array<{
				name: string;
				url: string;
			}> = [];
			// Auto-detect root swagger.json
			if (fs.existsSync(`${doculaData.sitePath}/api/swagger.json`)) {
				const rootUrl = buildUrlPath(
					this.options.baseUrl,
					this.options.apiPath,
					"swagger.json",
				);
				detectedSpecs.push({
					name: "API Reference",
					url: rootUrl,
				});
			}

			// Auto-detect subdirectory swagger.json files (api/*/swagger.json)
			const apiDir = `${doculaData.sitePath}/api`;
			if (fs.existsSync(apiDir)) {
				try {
					const entries = await fs.promises.readdir(apiDir, {
						withFileTypes: true,
					});
					for (const entry of entries) {
						if (
							entry.isDirectory() &&
							fs.existsSync(`${apiDir}/${entry.name}/swagger.json`)
						) {
							const specUrl = buildUrlPath(
								this.options.baseUrl,
								this.options.apiPath,
								entry.name,
								"swagger.json",
							);
							const displayName = entry.name
								.replace(/[-_]/g, " ")
								.replace(/\b\w/g, (c) => c.toUpperCase());
							detectedSpecs.push({
								name: displayName,
								url: specUrl,
							});
						}
					}
				} catch {
					// Ignore errors reading api directory
				}
			}

			if (detectedSpecs.length > 0) {
				doculaData.openApiSpecs = detectedSpecs;
			}
		}

		// Sort specs by order (ascending, undefined last)
		if (doculaData.openApiSpecs && doculaData.openApiSpecs.length > 1) {
			doculaData.openApiSpecs.sort((a, b) => {
				const aOrder = a.order ?? Number.MAX_SAFE_INTEGER;
				const bOrder = b.order ?? Number.MAX_SAFE_INTEGER;
				return aOrder - bOrder;
			});
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

		// AI metadata enrichment for OG/meta tags
		/* v8 ignore next 40 -- @preserve */
		if (this._options.ai) {
			const aiModel = await createAIModel(this._options.ai);
			if (aiModel) {
				this._console.step("Enriching metadata with AI...");
				const aiCache = loadAIMetadataCache(this._options.sitePath);
				doculaData.documents = await enrichDocuments(
					doculaData.documents,
					aiModel,
					this._hash,
					this._console,
					aiCache,
				);
				doculaData.changelogEntries = await enrichChangelogEntries(
					doculaData.changelogEntries,
					aiModel,
					this._hash,
					this._console,
					aiCache,
				);
				if (doculaData.hasReadme && !doculaData.hasDocuments) {
					const readmeForEnrichment =
						doculaData.readmeContent ??
						(siteReadmeExists
							? fs.readFileSync(`${this._options.sitePath}/README.md`, "utf8")
							: undefined);
					doculaData.readmeMetadata = await enrichReadme(
						readmeForEnrichment,
						aiModel,
						this._hash,
						this._console,
						aiCache,
					);
				}

				saveAIMetadataCache(this._options.sitePath, aiCache);
			}
		}

		// Get the templates to use
		doculaData.templates = await this.getTemplates(
			resolvedTemplatePath,
			doculaData.hasDocuments,
			doculaData.hasChangelog,
		);
		doculaData.hasApi = Boolean(
			doculaData.openApiSpecs &&
				doculaData.openApiSpecs.length > 0 &&
				doculaData.templates?.api,
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

		// Build the changelog JSON feeds (/changelog.json and /changelog-latest.json)
		// Require the changelog-entry template so feed URLs don't point to pages that were never built.
		if (doculaData.hasChangelog && doculaData.templates?.changelogEntry) {
			await this.buildChangelogFeedJson(doculaData);
			this._console.fileBuilt("changelog.json");
			await this.buildChangelogLatestFeedJson(doculaData);
			this._console.fileBuilt("changelog-latest.json");
		}

		if (doculaData.hasDocuments) {
			this._console.step("Building documentation pages...");
			await this.buildDocsPages(doculaData);
			/* v8 ignore next 3 -- @preserve */
			for (const document of doculaData.documents ?? []) {
				this._console.fileBuilt(document.urlPath);
			}
		}

		// Build the API documentation page
		if (doculaData.hasApi) {
			this._console.step("Building API page...");
			await this.buildAllApiPages(doculaData);
			this._console.fileBuilt(`${this.options.apiPath}/index.html`);
		}

		// Build changelog pages (/changelog/index.html and /changelog/{slug}/index.html)
		if (doculaData.hasChangelog) {
			this._console.step("Building changelog...");
			await this.buildChangelogPage(doculaData);
			this._console.fileBuilt(`${this.options.changelogPath}/index.html`);
			await this.buildChangelogEntryPages(doculaData);
			/* v8 ignore next 3 -- @preserve */
			for (const entry of doculaData.changelogEntries ?? []) {
				this._console.fileBuilt(
					`${this.options.changelogPath}/${entry.slug}/index.html`,
				);
			}
		}

		const siteRelativePath = this.options.sitePath;
		const previousAssets = validManifest?.assets ?? {};

		this._console.step("Copying assets...");

		// Copy over favicon
		if (
			!hashAssetAndCheckSkip(
				this._hash,
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
			!hashAssetAndCheckSkip(
				this._hash,
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
			!hashAssetAndCheckSkip(
				this._hash,
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
			copyDirectoryWithHashing(
				this._hash,
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
			copyDirectoryWithHashing(
				this._hash,
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
			!hashAssetAndCheckSkip(
				this._hash,
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

		// Record swagger.json hash(es) for change detection
		const swaggerPath = `${siteRelativePath}/api/swagger.json`;
		if (fs.existsSync(swaggerPath)) {
			currentAssetHashes["api/swagger.json"] = hashFile(
				this._hash,
				swaggerPath,
			);
		}

		// Also track swagger.json in api subdirectories
		const apiDirPath = `${siteRelativePath}/api`;
		if (fs.existsSync(apiDirPath)) {
			try {
				const apiEntries = await fs.promises.readdir(apiDirPath, {
					withFileTypes: true,
				});
				for (const entry of apiEntries) {
					if (entry.isDirectory()) {
						const subSwaggerPath = `${apiDirPath}/${entry.name}/swagger.json`;
						if (fs.existsSync(subSwaggerPath)) {
							const hashKey = `api/${entry.name}/swagger.json`;
							currentAssetHashes[hashKey] = hashFile(
								this._hash,
								subSwaggerPath,
							);
						}
					}
				}
			} catch {
				// Ignore errors reading api subdirectories
			}
		}

		// Copy over public folder contents (differential) and record their hashes
		copyPublicFolder(
			this._console,
			this._hash,
			siteRelativePath,
			this.options.output,
			validManifest?.assets ?? {},
			currentAssetHashes,
		);

		// Copy non-markdown assets from changelog/ to output
		copyContentAssets(
			this._options,
			`${doculaData.sitePath}/changelog`,
			`${this.options.output}/${this.options.changelogPath}`,
		);

		// Copy assets from each document's source directory into its output directory
		// so that relative paths in markdown (e.g. images/diagram.png) resolve correctly
		if (doculaData.documents?.length) {
			copyDocumentSiblingAssets(this._options, doculaData);
		}

		// Build LLM index/content files after static assets are in place
		/* v8 ignore next 3 -- @preserve */
		if (this.options.enableLlmsTxt) {
			this._console.step("Building LLM files...");
		}

		await this.buildLlmsFiles(doculaData);

		// Save build manifest for differential builds
		ensureCacheInGitignore(this._options, this._console, this.options.sitePath);
		const newManifest: BuildManifest = {
			version: 1,
			configHash: currentConfigHash,
			templateHash: currentTemplateHash,
			docs: currentDocHashes,
			changelog: currentChangelogHashes,
			assets: currentAssetHashes,
		};
		saveBuildManifest(this.options.sitePath, newManifest);

		// Save cached parsed objects
		/* v8 ignore next -- @preserve */
		saveCachedDocuments(this.options.sitePath, doculaData.documents ?? []);
		saveCachedChangelog(this.options.sitePath, fileChangelogEntries);

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

	public async autoReadme(): Promise<
		{ sourcePath: string; content: string } | undefined
	> {
		if (!this._options.autoReadme) {
			return undefined;
		}

		const siteReadmePath = path.join(this._options.sitePath, "README.md");
		if (fs.existsSync(siteReadmePath)) {
			return undefined;
		}

		const cwdDir = process.cwd();
		const cwdReadmePath = path.join(cwdDir, "README.md");
		if (!fs.existsSync(cwdReadmePath)) {
			return undefined;
		}

		let readmeContent = await fs.promises.readFile(cwdReadmePath, "utf8");

		// Check if README already has a title (# heading on the first non-empty line)
		const firstLine = readmeContent.trimStart().split("\n")[0] ?? "";
		const hasTitle = /^#\s+/.test(firstLine);

		if (!hasTitle) {
			const packageJsonPath = path.join(cwdDir, "package.json");
			if (fs.existsSync(packageJsonPath)) {
				try {
					const packageJson = JSON.parse(
						await fs.promises.readFile(packageJsonPath, "utf8"),
					) as { name?: string };
					if (packageJson.name && typeof packageJson.name === "string") {
						readmeContent = `# ${packageJson.name}\n\n${readmeContent}`;
					}
				} catch {
					// Ignore JSON parse errors
				}
			}
		}

		return { sourcePath: cwdReadmePath, content: readmeContent };
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
		return _buildRobotsPage(options);
	}

	public async buildSiteMapPage(data: DoculaData): Promise<void> {
		return _buildSiteMapPage(data, this._options);
	}

	public async buildFeedPage(data: DoculaData): Promise<void> {
		return _buildFeedPage(data);
	}

	public async buildChangelogFeedJson(data: DoculaData): Promise<void> {
		return _buildChangelogFeedJson(data);
	}

	public async buildChangelogLatestFeedJson(data: DoculaData): Promise<void> {
		return _buildChangelogLatestFeedJson(data, this._options);
	}

	public async buildLlmsFiles(data: DoculaData): Promise<void> {
		return _buildLlmsFiles(this._options, this._console, data);
	}

	public resolveOpenGraphData(
		data: DoculaData,
		pageUrl: string,
		pageData?: Partial<DoculaDocument> & {
			previewImage?: string;
			preview?: string;
		},
	): Record<string, string | undefined> {
		return _resolveOpenGraphData(data, pageUrl, pageData);
	}

	public resolveJsonLd(
		pageType: "home" | "docs" | "api" | "changelog" | "changelog-entry",
		data: DoculaData,
		pageUrl: string,
		pageData?: Partial<DoculaDocument> & {
			date?: string;
			preview?: string;
			previewImage?: string;
		},
	): string {
		return _resolveJsonLd(pageType, data, pageUrl, pageData);
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

			const readmeMeta = data.readmeMetadata;
			const indexContent = await this._ecto.renderFromFile(
				indexTemplate,
				{
					...data,
					content,
					announcement,
					description: readmeMeta?.description ?? data.siteDescription,
					keywords: readmeMeta?.keywords,
					...this.resolveOpenGraphData(data, "/", readmeMeta),
					jsonLd: this.resolveJsonLd("home", data, "/"),
				},
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

		let editPageDocUrl: string | undefined;
		if (data.editPageUrl) {
			const docsRoot = path.join(data.sitePath, "docs");
			const relativeFilePath = path
				.relative(docsRoot, firstDocument.documentPath)
				.split(path.sep)
				.join("/");
			editPageDocUrl = `${data.editPageUrl}/${relativeFilePath}`;
		}

		const documentContent = await this._ecto.renderFromFile(
			documentsTemplate,
			{
				...data,
				...firstDocument,
				editPageDocUrl,
				...this.resolveOpenGraphData(data, "/", firstDocument),
				jsonLd: this.resolveJsonLd("docs", data, "/", firstDocument),
			},
			data.templatePath,
		);
		await fs.promises.writeFile(indexPath, documentContent, "utf8");
	}

	public async buildReadmeSection(data: DoculaData): Promise<string> {
		let htmlReadme = "";
		if (data.readmeContent !== undefined) {
			htmlReadme = await new Writr(data.readmeContent, writrOptions).render();
		} else if (fs.existsSync(`${data.sitePath}/README.md`)) {
			const readmeContent = fs.readFileSync(
				`${data.sitePath}/README.md`,
				"utf8",
			);
			htmlReadme = await new Writr(readmeContent, writrOptions).render();
		}

		return htmlReadme;
	}

	public async buildAnnouncementSection(
		data: DoculaData,
	): Promise<string | undefined> {
		const announcementPath = `${data.sitePath}/announcement.md`;
		if (fs.existsSync(announcementPath)) {
			const announcementContent = fs.readFileSync(announcementPath, "utf8");
			return new Writr(announcementContent, writrOptions).render();
		}

		return undefined;
	}

	public async buildDocsPages(data: DoculaData): Promise<void> {
		if (data.templates && data.documents?.length) {
			const documentsTemplate = `${data.templatePath}/${data.templates.docPage}`;
			const resolvedDocsPath = data.docsPath;
			const docsOutputDir = resolvedDocsPath
				? `${data.output}/${resolvedDocsPath}`
				: `${data.output}`;
			await fs.promises.mkdir(docsOutputDir, { recursive: true });
			data.sidebarItems = this.generateSidebarItems(data);

			const promises = data.documents.map(async (document) => {
				const folder = document.urlPath.split("/").slice(0, -1).join("/");
				await fs.promises.mkdir(`${data.output}/${folder}`, {
					recursive: true,
				});
				const slug = `${data.output}${document.urlPath}`;
				let editPageDocUrl: string | undefined;
				if (data.editPageUrl) {
					const docsRoot = path.join(data.sitePath, "docs");
					const relativeFilePath = path
						.relative(docsRoot, document.documentPath)
						.split(path.sep)
						.join("/");
					editPageDocUrl = `${data.editPageUrl}/${relativeFilePath}`;
				}

				const docPageUrl = document.urlPath.replace(/\/index\.html$/, "/");
				const documentContent = await this._ecto.renderFromFile(
					documentsTemplate,
					{
						...data,
						...document,
						editPageDocUrl,
						...this.resolveOpenGraphData(data, docPageUrl, document),
						jsonLd: this.resolveJsonLd("docs", data, docPageUrl, document),
					},
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
		return _renderApiContent(this._ecto, data);
	}

	public async buildApiPage(data: DoculaData): Promise<void> {
		return _buildApiPage(this._ecto, data);
	}

	public async buildAllApiPages(data: DoculaData): Promise<void> {
		return _buildAllApiPages(this._ecto, data);
	}

	public async buildApiHomePage(data: DoculaData): Promise<void> {
		return _buildApiHomePage(this._ecto, data);
	}

	public getChangelogEntries(
		changelogPath: string,
		cachedEntries?: Map<string, DoculaChangelogEntry>,
		previousHashes?: Record<string, string>,
		currentHashes?: Record<string, string>,
	): DoculaChangelogEntry[] {
		return _getChangelogEntries(
			changelogPath,
			this._options,
			this._hash,
			cachedEntries,
			previousHashes,
			currentHashes,
		);
	}

	public parseChangelogEntry(filePath: string): DoculaChangelogEntry {
		return _parseChangelogEntry(filePath, this._options);
	}

	public generateChangelogPreview(
		markdown: string,
		maxLength = 500,
		mdx = false,
	): string {
		return _generateChangelogPreview(markdown, maxLength, mdx);
	}

	public convertReleaseToChangelogEntry(
		// biome-ignore lint/suspicious/noExplicitAny: GitHub release object
		release: Record<string, any>,
	): DoculaChangelogEntry {
		return _convertReleaseToChangelogEntry(release, this._options);
	}

	public getReleasesAsChangelogEntries(
		// biome-ignore lint/suspicious/noExplicitAny: GitHub release objects
		releases: any[],
	): DoculaChangelogEntry[] {
		return _getReleasesAsChangelogEntries(releases, this._options);
	}

	public async buildChangelogPage(data: DoculaData): Promise<void> {
		return _buildChangelogPage(this._ecto, this._options, data);
	}

	public async buildChangelogEntryPages(data: DoculaData): Promise<void> {
		return _buildChangelogEntryPages(this._ecto, data);
	}

	public generateSidebarItems(data: DoculaData): DoculaSection[] {
		return _generateSidebarItems(data);
	}

	public getDocuments(
		sitePath: string,
		doculaData: DoculaData,
		cachedDocs?: Map<string, DoculaDocument>,
		previousDocHashes?: Record<string, string>,
		currentDocHashes?: Record<string, string>,
	): DoculaDocument[] {
		return _getDocuments(
			sitePath,
			doculaData,
			this._options,
			this._hash,
			cachedDocs,
			previousDocHashes,
			currentDocHashes,
		);
	}

	public getDocumentInDirectory(
		sitePath: string,
		docsRootPath: string,
		cachedDocs?: Map<string, DoculaDocument>,
		previousDocHashes?: Record<string, string>,
		currentDocHashes?: Record<string, string>,
	): DoculaDocument[] {
		return _getDocumentInDirectory(
			sitePath,
			docsRootPath,
			this._options,
			this._hash,
			cachedDocs,
			previousDocHashes,
			currentDocHashes,
		);
	}

	public getSections(
		sitePath: string,
		doculaOptions: DoculaOptions,
	): DoculaSection[] {
		return _getSections(sitePath, doculaOptions);
	}

	public mergeSectionWithOptions(
		section: DoculaSection,
		options: DoculaOptions,
	): DoculaSection {
		return _mergeSectionWithOptions(section, options);
	}

	public parseDocumentData(documentPath: string): DoculaDocument {
		return _parseDocumentData(documentPath, this._options);
	}
}
