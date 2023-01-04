import fs from 'fs-extra';
import {GithubPlugin} from '../../src/plugins/github.js';
import {Config} from '../../src/config.js';

describe('Github Plugin', () => {
	let config;
	const defaultConfig = {
		originPath: 'test/site',
		plugins: ['github'],
	};

	afterEach(() => {
		config = null;
	});

	it('init', () => {
		const jsonConfig = {
			...defaultConfig,
			github: {
				repo: 'docula',
				author: 'jaredwray',
			},
		};
		fs.writeFileSync('test/config.json', JSON.stringify(jsonConfig, null, 2));
		const config = new Config('./test/config.json');
		const github = new GithubPlugin(config);
		expect(github).toBeDefined();
	});

	it('passing in all options', () => {
		const jsonConfig = {
			...defaultConfig,
			github: {
				repo: 'docula',
				author: 'jaredwray',
				api: 'https://api.github.com',
				outputFile: 'github.json',
			},
		};
		fs.writeFileSync('test/config.json', JSON.stringify(jsonConfig, null, 2));
		const config = new Config('./test/config.json');
		const github = new GithubPlugin(config);
		expect(github).toBeDefined();
	});

	it('repo option does not exist', () => {
		const jsonConfig = {
			...defaultConfig,
			github: {
				author: 'jaredwray',
				api: 'https://api.github.com',
				outputFile: 'github.json',
			},
		};
		expect(() => {
			fs.writeFileSync('test/config.json', JSON.stringify(jsonConfig, null, 2));
			const config = new Config('./test/config.json');
			const github = new GithubPlugin(config);
		}).toThrow();
	});

	it('execute and write out the github file', async () => {
		const jsonConfig = {
			...defaultConfig,
			github: {
				repo: 'docula',
				author: 'jaredwray',
				api: 'https://api.github.com',
				outputFile: 'github.json',
			},
		};
		fs.writeFileSync('test/config.json', JSON.stringify(jsonConfig, null, 2));
		const config = new Config('./test/config.json');
		const github = new GithubPlugin(config);
		await github.execute();
		const filePath = 'test/site/_data/github.json';
		expect(fs.existsSync(filePath)).toBe(true);
		fs.rmSync('test/site/_data/github.json');
	});

	it('author option does not exist', () => {
		const jsonConfig = {
			...defaultConfig,
			github: {
				repo: 'docula',
				api: 'https://api.github.com',
				outputFile: 'github.json',
			},
		};
		expect(() => {
			fs.writeFileSync('test/config.json', JSON.stringify(jsonConfig, null, 2));
			const config = new Config('./test/config.json');
			const github = new GithubPlugin(config);
		}).toThrow();
	});

	it('get contributors', async () => {
		const jsonConfig = {
			...defaultConfig,
			github: {
				repo: 'docula',
				author: 'jaredwray',
			},
		};
		fs.writeFileSync('test/config.json', JSON.stringify(jsonConfig, null, 2));
		const config = new Config('./test/config.json');
		const github = new GithubPlugin(config);
		const result = await github.getContributors();

		expect(result).toBeDefined();
	});

	it('get releases', async () => {
		const jsonConfig = {
			...defaultConfig,
			github: {
				repo: 'writr',
				author: 'jaredwray',
			},
		};
		fs.writeFileSync('test/config.json', JSON.stringify(jsonConfig, null, 2));
		const config = new Config('./test/config.json');
		const github = new GithubPlugin(config);
		const result = await github.getReleases();

		expect(result.length).toBeGreaterThan(2);
	});
});
