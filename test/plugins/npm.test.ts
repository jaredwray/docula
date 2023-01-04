import fs from 'fs-extra';
import {NpmPlugin} from '../../src/plugins/npm.js';
import {Config} from '../../src/config.js';

describe('NPM Plugin', () => {
	const defaultConfig = {
		originPath: 'test/site',
		plugins: ['npm'],
	};

	afterAll(() => {
		fs.rmSync('./test/data/npm-config.json', {force: true});
	});

	it('setting the module name in config', () => {
		const jsonConfig = {
			...defaultConfig,
			npm: {
				moduleName: 'writr',
			},
		};

		fs.writeFileSync('test/data/npm-config.json', JSON.stringify(jsonConfig, null, 2));
		const config = new Config('./test/data/npm-config.json');
		const npm = new NpmPlugin(config);
		expect(npm.options.moduleName).toEqual('writr');
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
		const jsonConfig = {
			...defaultConfig,
			npm: {
				moduleName: 'writr',
			},
		};
		fs.writeFileSync('test/data/npm-config.json', JSON.stringify(jsonConfig, null, 2));
		const config = new Config('./test/data/npm-config.json');
		const npm = new NpmPlugin(config);
		const data = await npm.getMonthlyDownloads();
		expect(data.downloads).toBeDefined();
	});

	it('execute and write out file', async () => {
		const jsonConfig = {
			...defaultConfig,
			npm: {
				moduleName: 'writr',
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
