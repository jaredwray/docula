// @ts-expect-error - 11ty doesn't have types
import * as pkg from '@11ty/eleventy';
// @ts-expect-error - 11ty doesn't have types
import eleventyNavigationPlugin from '@11ty/eleventy-navigation';
// @ts-expect-error - 11ty doesn't have types
import pluginTOC from 'eleventy-plugin-toc';
import markdownIt from 'markdown-it';
import markdownItAnchor from 'markdown-it-anchor';
import type {Config} from './config.js';
import {squashCallback} from './eleventy/filters.js';
import {getYear, formatDate, parseRelease} from './eleventy/shortcodes.js';
import {getConfig} from './eleventy/global-data.js';

// eslint-disable-next-line @typescript-eslint/naming-convention
const Elev = pkg.default;

type ElevConfig = {
	ignores: {
		add: (pattern: string) => void;
	};
	addPassthroughCopy: (options: Record<string, unknown>) => void;
	setLibrary: (name: string, library: unknown) => void;
	addPlugin: (plugin: any, options?: Record<string, unknown>) => void;
	addShortcode: (name: string, callback: (...args: any[]) => unknown) => void;
	addFilter: (name: string, callback: (text: string) => string) => void;
	setTemplateFormats(strings: string[]): void;
	addGlobalData(name: string, config: () => unknown): void;
};

type ElevInterface = {
	constructor: (originPath: string, outputPath: string, config: {
		quietMode?: boolean;
		config: (config: ElevConfig) => Record<string, unknown>;
	}) => void;
	write: () => Promise<void>;
	toJSON: () => Promise<ElevJSONOutput[]>;
};

// eslint-disable-next-line @typescript-eslint/naming-convention
type ElevJSONOutput = {
	url: string;
	inputPath: string;
	outputPath: string;
	content: string;
};

export class Eleventy {
	private readonly _config: Config;
	private readonly eleventyConfig: {quietMode: boolean; config: (eleventyConfig: ElevConfig) => {htmlTemplateEngine: string; passthroughFileCopy: boolean; markdownTemplateEngine: string}};
	private readonly eleventy: ElevInterface;
	get config(): Config {
		return this._config;
	}

	constructor(config: Config) {
		this._config = config;
		this.eleventyConfig = {
			quietMode: true,
			config: (eleventyConfig: ElevConfig) => {
				eleventyConfig.ignores.add(`./${this.config.originPath}/README.md`);

				this.addPassthroughCopy(eleventyConfig);
				this.setLibrary(eleventyConfig);
				this.addPlugin(eleventyConfig);
				this.addShortcode(eleventyConfig);
				this.addFilter(eleventyConfig);
				this.addGlobalData(eleventyConfig);

				eleventyConfig.setTemplateFormats(['njk', 'md', 'html']);

				return {
					markdownTemplateEngine: 'njk',
					htmlTemplateEngine: 'njk',
					passthroughFileCopy: true,
				};
			},
		};

		// eslint-disable-next-line @typescript-eslint/no-unsafe-call
		this.eleventy = new Elev(this.config.originPath, this.config.outputPath, this.eleventyConfig);
	}

	public async build() {
		try {
			await this.eleventy.write();
		} catch (error: unknown) {
			throw new Error(`Eleventy build failed: ${(error as Error).message}`);
		}
	}

	// eslint-disable-next-line @typescript-eslint/naming-convention
	public async toJSON() {
		const json: ElevJSONOutput[] = await this.eleventy.toJSON();
		return json.filter((element: ElevJSONOutput) => element.url);
	}

	private addPassthroughCopy(eleventyConfig: ElevConfig) {
		const assetsPath = `${this.config.originPath}/_includes/assets`;
		eleventyConfig.addPassthroughCopy({[assetsPath]: '/assets/'});
	}

	private setLibrary(eleventyConfig: ElevConfig) {
		eleventyConfig.setLibrary(
			'md',
			markdownIt().use(markdownItAnchor),
		);
	}

	private addPlugin(eleventyConfig: ElevConfig) {
		eleventyConfig.addPlugin(eleventyNavigationPlugin);
		eleventyConfig.addPlugin(pluginTOC, {
			tags: ['h2'],
		});
	}

	private addShortcode(eleventyConfig: ElevConfig) {
		eleventyConfig.addShortcode('year', getYear);
		eleventyConfig.addShortcode('formatDate', formatDate);
		eleventyConfig.addShortcode('parseRelease', parseRelease);
	}

	private addFilter(eleventyConfig: ElevConfig) {
		eleventyConfig.addFilter('squash', squashCallback);
	}

	private addGlobalData(eleventyConfig: ElevConfig) {
		// EleventyConfig.addGlobalData('algoliaKeys', () => algoliaKeys(this.config));
		eleventyConfig.addGlobalData('config', () => getConfig(this.config));
	}
}
