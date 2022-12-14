import * as fs from 'fs-extra';
import {Config} from '../src/config.js';

describe('Config', () => {
	const configJson: Record<string, string> = {
		originPath: '_site',
		outputPath: '_dist',
		algoliaAppId: 'test',
		algoliaKey: 'test',
		algoliaIndexName: 'test',
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

	it('Config - config path found', async () => {
		const configData = {...configJson};
		delete configData.originPath;
		await fs.writeFile('./test/data/config.json', JSON.stringify(configData));
		const config = new Config('./test/data/config.json');
		expect(config.originPath).toBe('site');
		expect(config.outputPath).toBe('_dist');
		expect(config.algolia?.algoliaKey).toBe('test');
	});

	it('Config - default values with config path', async () => {
		const configData = {...configJson};
		delete configData.outputPath;
		await fs.writeFile('./test/data/config.json', JSON.stringify(configData));
		const config = new Config('./test/data/config.json');
		expect(config.outputPath).toBe('dist');
	});
});
