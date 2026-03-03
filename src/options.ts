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
	public outputPath = path.join(process.cwd(), "./dist");
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
	 * Single page website
	 */
	public singlePage = true;
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
		if (options.outputPath) {
			this.outputPath = options.outputPath as string;
			this.outputPath = path.join(process.cwd(), this.outputPath);
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

		if (
			options.singlePage !== undefined &&
			typeof options.singlePage === "boolean"
		) {
			this.singlePage = options.singlePage;
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
	}
}
