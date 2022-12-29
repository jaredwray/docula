// @ts-expect-error - 11ty doesn't have types
import * as pkg from '@11ty/eleventy';
// @ts-expect-error - 11ty doesn't have types
import eleventyNavigationPlugin from '@11ty/eleventy-navigation';
// @ts-expect-error - 11ty doesn't have types
import pluginTOC from 'eleventy-plugin-toc';
import markdownIt from 'markdown-it';
// @ts-expect-error - This module doesn't have types
import markdownItAnchor from 'markdown-it-anchor';
import {type Config} from './config.js';
import {squashCallback} from './eleventy/filters.js';
import {getYear, formatDate} from './eleventy/shortcodes.js';

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
};

type ElevInterface = {
	constructor: (originPath: string, outputPath: string, config: {
		quietMode?: boolean;
		config: (config: ElevConfig) => Record<string, unknown>;
	}) => void;
	write: () => Promise<void>;
};

export class Eleventy {
	private readonly _config: Config;
	get config(): Config {
		return this._config;
	}

	constructor(config: Config) {
		this._config = config;
	}

	public async build() {
		// eslint-disable-next-line @typescript-eslint/no-this-alias, unicorn/no-this-assignment
		const $this = this;
		// eslint-disable-next-line @typescript-eslint/no-unsafe-call
		const eleventy: ElevInterface = new Elev(this.config.originPath, this.config.outputPath, {
			quietMode: false,

			config: (eleventyConfig: ElevConfig) => {
				eleventyConfig.ignores.add(`./${this.config.originPath}/README.md`);

				$this.addPassthroughCopy(eleventyConfig);
				$this.setLibrary(eleventyConfig);
				$this.addPlugin(eleventyConfig);
				$this.addShortcode(eleventyConfig);
				$this.addFilter(eleventyConfig);

				eleventyConfig.setTemplateFormats(['njk', 'md', 'html']);

				return {
					markdownTemplateEngine: 'njk',
					htmlTemplateEngine: 'njk',
					passthroughFileCopy: true,
				};
			},
		});

		await eleventy.write();
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
	}

	private addFilter(eleventyConfig: ElevConfig) {
		eleventyConfig.addFilter('squash', squashCallback);
	}
}
