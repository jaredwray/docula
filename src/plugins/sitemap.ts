import * as fs from 'fs-extra';
import type {DoculaPlugin, Options, Rules} from '../docula-plugin.js';
import type {Config} from '../config.js';
import {type Runtime} from '../docula-plugin.js';
import {Eleventy} from '../eleventy.js';

export type SitemapConfig = {
	baseUrl: string;
};

export class SitemapPlugin implements DoculaPlugin {
	static rules: Rules = {
		type: 'object',
		required: ['baseUrl'],
		properties: {
			baseUrl: {type: 'string'},
		},
	};

	readonly options: Options = {
		baseUrl: '',
		outputFile: 'sitemap.xml',
		outputPath: '',
	};

	runtime: Runtime = 'after';
	private readonly eleventy: Eleventy;

	constructor(config: Config) {
		this.eleventy = new Eleventy(config);
		this.options.outputPath = config.outputPath;
		const {baseUrl} = config.pluginConfig.sitemap as SitemapConfig;
		this.options.baseUrl = baseUrl;
	}

	async execute(): Promise<void> {
		const jsonContent = await this.eleventy.toJSON();
		const content = `<?xml version="1.0" encoding="utf-8"?>
				<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1" xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">
				  ${jsonContent.map((item) => (`<url><loc>${this.options.baseUrl}${item.url}</loc></url>`)).join('')}
				</urlset>`;

		fs.writeFileSync(`${this.options.outputPath}/${this.options.outputFile}`, content);
	}
}
