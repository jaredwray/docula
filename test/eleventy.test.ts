// @ts-expect-error - 11ty doesn't have types
import * as elev from '@11ty/eleventy';
import {Eleventy} from '../src/eleventy.js';
import {Config} from '../src/config.js';

// eslint-disable-next-line @typescript-eslint/naming-convention
const Elev = elev.default;

describe('Eleventy', () => {
	it('Eleventy - init', () => {
		const config = new Config();
		const eleventy = new Eleventy(config);
		expect(eleventy).toBeDefined();
	});

	it('Eleventy - init with config', async () => {
		jest.spyOn(Elev.prototype, 'write').mockImplementation();
		const config = new Config();
		const eleventy = new Eleventy(config);
		await eleventy.build();
		expect(Elev.prototype.write).toHaveBeenCalled();
	});

	it('Eleventy - build failed error', async () => {
		jest.spyOn(Elev.prototype, 'write').mockImplementation(() => {
			throw new Error('test');
		});
		const config = new Config();
		const eleventy = new Eleventy(config);

		try {
			await eleventy.build();
		} catch (error: unknown) {
			expect((error as Error).message).toBe('Eleventy build failed: test');
		}

		expect(Elev.prototype.write).toHaveBeenCalled();
	});

	it('Eleventy - add filter', async () => {
		const eleventyConfig = {
			addFilter: jest.fn(),
		};
		const config = new Config();
		const eleventy = new Eleventy(config);
		// @ts-expect-error - private method
		eleventy.addFilter(eleventyConfig);
		expect(eleventyConfig.addFilter).toHaveBeenCalled();
	});

	it('Eleventy - add shortcode', async () => {
		const eleventyConfig = {
			addShortcode: jest.fn(),
		};
		const config = new Config();
		const eleventy = new Eleventy(config);
		// @ts-expect-error - private method
		eleventy.addShortcode(eleventyConfig);
		expect(eleventyConfig.addShortcode).toHaveBeenCalled();
	});

	it('Eleventy - toJSON method', async () => {
		jest.spyOn(Elev.prototype, 'toJSON').mockImplementation(async () => [
			{
				url: '/demo',
				inputPath: 'test/site/demo/index.html',
				outputPath: 'test/site',
				content: 'test',
			},
		]);
		const config = new Config();
		const eleventy = new Eleventy(config);
		await eleventy.toJSON();
		expect(Elev.prototype.toJSON).toHaveBeenCalled();
	});
});
