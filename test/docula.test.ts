import * as fs from 'fs-extra';
import {Docula} from '../src/docula.js';
import {type DoculaOptions} from '../src/docula-options.js';

describe('Docula', () => {
	it('Docula - init', () => {
		const docula = new Docula();
		expect(docula).toBeDefined();
	});

	it('Docula - default originPath to site', () => {
		const docula = new Docula();
		expect(docula.config.originPath).toBe('site');
	});

	it('Docula - default outputPath to dist', () => {
		const docula = new Docula();
		expect(docula.config.outputPath).toBe('dist');
	});

	it('Docula - init with options <config>', () => {
		const options = {opts: () => ({originPath: 'site'})};
		const docula = new Docula(options);
		expect(docula.config.originPath).toBe('site');
	});

	/* It('Docula - testing init function with folders', () => {
		const options: DoculaOptions = {sitePath: 'test/site1'};
		const docula = new Docula(options);
		expect(docula.sitePath).toBe('test/site1');
		docula.init();
		expect(fs.existsSync('test/site1')).toBe(true);

		// Clean up
		fs.removeSync('test/site1');
	}); */
});
