import path from "node:path";
import process from "node:process";
import type { DoculaSection } from "./builder.js";

export class DoculaOptions {
	/**
	 * Path to the template directory
	 */
	public templatePath = path
		.join(import.meta.url, "../../template")
		.replace("file:", "");
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

	constructor(options?: Record<string, unknown>) {
		if (options) {
			this.parseOptions(options);
		}
	}

	// biome-ignore lint/suspicious/noExplicitAny: need to fix
	public parseOptions(options: Record<string, any>) {
		/* v8 ignore next -- @preserve */
		if (options.templatePath) {
			this.templatePath = options.templatePath as string;
			this.templatePath = path.join(process.cwd(), this.templatePath);
		}

		/* v8 ignore next -- @preserve */
		if (options.outputPath) {
			this.outputPath = options.outputPath as string;
			this.githubPath = path.join(process.cwd(), this.outputPath);
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
	}
}
