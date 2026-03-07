import path from "node:path";
import process from "node:process";
import type { DoculaSection } from "./builder.js";

export class DoculaOptions {
	/**
	 * Name of the built-in template to use (e.g., "modern", "classic")
	 */
	public template = "modern";
	/**
	 * Path to the template directory. When set, overrides the `template` option.
	 */
	public templatePath = "";
	/**
	 * Path to the output directory
	 */
	public output = path.join(process.cwd(), "./dist");
	/**
	 * Path to the site directory
	 */
	public sitePath = path.join(process.cwd(), "./site");
	/**
	 * Path to the github repository
	 */
	public githubPath = "jaredwray/docula";
	/**
	 * Site title
	 */
	public siteTitle = "docula";
	/**
	 * Site description
	 */
	public siteDescription = "Beautiful Website for Your Projects";
	/**
	 * Site URL
	 */
	public siteUrl = "https://docula.org";
	/**
	 * Port to run the server
	 */
	public port = 3000;
	/**
	 * Sections
	 */
	public sections?: DoculaSection[];
	/**
	 * OpenAPI specification URL for API documentation.
	 * When provided, creates a dedicated /api page
	 * Supports both external URLs (https://...) and relative paths (/openapi.json)
	 */
	public openApiUrl?: string;
	/**
	 * When true, GitHub releases are converted to changelog entries and merged
	 * with file-based changelog entries. Requires a changelog template to exist.
	 */
	public enableReleaseChangelog = true;
	/**
	 * When false, the first document becomes the home page (index.html)
	 * and the home.hbs template is not rendered.
	 */
	public homePage = true;
	/**
	 * When true, generates llms.txt and llms-full.txt files for the built site.
	 */
	public enableLlmsTxt = true;
	/**
	 * Override the default theme toggle. By default the site follows the system
	 * preference. Set to "light" or "dark" to use that theme when no user
	 * preference is stored in localStorage.
	 */
	public themeMode?: "light" | "dark";
	/**
	 * When true, automatically adds generated paths (e.g., .cache) to the
	 * site directory's .gitignore file if not already present.
	 */
	public autoUpdateIgnores = true;
	/**
	 * File extensions to copy as assets from docs/ and changelog/ directories.
	 * Override in docula.config to customize.
	 */
	public allowedAssets: string[] = [
		".png",
		".jpg",
		".jpeg",
		".gif",
		".svg",
		".webp",
		".avif",
		".ico",
		".pdf",
		".zip",
		".tar",
		".gz",
		".mp4",
		".webm",
		".ogg",
		".mp3",
		".wav",
		".json",
		".xml",
		".csv",
		".txt",
	];

	constructor(options?: Record<string, unknown>) {
		if (options) {
			this.parseOptions(options);
		}
	}

	// biome-ignore lint/suspicious/noExplicitAny: need to fix
	public parseOptions(options: Record<string, any>) {
		/* v8 ignore next -- @preserve */
		if (options.template) {
			this.template = options.template as string;
		}

		/* v8 ignore next -- @preserve */
		if (options.templatePath) {
			this.templatePath = options.templatePath as string;
			this.templatePath = path.join(process.cwd(), this.templatePath);
		}

		/* v8 ignore next -- @preserve */
		if (options.output) {
			this.output = options.output as string;
			this.output = path.join(process.cwd(), this.output);
		}

		/* v8 ignore next -- @preserve */
		if (options.sitePath) {
			this.sitePath = options.sitePath as string;
			this.sitePath = path.join(process.cwd(), this.sitePath);
		}

		/* v8 ignore next -- @preserve */
		if (options.githubPath) {
			this.githubPath = options.githubPath as string;
		}

		/* v8 ignore next -- @preserve */
		if (options.siteTitle) {
			this.siteTitle = options.siteTitle as string;
		}

		/* v8 ignore next -- @preserve */
		if (options.siteDescription) {
			this.siteDescription = options.siteDescription as string;
		}

		/* v8 ignore next -- @preserve */
		if (options.siteUrl) {
			this.siteUrl = options.siteUrl as string;
		}

		/* v8 ignore next -- @preserve */
		if (options.sections) {
			this.sections = options.sections as DoculaSection[];
		}

		if (options.port) {
			this.port = options.port as number;
		}

		/* v8 ignore next -- @preserve */
		if (options.openApiUrl) {
			this.openApiUrl = options.openApiUrl as string;
		}

		if (
			options.enableReleaseChangelog !== undefined &&
			typeof options.enableReleaseChangelog === "boolean"
		) {
			this.enableReleaseChangelog = options.enableReleaseChangelog;
		}

		if (
			options.homePage !== undefined &&
			typeof options.homePage === "boolean"
		) {
			this.homePage = options.homePage;
		}

		if (
			options.enableLlmsTxt !== undefined &&
			typeof options.enableLlmsTxt === "boolean"
		) {
			this.enableLlmsTxt = options.enableLlmsTxt;
		}

		if (
			options.themeMode !== undefined &&
			(options.themeMode === "light" || options.themeMode === "dark")
		) {
			this.themeMode = options.themeMode;
		}

		if (
			options.autoUpdateIgnores !== undefined &&
			typeof options.autoUpdateIgnores === "boolean"
		) {
			this.autoUpdateIgnores = options.autoUpdateIgnores;
		}

		if (options.allowedAssets && Array.isArray(options.allowedAssets)) {
			this.allowedAssets = options.allowedAssets as string[];
		}
	}
}
