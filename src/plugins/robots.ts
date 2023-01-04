import fs from 'fs-extra';
import type {DoculaPlugin, Options, Runtime, Rules} from '../docula-plugin.js';
import type {Config} from '../config.js';

export type RobotsConfig = {
	allowedUrl: string;
	disallowedUrl: string;
};

export class RobotsPlugin implements DoculaPlugin {
	static rules: Rules = {
		type: 'object',
		properties: {
			allowedUrl: {type: 'string'},
			disallowedUrl: {type: 'string'},
		},
	};

	readonly options: Options = {
		sitemapPath: 'sitemap.xml',
		outputFile: 'robots.txt',
	};

	runtime: Runtime = 'after';

	constructor(config: Config) {
		this.options.outputPath = config.outputPath;
		const {allowedUrl, disallowedUrl} = config.pluginConfig.robots as RobotsConfig;
		this.options.allowedUrl = allowedUrl;
		this.options.disallowedUrl = disallowedUrl;
	}

	async execute(): Promise<void> {
		const isAllowed = this.options.allowedUrl ? `Allow: ${this.options.allowedUrl}` : '';
		const isDisallowed = this.options.disallowedUrl ? `Disallow: ${this.options.disallowedUrl}` : '';

		const data = `User-agent: *
      ${isAllowed}
      ${isDisallowed}
      Sitemap: ${this.options.sitemapPath}
     `;

		const filePath = `${this.options.outputPath}/${this.options.outputFile}`;
		await fs.ensureDir(this.options.outputPath);
		await fs.writeFile(filePath, JSON.stringify(data, null, 2));
	}
}
