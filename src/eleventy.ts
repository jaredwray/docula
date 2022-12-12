// @ts-ignore
import * as pkg from '@11ty/eleventy';
import {Config} from './config.js';
// @ts-ignore
import {DateTime} from "luxon";
// @ts-ignore
import eleventyNavigationPlugin from '@11ty/eleventy-navigation';
// @ts-ignore
import pluginTOC from 'eleventy-plugin-toc';
import markdownIt from 'markdown-it';
import markdownItAnchor from 'markdown-it-anchor';

const Elev = pkg.default;

export class Eleventy {
	private config: Config;

	constructor(config: any) {
		this.config = config;
	}

	public async build() {
		const eleventy = new Elev(this.config.originPath, this.config.outputPath, {
			quietMode: false,

			config(eleventyConfig: any) {
				eleventyConfig.addPassthroughCopy({ [this.config.assetsPath] : '.' });

				const siteImages: string = this.config.originPath + '/' + this.config.templatePath + '/' + this.config.imagesPath;
				eleventyConfig.addPassthroughCopy({ [siteImages] : '/images/'});

				eleventyConfig.setLibrary(
					'md',
					markdownIt().use(markdownItAnchor)
				)

				eleventyConfig.addPlugin(eleventyNavigationPlugin);
				eleventyConfig.addPlugin(pluginTOC , {
					tags: ['h2'],
				});

				eleventyConfig.addShortcode("year", function () {
					return DateTime.now().toFormat("YYYY");
				});

				//filters
				eleventyConfig.addFilter("squash", function(text: string) {
					const content = text.toString().toLowerCase();

					// remove duplicated words
					const words = content.split(' ');
					const deduped = [...(new Set(words))];
					const dedupedStr = deduped.join(' ')

					//remove repeated spaces
					return dedupedStr.replace(/[ ]{2,}/g, ' ');
				})


				return {
					templateFormats: [
						"md",
						"njk",
						"html",
						"liquid"
					],
					markdownTemplateEngine: "njk",
					htmlTemplateEngine: "njk",
					dir: {
						input: this.config.originPath,
						output: this.config.outputPath,
						includes:  this.config.templatePath,
						data: this.config.templatePath + '/' + this.config.dataPath
					},
					passthroughFileCopy: true
				}
			},
		});

		await eleventy.write();
	}
}
