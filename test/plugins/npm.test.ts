import fs from 'fs-extra';
import axios from 'axios';
import {NpmPlugin} from '../../src/plugins/npm.js';
import {Config} from '../../src/config.js';

jest.mock('axios');

describe('NPM Plugin', () => {
	const defaultConfig = {
		originPath: 'test/site',
		plugins: ['npm'],
	};

	beforeEach(() => {
		(axios.get as jest.Mock).mockClear();
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	afterAll(() => {
		fs.rmSync('./test/data/npm-config.json', {force: true});
	});

	it('setting the module name in config', () => {
		const jsonConfig = {
			...defaultConfig,
			npm: {
				moduleName: 'docula',
			},
		};

		fs.writeFileSync('test/data/npm-config.json', JSON.stringify(jsonConfig, null, 2));
		const config = new Config('./test/data/npm-config.json');
		const npm = new NpmPlugin(config);
		expect(npm.options.moduleName).toEqual('docula');
	});

	it('getting the sitePath from the originPath prop in config', () => {
		const jsonConfig = {
			...defaultConfig,
			npm: {
				moduleName: 'docula',
			},
		};

		fs.writeFileSync('test/data/npm-config.json', JSON.stringify(jsonConfig, null, 2));
		const config = new Config('./test/data/npm-config.json');
		const npm = new NpmPlugin(config);
		expect(npm.options.sitePath).toEqual('test/site');
	});

	it('getting the default data path', () => {
		const jsonConfig = {
			...defaultConfig,
			npm: {
				moduleName: 'docula',
			},
		};
		fs.writeFileSync('test/data/npm-config.json', JSON.stringify(jsonConfig, null, 2));
		const config = new Config('./test/data/npm-config.json');
		const npm = new NpmPlugin(config);
		expect(npm.options.dataPath).toEqual('_data');
	});

	it('throw an error if no npm in config', () => {
		const jsonConfig = {};
		expect(() => {
			fs.writeFileSync('test/data/npm-config.json', JSON.stringify(jsonConfig, null, 2));
			const config = new Config('./test/data/npm-config.json');
			const npm = new NpmPlugin(config);
		}).toThrow();
	});

	it('throw an error if no module name', () => {
		const jsonConfig = {
			...defaultConfig,
			npm: {},
		};
		expect(() => {
			fs.writeFileSync('test/data/npm-config.json', JSON.stringify(jsonConfig, null, 2));
			const config = new Config('./test/data/npm-config.json');
			const npm = new NpmPlugin(config);
		}).toThrow();
	});

	it('get monthly downloads should return downloads', async () => {
		const npmData = fs.readFileSync('test/mock/npm-downloads.json', 'utf8');
		const parsedNpmData = JSON.parse(npmData);
		(axios.get as jest.Mock).mockResolvedValueOnce({data: parsedNpmData});
		const jsonConfig = {
			...defaultConfig,
			npm: {
				moduleName: 'docula',
			},
		};
		fs.writeFileSync('test/data/npm-config.json', JSON.stringify(jsonConfig, null, 2));
		const config = new Config('./test/data/npm-config.json');
		const npm = new NpmPlugin(config);
		const result = await npm.getMonthlyDownloads();

		expect(axios.get).toHaveBeenCalledWith('https://api.npmjs.org/downloads/point/last-month/docula');
		expect(result).toEqual(parsedNpmData);
	});

	it('execute and write out file', async () => {
		(axios.get as jest.Mock).mockResolvedValue({data: {}});
		const jsonConfig = {
			...defaultConfig,
			npm: {
				moduleName: 'docula',
			},
		};
		fs.writeFileSync('test/data/npm-config.json', JSON.stringify(jsonConfig, null, 2));
		const config = new Config('./test/data/npm-config.json');
		const npm = new NpmPlugin(config);
		await npm.execute();
		expect(fs.existsSync('test/site/_data/npm.json')).toBe(true);
		fs.rmSync('test/site/_data/npm.json');
	});
});
