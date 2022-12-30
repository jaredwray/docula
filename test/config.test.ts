import * as fs from 'fs-extra';
import {Config} from '../src/config.js';

describe('Config', () => {
	const configJson: Record<string, any> = {
		originPath: '_site',
		outputPath: '_dist',
		algolia: {
			apiKey: 'test',
			appId: 'test',
			indexName: 'test',
		},
	};

	afterEach(() => {
		fs.rmSync('./test/data/config.json', {force: true});
	});

	it('Config - Init', () => {
		const config = new Config();
		expect(config).toBeDefined();
	});

	it('Config - default originPath to site', () => {
		const config = new Config();
		expect(config.originPath).toBe('site');
	});

	it('Config - default config without path', () => {
		const config = new Config();
		expect(config.outputPath).toBe('dist');
	});

	it('Config - config path not found', async () => {
		const config = () => new Config('test/config.json');
		expect(config).toThrow(new Error('Config file not found'));
	});

	it('Config - config path found', () => {
		const configData = {...configJson};
		configData.plugins = ['algolia'];
		delete configData.originPath;
		fs.writeFileSync('./test/data/config.json', JSON.stringify(configData));
		const config = new Config('./test/data/config.json');
		expect(config.originPath).toBe('site');
		expect(config.outputPath).toBe('_dist');
	});

	it('Config - default values with config path', () => {
		const configData = {...configJson};
		delete configData.outputPath;
		fs.writeFileSync('./test/data/config.json', JSON.stringify(configData));
		const config = new Config('./test/data/config.json');
		expect(config.outputPath).toBe('dist');
	});

	test('Config - throws an error if the config file is invalid', () => {
		const config = new Config();
		const invalidConfig = {invalid: 'config'};
		fs.writeFileSync('./test/data/config.json', JSON.stringify(invalidConfig));
		expect(() => {
			config.loadConfig('./test/data/config.json');
		}).toThrow();
	});

	test('Config - does not throw an error if the config file is valid', () => {
		const config = new Config();
		const validConfig = {originPath: 'site'};
		fs.writeFileSync('./test/data/config.json', JSON.stringify(validConfig));
		expect(() => {
			config.loadConfig('./test/data/config.json');
		}).not.toThrow();
	});

	test('Config - loadConfig throws an error if the property value is not allowed', () => {
		const config = new Config();
		const invalidConfig = {searchEngine: 'google'};
		fs.writeFileSync('./test/data/config.json', JSON.stringify(invalidConfig));
		expect(() => {
			config.loadConfig('./test/data/config.json');
		}).toThrow();
	});
});
