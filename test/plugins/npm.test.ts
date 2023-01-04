import fs from 'fs-extra';
import {NpmPlugin} from '../../src/plugins/npm.js';
import {Config} from '../../src/config.js';

describe('NPM Plugin', () => {
	let config;
	const defaultConfig = {
		originPath: 'test/site',
		plugins: ['npm'],
	};

	afterEach(() => {
		config = null;
	});

	it('setting the module name in options', () => {
		const jsonConfig = {
			...defaultConfig,
			npm: {
				moduleName: 'writr',
			},
		};

		fs.writeFileSync('test/config.json', JSON.stringify(jsonConfig, null, 2));
		const config = new Config('./test/config.json');
		const npm = new NpmPlugin(config);
		expect(npm.options.moduleName).toEqual('writr');
	});

	it('setting the site path in options', () => {
		const jsonConfig = {
			...defaultConfig,
			npm: {
				moduleName: 'docula',
			},
		};

		fs.writeFileSync('test/config.json', JSON.stringify(jsonConfig, null, 2));
		const config = new Config('./test/config.json');
		const npm = new NpmPlugin(config);
		expect(npm.options.sitePath).toEqual('test/site');
	});

	it('setting the data path in options', () => {
		const jsonConfig = {
			...defaultConfig,
			npm: {
				moduleName: 'docula',
			},
		};
		fs.writeFileSync('test/config.json', JSON.stringify(jsonConfig, null, 2));
		const config = new Config('./test/config.json');
		const npm = new NpmPlugin(config);
		expect(npm.options.dataPath).toEqual('_data');
	});

	it('setting the output file in options', () => {
		const jsonConfig = {
			...defaultConfig,
			npm: {
				moduleName: 'docula',
				outputFile: 'npm.json',
			},
		};
		fs.writeFileSync('test/config.json', JSON.stringify(jsonConfig, null, 2));
		const config = new Config('./test/config.json');
		const npm = new NpmPlugin(config);
		expect(npm.options.outputFile).toEqual('npm.json');
	});

	it('throw an error if no npm in options', () => {
		const jsonConfig = {};
		expect(() => {
			fs.writeFileSync('test/config.json', JSON.stringify(jsonConfig, null, 2));
			const config = new Config('./test/config.json');
			const npm = new NpmPlugin(config);
		}).toThrow();
	});

	it('throw an error if no module name', () => {
		const jsonConfig = {
			...defaultConfig,
			npm: {},
		};
		expect(() => {
			fs.writeFileSync('test/config.json', JSON.stringify(jsonConfig, null, 2));
			const config = new Config('./test/config.json');
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
		fs.writeFileSync('test/config.json', JSON.stringify(jsonConfig, null, 2));
		const config = new Config('./test/config.json');
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
		fs.writeFileSync('test/config.json', JSON.stringify(jsonConfig, null, 2));
		const config = new Config('./test/config.json');
		const npm = new NpmPlugin(config);
		await npm.execute();
		expect(fs.existsSync('test/site/_data/npm.json')).toBe(true);
		fs.rmSync('test/site/_data/npm.json');
	});
});
