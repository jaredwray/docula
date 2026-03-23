import path from "node:path";
import process from "node:process";
import type { DoculaSection } from "./types.js";

function trimSlashes(value: string): string {
	let start = 0;
	let end = value.length;
	while (start < end && value[start] === "/") start++;
	while (end > start && value[end - 1] === "/") end--;
	return value.slice(start, end);
}

function trimTrailingSlashes(value: string): string {
	let end = value.length;
	while (end > 0 && value[end - 1] === "/") end--;
	return value.slice(0, end);
}

export type DoculaCookieAuth = {
	loginUrl: string;
	logoutUrl?: string;
	authCheckUrl?: string;
	authCheckMethod?: string;
	authCheckUserPath?: string;
};

export type DoculaHeaderLink = {
	label: string;
	url: string;
	icon?: string;
};

export type DoculaOpenGraph = {
	title?: string;
	description?: string;
	image?: string;
	url?: string;
	type?: string;
	siteName?: string;
	twitterCard?: string;
};

export type DoculaCacheOptions = {
	github: {
		ttl: number;
	};
};

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
	public output = "";
	/**
	 * Path to the site directory
	 */
	public sitePath = path.join(process.cwd(), "./site");
	/**
	 * Path to the github repository
	 */
	public githubPath = "";
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
	 * Number of changelog entries to display per page on the changelog index.
	 */
	public changelogPerPage = 20;
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
	 * When true, automatically copies the project root README.md into the site
	 * directory if one does not already exist. The package.json name field is
	 * used to prepend a title heading when the README lacks one.
	 */
	public autoReadme = true;
	/**
	 * URL for the logo/home link in the header. Defaults to baseUrl or "/".
	 * Useful when hosting docs under a subpath but the logo should link to the parent site.
	 */
	public homeUrl?: string;
	/**
	 * Base URL path prefix for all generated paths (e.g., "/docs").
	 * When set, all asset and navigation URLs are prefixed with this path.
	 */
	public baseUrl = "";
	/**
	 * Output subdirectory and URL segment for documentation pages.
	 * Set to empty string to place docs at the output root.
	 */
	public docsPath = "docs";
	/**
	 * Output subdirectory and URL segment for API reference pages.
	 */
	public apiPath = "api";
	/**
	 * Output subdirectory and URL segment for changelog pages.
	 */
	public changelogPath = "changelog";
	/**
	 * Base URL for "Edit this page" links on documentation pages.
	 * When set, an edit link is shown at the bottom of each doc page.
	 * The document's relative path is appended to this URL.
	 * Example: "https://github.com/owner/repo/edit/main/site/docs"
	 */
	public editPageUrl?: string;
	/**
	 * OpenGraph meta tags for social sharing. When set, og: and twitter:
	 * meta tags are rendered in the page head. Fields fall back to
	 * siteTitle / siteDescription / siteUrl when omitted.
	 */
	public openGraph?: DoculaOpenGraph;
	/**
	 * Cookie-based authentication. When set, shows a Login/Logout button
	 * in the header based on whether a JWT cookie is present.
	 */
	public cookieAuth?: DoculaCookieAuth;
	/**
	 * Additional links to display in the site header navigation.
	 * Each link requires a label and url.
	 */
	public headerLinks?: DoculaHeaderLink[];
	/**
	 * File extensions to copy as assets from docs/ and changelog/ directories.
	 * Override in docula.config to customize.
	 */
	/**
	 * Cache settings. Controls caching of external data (e.g., GitHub API responses)
	 * in the .cache directory within the site path.
	 */
	public cache: DoculaCacheOptions = {
		github: {
			ttl: 3600,
		},
	};
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

		if (!this.output) {
			this.output = path.join(this.sitePath, "dist");
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
			options.changelogPerPage !== undefined &&
			typeof options.changelogPerPage === "number" &&
			options.changelogPerPage > 0
		) {
			this.changelogPerPage = options.changelogPerPage;
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

		if (
			options.autoReadme !== undefined &&
			typeof options.autoReadme === "boolean"
		) {
			this.autoReadme = options.autoReadme;
		}

		if (
			options.cache &&
			typeof options.cache === "object" &&
			(options.cache as DoculaCacheOptions).github !== null &&
			typeof (options.cache as DoculaCacheOptions).github === "object" &&
			typeof (options.cache as DoculaCacheOptions).github.ttl === "number"
		) {
			this.cache = options.cache as DoculaCacheOptions;
		}

		if (options.homeUrl !== undefined && typeof options.homeUrl === "string") {
			this.homeUrl = options.homeUrl === "/" ? "/" : trimTrailingSlashes(options.homeUrl);
		}

		if (options.baseUrl !== undefined && typeof options.baseUrl === "string") {
			this.baseUrl = trimTrailingSlashes(options.baseUrl);
		}

		if (
			options.docsPath !== undefined &&
			typeof options.docsPath === "string"
		) {
			this.docsPath = trimSlashes(options.docsPath);
		}

		if (options.apiPath !== undefined && typeof options.apiPath === "string") {
			this.apiPath = trimSlashes(options.apiPath);
		}

		if (
			options.changelogPath !== undefined &&
			typeof options.changelogPath === "string"
		) {
			this.changelogPath = trimSlashes(options.changelogPath);
		}

		if (
			options.editPageUrl !== undefined &&
			typeof options.editPageUrl === "string"
		) {
			this.editPageUrl = trimTrailingSlashes(options.editPageUrl);
		}

		if (options.allowedAssets && Array.isArray(options.allowedAssets)) {
			this.allowedAssets = options.allowedAssets as string[];
		}

		if (
			options.openGraph &&
			typeof options.openGraph === "object" &&
			!Array.isArray(options.openGraph)
		) {
			this.openGraph = options.openGraph as DoculaOpenGraph;
		}

		if (
			options.cookieAuth &&
			typeof options.cookieAuth === "object" &&
			typeof (options.cookieAuth as DoculaCookieAuth).loginUrl === "string"
		) {
			this.cookieAuth = options.cookieAuth as DoculaCookieAuth;
		}

		if (options.headerLinks && Array.isArray(options.headerLinks)) {
			const validLinks = (options.headerLinks as DoculaHeaderLink[]).filter(
				(link) =>
					typeof link === "object" &&
					link !== null &&
					typeof link.label === "string" &&
					typeof link.url === "string",
			);
			if (validLinks.length > 0) {
				this.headerLinks = validLinks;
			}
		}

		// Recompute default output from sitePath if not explicitly provided
		if (!options.output && !this.output) {
			this.output = path.join(this.sitePath, "dist");
		}
	}
}
