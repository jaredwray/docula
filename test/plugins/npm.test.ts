import fs from 'fs-extra';
import {type DoculaOptions} from '../../src/docula-options.js';
import {NpmPlugin} from '../../src/plugins/npm.js';

describe('NPM Plugin', () => {
	it('setting the module name in options', () => {
		const options: DoculaOptions = {
			npm: {
				moduleName: 'writr',
			},
		};
		const npm = new NpmPlugin(options);
		expect(npm.moduleName).toEqual('writr');
	});

	it('setting the site path in options', () => {
		const options: DoculaOptions = {
			sitePath: 'test/data/site',
			npm: {
				moduleName: 'docula',
			},
		};
		const npm = new NpmPlugin(options);
		expect(npm.sitePath).toEqual('test/data/site');
	});

	it('setting the data path in options', () => {
		const options: DoculaOptions = {
			sitePath: 'test/data/site',
			dataPath: '_data',
			npm: {
				moduleName: 'docula',
			},
		};
		const npm = new NpmPlugin(options);
		expect(npm.dataPath).toEqual('_data');
	});

	it('setting the output file in options', () => {
		const options: DoculaOptions = {
			sitePath: 'test/data/site',
			dataPath: '_data',
			npm: {
				moduleName: 'docula',
				outputFile: 'file1.json',
			},
		};
		const npm = new NpmPlugin(options);
		expect(npm.outputFile).toEqual('file1.json');
	});

	it('throw an error if no npm in options', () => {
		const options: DoculaOptions = {};
		expect(() => {
			const npm = new NpmPlugin(options);
		}).toThrow();
	});

	it('throw an error if no module name', () => {
		const options: DoculaOptions = {
			npm: {},
		};
		expect(() => {
			const npm = new NpmPlugin(options);
		}).toThrow();
	});

	it('get monthly downloads should return downloads', async () => {
		const options: DoculaOptions = {
			sitePath: 'test/data/site',
			dataPath: '_data',
			npm: {
				moduleName: 'writr',
			},
		};
		const npm = new NpmPlugin(options);
		const data = await npm.getMonthlyDownloads();
		expect(data.downloads).toBeDefined();
	});

	it('execute and write out file', async () => {
		const options: DoculaOptions = {
			sitePath: 'test/data/site',
			dataPath: 'data',
			npm: {
				moduleName: 'writr',
			},
		};
		const npm = new NpmPlugin(options);
		await npm.execute();
		expect(fs.existsSync('test/data/site/data/npm.json')).toBe(true);
		fs.rmSync('test/data/site/data/npm.json');
	});
});
