import * as fs from 'fs-extra';
import {Docula} from '../src/docula.js';
import {Eleventy} from '../src/eleventy.js';

jest.mock('../src/eleventy.js');

describe('Docula', () => {
	const configJson: Record<string, string> = {
		originPath: 'test/data/site',
		outputPath: '_dist',
		algoliaAppId: 'test',
		algoliaKey: 'test',
		algoliaIndexName: 'test',
	};

	beforeEach(() => {
		jest.spyOn(Eleventy.prototype, 'build').mockImplementation();
	});

	afterEach(() => {
		fs.rmSync('./test/data/config.json', {force: true});
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
		const options = {opts: () => ({originPath: 'site'})};
		const docula = new Docula(options);
		expect(docula.config.originPath).toBe('site');
	});

	it('Docula - testing init function with folders', async () => {
		await fs.writeFile('./test/data/config.json', JSON.stringify(configJson));
		const options = {opts: () => ({config: './test/data/config.json'})};
		const docula = new Docula(options);
		expect(docula.config.originPath).toBe('test/data/site');
		docula.init();
		expect(fs.existsSync('test/data/site')).toBe(true);
		fs.rmSync('test/data/site', {force: true, recursive: true});
	});

	it('Docula - build using Eleventy', async () => {
		await fs.writeFile('./test/data/config.json', JSON.stringify(configJson));
		const options = {opts: () => ({config: './test/data/config.json'})};
		const docula = new Docula(options);
		await docula.build();
		expect(Eleventy.prototype.build).toHaveBeenCalled();
	});

	it('Docula - build using Eleventy fails', async () => {
		const errorLog = jest.spyOn(console, 'error').mockImplementation((message: string) => message);
		jest.spyOn(Eleventy.prototype, 'build').mockImplementation(() => {
			throw new Error('Error');
		});

		await fs.writeFile('./test/data/config.json', JSON.stringify(configJson));
		const options = {opts: () => ({config: './test/data/config.json'})};
		const docula = new Docula(options);
		docula.init();
		await docula.build();
		expect(errorLog).toHaveBeenCalled();
	});
});
