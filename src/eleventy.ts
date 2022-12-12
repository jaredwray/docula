// @ts-expect-error - 11ty doesn't have types
import * as pkg from '@11ty/eleventy';
import {DateTime} from 'luxon';
// @ts-expect-error - 11ty doesn't have types
import eleventyNavigationPlugin from '@11ty/eleventy-navigation';
// @ts-expect-error - 11ty doesn't have types
import pluginTOC from 'eleventy-plugin-toc';
import markdownIt from 'markdown-it';
import markdownItAnchor from 'markdown-it-anchor';
import {type Config} from './config.js';

// eslint-disable-next-line @typescript-eslint/naming-convention, @typescript-eslint/no-unsafe-assignment
const Elev = pkg.default;

type ElevConfig = {
	addPassthroughCopy: (options: Record<string, any>) => void;
	setLibrary: (name: string, library: Record<string, any>) => void;
	addPlugin: (plugin: any, options?: Record<string, any>) => void;
	addShortcode: (name: string, callback: () => void) => void;
	addFilter: (name: string, callback: (text: string) => string) => void;
};

type ElevInterface = {
	constructor: (originPath: string, outputPath: string, config: {
		quietMode?: boolean;
		config: (config: ElevConfig) => Record<string, any>;
	}) => void;
	write: () => Promise<void>;
};

export class Eleventy {
	private _config: Config;
	get config(): Config {
		return this._config;
	}

	set config(value: Config) {
		this._config = value;
	}

	constructor(config: Config) {
		this._config = config;
	}

	public async build() {
		// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
		const eleventy: ElevInterface = new Elev(this.config.originPath, this.config.outputPath, {
			quietMode: false,

			config(eleventyConfig: ElevConfig) {
				eleventyConfig.addPassthroughCopy({[this.config.assetsPath]: '.'});

				const siteImages = `${this.config.originPath as string}/${this.config.templatePath as string}/${this.config.imagesPath as string}`;
				eleventyConfig.addPassthroughCopy({[siteImages]: '/images/'});

				eleventyConfig.setLibrary(
					'md',
					markdownIt().use(markdownItAnchor),
				);

				eleventyConfig.addPlugin(eleventyNavigationPlugin);
				eleventyConfig.addPlugin(pluginTOC, {
					tags: ['h2'],
				});

				eleventyConfig.addShortcode('year', () => DateTime.now().toFormat('YYYY'));

				// Filters
				eleventyConfig.addFilter('squash', text => {
					const content = text.toString().toLowerCase();

					// Remove duplicated words
					const words = content.split(' ');
					const deduped = [...(new Set(words))];
					const dedupedString = deduped.join(' ');

					// Remove repeated spaces
					return dedupedString.replace(/ {2,}/g, ' ');
				});

				return {
					templateFormats: [
						'md',
						'njk',
						'html',
						'liquid',
					],
					markdownTemplateEngine: 'njk',
					htmlTemplateEngine: 'njk',
					dir: {
						input: this.config.originPath as string,
						output: this.config.outputPath as string,
						includes: this.config.templatePath as string,
						data: `${this.config.templatePath as string}/${this.config.dataPath as string}`,
					},
					passthroughFileCopy: true,
				};
			},
		});

		await eleventy.write();
	}
}
