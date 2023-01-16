import fs from 'fs-extra';
import axios from 'axios';
import {GithubPlugin} from '../../src/plugins/github.js';
import {Config} from '../../src/config.js';

jest.mock('axios');

describe('Github Plugin', () => {
	const defaultConfig = {
		originPath: 'test/site',
		plugins: ['github'],
	};

	afterAll(() => {
		fs.rmSync('./test/data/github-config.json', {force: true});
	});

	it('init', () => {
		const jsonConfig = {
			...defaultConfig,
			github: {
				repo: 'docula',
				author: 'jaredwray',
			},
		};
		fs.writeFileSync('test/data/github-config.json', JSON.stringify(jsonConfig, null, 2));
		const config = new Config('./test/data/github-config.json');
		const github = new GithubPlugin(config);
		expect(github).toBeDefined();
	});

	it('passing in all config', () => {
		const jsonConfig = {
			...defaultConfig,
			github: {
				repo: 'docula',
				author: 'jaredwray',
			},
		};
		fs.writeFileSync('test/data/github-config.json', JSON.stringify(jsonConfig, null, 2));
		const config = new Config('./test/data/github-config.json');
		const github = new GithubPlugin(config);
		expect(github).toBeDefined();
	});

	it('repo option does not exist', () => {
		const jsonConfig = {
			...defaultConfig,
			github: {
				author: 'jaredwray',
			},
		};
		expect(() => {
			fs.writeFileSync('test/data/github-config.json', JSON.stringify(jsonConfig, null, 2));
			const config = new Config('./test/data/github-config.json');
			const github = new GithubPlugin(config);
		}).toThrow();
	});

	it('author option does not exist', () => {
		const jsonConfig = {
			...defaultConfig,
			github: {
				repo: 'docula',
			},
		};
		expect(() => {
			fs.writeFileSync('test/data/github-config.json', JSON.stringify(jsonConfig, null, 2));
			const config = new Config('./test/data/github-config.json');
			const github = new GithubPlugin(config);
		}).toThrow();
	});

	it('get contributors', async () => {
		const githubData = fs.readFileSync('test/mock/github-contributors.json', 'utf8');
		const parseGithubData = JSON.parse(githubData);
		(axios.get as jest.Mock).mockResolvedValue({data: JSON.parse(githubData)});
		const jsonConfig = {
			...defaultConfig,
			github: {
				repo: 'docula',
				author: 'jaredwray',
			},
		};
		fs.writeFileSync('test/data/github-config.json', JSON.stringify(jsonConfig, null, 2));
		const config = new Config('./test/data/github-config.json');
		const github = new GithubPlugin(config);
		const result = await github.getContributors();

		expect(axios.get).toHaveBeenCalledWith('https://api.github.com/repos/jaredwray/docula/contributors');
		expect(result).toEqual(parseGithubData);
	});

	it('get releases', async () => {
		const githubData = fs.readFileSync('test/mock/github-releases.json', 'utf8');
		const parseGithubData = JSON.parse(githubData);
		(axios.get as jest.Mock).mockResolvedValue({data: parseGithubData});
		const jsonConfig = {
			...defaultConfig,
			github: {
				repo: 'writr',
				author: 'jaredwray',
			},
		};
		fs.writeFileSync('test/data/github-config.json', JSON.stringify(jsonConfig, null, 2));
		const config = new Config('./test/data/github-config.json');
		const github = new GithubPlugin(config);
		const result = await github.getReleases();

		expect(axios.get).toHaveBeenCalledWith('https://api.github.com/repos/jaredwray/writr/releases');
		expect(result).toEqual(parseGithubData);
	});

	it('execute and write out the github file', async () => {
		(axios.get as jest.Mock).mockResolvedValue({data: {}});

		const jsonConfig = {
			...defaultConfig,
			github: {
				repo: 'docula',
				author: 'jaredwray',
			},
		};
		fs.writeFileSync('test/data/github-config.json', JSON.stringify(jsonConfig, null, 2));
		const config = new Config('./test/data/github-config.json');
		const github = new GithubPlugin(config);
		await github.execute();

		const filePath = 'test/site/_data/github.json';
		expect(fs.existsSync(filePath)).toBe(true);
		fs.rmSync('test/site/_data/github.json');
	});
});
