// @ts-expect-error - 11ty doesn't have types
import * as elev from '@11ty/eleventy';

import {Eleventy} from '../src/eleventy.js';
import {Config} from '../src/config.js';

// eslint-disable-next-line @typescript-eslint/naming-convention, @typescript-eslint/no-unsafe-assignment
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
});
