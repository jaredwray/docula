import path from 'node:path';
import process from 'node:process';

export class DoculaOptions {
	public templatePath = path.join(import.meta.url, '../../template').replace('file:', '');
	public outputPath = path.join(process.cwd(), './dist');
	public sitePath = path.join(process.cwd(), './site');
	public githubPath = 'jaredwray/docula';
	public siteTitle = 'docula';
	public siteDescription = 'Beautiful Website for Your Projects';
	public siteUrl = 'https://docula.org';
	public port = 3000;

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

		if (options.port) {
			this.port = options.port as number;
		}
	}
}
