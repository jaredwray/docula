import path from 'node:path';
import process from 'node:process';
import {type DoculaSection} from './builder.js';

export class DoculaOptions {
	/**
	 * Path to the template directory
	 */
	public templatePath = path.join(import.meta.url, '../../template').replace('file:', '');
	/**
	 * Path to the output directory
	 */
	public outputPath = path.join(process.cwd(), './dist');
	/**
	 * Path to the site directory
	 */
	public sitePath = path.join(process.cwd(), './site');
	/**
	 * Path to the github repository
	 */
	public githubPath = 'jaredwray/docula';
	/**
	 * Site title
	 */
	public siteTitle = 'docula';
	/**
	 * Site description
	 */
	public siteDescription = 'Beautiful Website for Your Projects';
	/**
	 * Site URL
	 */
	public siteUrl = 'https://docula.org';
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

	public parseOptions(options: Record<string, any>) {
		if (options.templatePath) {
			this.templatePath = options.templatePath as string;
			this.templatePath = path.join(process.cwd(), this.templatePath);
		}

		if (options.outputPath) {
			this.outputPath = options.outputPath as string;
			this.githubPath = path.join(process.cwd(), this.outputPath);
		}

		if (options.sitePath) {
			this.sitePath = options.sitePath as string;
			this.sitePath = path.join(process.cwd(), this.sitePath);
		}

		if (options.githubPath) {
			this.githubPath = options.githubPath as string;
		}

		if (options.siteTitle) {
			this.siteTitle = options.siteTitle as string;
		}

		if (options.siteDescription) {
			this.siteDescription = options.siteDescription as string;
		}

		if (options.siteUrl) {
			this.siteUrl = options.siteUrl as string;
		}

		if (options.sections) {
			this.sections = options.sections as DoculaSection[];
		}

		if (options.port) {
			this.port = options.port as number;
		}

		if (options.singlePage !== undefined && typeof options.singlePage === 'boolean') {
			this.singlePage = options.singlePage;
		}
	}
}
