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

	beforeEach(() => {
		(axios.get as jest.Mock).mockClear();
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

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
		(axios.get as jest.Mock).mockResolvedValueOnce({data: JSON.parse(githubData)});
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

	it('get contributors API call fails when author/repo is not valid', async () => {
		(axios.get as jest.Mock).mockRejectedValueOnce({
			response: {
				status: 404,
			},
		});
		const jsonConfig = {
			...defaultConfig,
			github: {
				repo: 'demo',
				author: 'demo',
			},
		};
		fs.writeFileSync('test/data/github-config.json', JSON.stringify(jsonConfig, null, 2));
		const config = new Config('./test/data/github-config.json');
		const github = new GithubPlugin(config);
		try {
			await github.getContributors();
		} catch (error: any) {
			expect(error.message).toBe('Repository demo/demo not found.');
		}
	});

	it('get contributors API call fails', async () => {
		(axios.get as jest.Mock).mockRejectedValueOnce(new Error('error'));
		const jsonConfig = {
			...defaultConfig,
			github: {
				repo: 'demo',
				author: 'demo',
			},
		};
		fs.writeFileSync('test/data/github-config.json', JSON.stringify(jsonConfig, null, 2));
		const config = new Config('./test/data/github-config.json');
		const github = new GithubPlugin(config);
		try {
			await github.getContributors();
		} catch (error: any) {
			expect(error.message).toBe('error');
		}
	});

	it('get releases', async () => {
		const githubData = fs.readFileSync('test/mock/github-releases.json', 'utf8');
		const parseGithubData = JSON.parse(githubData);
		(axios.get as jest.Mock).mockResolvedValueOnce({data: parseGithubData});
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

	it('get releases API call fails when author/repo is not valid', async () => {
		(axios.get as jest.Mock).mockRejectedValueOnce({
			response: {
				status: 404,
			},
		});
		const jsonConfig = {
			...defaultConfig,
			github: {
				repo: 'test',
				author: 'test',
			},
		};
		fs.writeFileSync('test/data/github-config.json', JSON.stringify(jsonConfig, null, 2));
		const config = new Config('./test/data/github-config.json');
		const github = new GithubPlugin(config);

		try {
			await github.getReleases();
		} catch (error: any) {
			expect(error.message).toBe('Repository test/test not found.');
		}
	});

	it('get releases API call fails', async () => {
		(axios.get as jest.Mock).mockRejectedValueOnce(new Error('error'));
		const jsonConfig = {
			...defaultConfig,
			github: {
				repo: 'test',
				author: 'test',
			},
		};
		fs.writeFileSync('test/data/github-config.json', JSON.stringify(jsonConfig, null, 2));
		const config = new Config('./test/data/github-config.json');
		const github = new GithubPlugin(config);

		try {
			await github.getReleases();
		} catch (error: any) {
			expect(error.message).toBe('error');
		}
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
