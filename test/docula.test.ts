import * as fs from 'fs-extra';
import {Docula} from '../src/docula.js';
import {Eleventy} from '../src/eleventy.js';
import logger from '../src/logger.js';

jest.mock('../src/eleventy.js');

describe('Docula', () => {
	const configJson: Record<string, any> = {
		originPath: 'test/data/site',
		outputPath: '_dist',
		plugins: ['npm', 'robots'],
		npm: {
			moduleName: 'docula',
		},
		robots: {
			allow: ['/'],
		},
	};

	beforeEach(() => {
		jest.spyOn(Eleventy.prototype, 'build').mockImplementation();
	});

	afterEach(() => {
		fs.rmSync('./test/data/docula-config.json', {force: true});
		jest.clearAllMocks();
	});

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

	it('Docula - init with options config', () => {
		fs.writeFileSync('test/data/docula-config.json', JSON.stringify(configJson, null, 2));
		const options = {opts: () => ({config: './test/data/docula-config.json'})};
		const docula = new Docula(options);
		expect(docula.config.originPath).toBe('test/data/site');
	});

	it('Docula - testing init function with folders', () => {
		fs.writeFileSync('./test/data/docula-config.json', JSON.stringify(configJson));
		const options = {opts: () => ({config: './test/data/docula-config.json'})};
		const docula = new Docula(options);
		expect(docula.config.originPath).toBe('test/data/site');
		docula.init();
		expect(fs.existsSync('test/data/site')).toBe(true);
		fs.rmSync('test/data/site', {force: true, recursive: true});
	});

	it('Docula - should build using Eleventy', async () => {
		fs.writeFileSync('./test/data/docula-config.json', JSON.stringify(configJson));
		const options = {opts: () => ({config: './test/data/docula-config.json'})};
		const docula = new Docula(options);
		await docula.build();
		expect(Eleventy.prototype.build).toHaveBeenCalled();
	});

	it('Docula - should build using Eleventy fails', async () => {
		jest.spyOn(Eleventy.prototype, 'build').mockImplementation(() => {
			throw new Error('Error');
		});
		jest.spyOn(logger, 'error');

		fs.writeFileSync('./test/data/docula-config.json', JSON.stringify(configJson));
		const options = {opts: () => ({config: './test/data/docula-config.json'})};
		const docula = new Docula(options);
		docula.init();
		await docula.build();
		expect(logger.error).toHaveBeenCalledWith('Error');
	});

	it('Docula - should copy a folder to a target location', () => {
		const docula = new Docula();
		docula.copyFolder('test/data/site', 'test/data/site-copy');
		expect(fs.existsSync('test/data/site-copy')).toBe(true);
		fs.rmSync('test/data/site-copy', {force: true, recursive: true});
	});

	it('Docula - should copy a folder to a default target location', () => {
		const docula = new Docula();
		docula.copyFolder('test/data/site');
		expect(fs.existsSync('site/template')).toBe(true);
		fs.rmSync('site/template', {force: true, recursive: true});
	});
});

