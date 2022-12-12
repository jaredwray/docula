import * as fs from 'fs-extra';
import {Docula} from '../src/docula.js';
import {type DoculaOptions} from '../src/docula-options.js';

describe('Docula', () => {
	it('Docula - init', () => {
		const docula = new Docula();
		expect(docula).toBeDefined();
	});

	it('Docula - default outputPath to dist', () => {
		const docula = new Docula();
		expect(docula.outputPath).toBe('dist');
	});

	it('Docula - default sitePath to site', () => {
		const docula = new Docula();
		expect(docula.sitePath).toBe('site');
	});

	it('Docula - init with options <sitePath>', () => {
		const options: DoculaOptions = {outputPath: 'site'};
		const docula = new Docula(options);
		expect(docula.outputPath).toBe('site');
	});

	it('Docula - init with options <outputPath>', () => {
		const options: DoculaOptions = {sitePath: 'test'};
		const docula = new Docula(options);
		expect(docula.sitePath).toBe('test');
	});

	it('Docula - testing init function with folders', () => {
		const options: DoculaOptions = {sitePath: 'test/site1'};
		const docula = new Docula(options);
		expect(docula.sitePath).toBe('test/site1');
		docula.init();
		expect(fs.existsSync('test/site1')).toBe(true);

		// Clean up
		fs.removeSync('test/site1');
	});
});
