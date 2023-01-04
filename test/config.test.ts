import * as fs from 'fs-extra';
import {Config} from '../src/config.js';

describe('Config', () => {
	const configJson: Record<string, string> = {
		originPath: '_site',
		outputPath: '_dist',
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

	it('Config - throws an error if the config file is invalid', () => {
		const config = new Config();
		const invalidConfig = {invalid: 'config'};
		fs.writeFileSync('./test/data/config.json', JSON.stringify(invalidConfig));
		expect(() => {
			config.loadConfig('./test/data/config.json');
		}).toThrow();
	});

	it('Config - does not throw an error if the config file is valid', () => {
		const config = new Config();
		const validConfig = {originPath: 'site'};
		fs.writeFileSync('./test/data/config.json', JSON.stringify(validConfig));
		expect(() => {
			config.loadConfig('./test/data/config.json');
		}).not.toThrow();
	});

	it('Config - loadConfig throws an error if the property value is not allowed', () => {
		const config = new Config();
		const invalidConfig = {searchEngine: 'google'};
		fs.writeFileSync('./test/data/config.json', JSON.stringify(invalidConfig));
		expect(() => {
			config.loadConfig('./test/data/config.json');
		}).toThrow();
	});

	it('Config - adds a plugin configuration to the pluginConfig property', () => {
		const config = new Config();
		const pluginName = 'github';
		const pluginConfig = {
			author: 'jaredwray',
			repo: 'docula',
		};
		config.loadPlugins(pluginName, pluginConfig);
		expect(config.pluginConfig.github).toEqual(pluginConfig);
	});

	it('Config - load all of the plugins specified in the config file', () => {
		const pluginConfig = {
			author: 'jaredwray',
			repo: 'docula',
		};
		const configData = {
			plugins: ['github'],
			github: pluginConfig,
		};
		fs.writeFileSync('./test/data/config.json', JSON.stringify(configData));
		const config = new Config('./test/data/config.json');
		expect(config.pluginConfig.github).toEqual(pluginConfig);
	});
});
