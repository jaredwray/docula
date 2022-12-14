import fs from 'fs-extra';
import {type DoculaOptions} from '../../src/docula-options.js';
import {GithubPlugin} from '../../src/plugins/github.js';

describe('Github Plugin', () => {
	it('init', () => {
		const options: DoculaOptions = {
			github: {
				repo: 'docula',
				author: 'jaredwray',
			},
		};
		const github = new GithubPlugin(options);
		expect(github).toBeDefined();
	});

	it('passing in all options', () => {
		const options: DoculaOptions = {
			github: {
				repo: 'docula',
				author: 'jaredwray',
				api: 'https://api.github.com',
				outputFile: 'github.json',
			},
		};
		const github = new GithubPlugin(options);
		expect(github).toBeDefined();
	});

	it('repo option does not exist', () => {
		const options: DoculaOptions = {
			github: {
				author: 'jaredwray',
				api: 'https://api.github.com',
				outputFile: 'github.json',
			},
		};
		expect(() => {
			const gh = new GithubPlugin(options);
		}).toThrow();
	});

	it('execute and write out the github file', async () => {
		const options: DoculaOptions = {
			sitePath: 'test',
			dataPath: 'data',
			github: {
				repo: 'docula',
				author: 'jaredwray',
				api: 'https://api.github.com',
				outputFile: 'github.json',
			},
		};
		const github = new GithubPlugin(options);
		await github.execute();
		const filePath = 'test/data/github.json';
		expect(fs.existsSync(filePath)).toBe(true);
		await fs.remove('test/data');
	});

	it('author option does not exist', () => {
		const options: DoculaOptions = {
			github: {
				repo: 'docula',
				api: 'https://api.github.com',
				outputFile: 'github.json',
			},
		};
		expect(() => {
			const gh = new GithubPlugin(options);
		}).toThrow();
	});

	it('get contributors', async () => {
		const options: DoculaOptions = {
			github: {
				repo: 'docula',
				author: 'jaredwray',
			},
		};
		const github = new GithubPlugin(options);
		const result = await github.getContributors();

		expect(result).toBeDefined();
	});

	it('get releases', async () => {
		const options: DoculaOptions = {
			github: {
				repo: 'writr',
				author: 'jaredwray',
			},
		};
		const github = new GithubPlugin(options);
		const result = await github.getReleases();

		expect(result.length).toBeGreaterThan(2);
	});
});
