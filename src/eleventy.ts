// @ts-ignore
import * as pkg from '@11ty/eleventy';
import {Config} from './config.js';
const Elev = pkg.default;

export class Eleventy {
	private readonly _config = new Config();

	constructor(config: any) {
		this._config = config;
	}

	get config() {
		return this._config;
	}

	public async build() {
		const eleventy = new Elev('site', '_dist', {
			quietMode: true,

			config(eleventyConfig: any) {

				return {
					templateFormats: [
						"md",
						"njk",
						"html",
						"liquid"
					],
					markdownTemplateEngine: "njk",
					htmlTemplateEngine: "njk",
					passthroughFileCopy: true
				}
			},
		});

		await eleventy.write();
	}
}
