import process from 'node:process';
import {
	afterEach, beforeEach, describe, expect, it, vi,
} from 'vitest';
import axios from 'axios';
import dotenv from 'dotenv';
import {Github, type GithubOptions} from '../src/github.js';
import githubMockContributors from './fixtures/data-mocks/github-contributors.json';
import githubMockReleases from './fixtures/data-mocks/github-releases.json';

const defaultOptions: GithubOptions = {
	api: 'https://api.github.com',
	author: 'jaredwray',
	repo: 'docula',
};

vi.mock('axios');

describe('Github', () => {
	afterEach(() => {
		// Reset the mock after each test
		vi.resetAllMocks();
	});
	beforeEach(() => {
		(axios.get as any).mockImplementation(async (url: string) => {
			if (url.endsWith('releases')) {
				return {data: githubMockReleases};
			}

			if (url.endsWith('contributors')) {
				return {data: githubMockContributors};
			}

			// Default response or throw an error if you prefer
			return {data: {}};
		});
	});

	it('should be able to initialize', () => {
		const github = new Github(defaultOptions);
		expect(github).toBeDefined();
	});
	it('should be able to have default options', () => {
		const newOptions: GithubOptions = {
			api: undefined,
			author: 'jaredwray1',
			repo: 'docula1',
		};
		const github = new Github(newOptions);
		expect(github.options.api).toEqual(defaultOptions.api);
		expect(github.options.author).toEqual(newOptions.author);
		expect(github.options.repo).toEqual(newOptions.repo);
	});
	it('should be able to get the contributors', async () => {
		const github = new Github(defaultOptions);
		// @ts-expect-error - mock

		axios.get.mockResolvedValue({data: githubMockContributors});

		const result = await github.getContributors();
		expect(result).toBeDefined();
	});
	it('should be throw an error on 404', async () => {
		const github = new Github(defaultOptions);
		const errorResponse = {
			response: {
				status: 404,
				data: 'Not Found',
			},
		};
		// @ts-expect-error - mock

		axios.get.mockRejectedValue(errorResponse);

		await expect(github.getContributors()).rejects.toThrow(`Repository ${defaultOptions.author}/${defaultOptions.repo} not found.`);
	});
	it('should be throw an error', async () => {
		const github = new Github(defaultOptions);
		const errorResponse = {
			response: {
				status: 500,
				data: 'Server Error',
			},
		};
		// @ts-expect-error - mock

		axios.get.mockRejectedValue(errorResponse);

		await expect(github.getContributors()).rejects.toThrow();
	});
	it('should be able to get the releases', async () => {
		const github = new Github(defaultOptions);
		// @ts-expect-error - mock

		axios.get.mockResolvedValue({data: githubMockReleases});

		const result = await github.getReleases();

		expect(result).toBeDefined();
	});
	it('should be throw an error on 404', async () => {
		const github = new Github(defaultOptions);
		const errorResponse = {
			response: {
				status: 404,
				data: 'Not Found',
			},
		};
		// @ts-expect-error - mock

		axios.get.mockRejectedValue(errorResponse);

		await expect(github.getReleases()).rejects.toThrow(`Repository ${defaultOptions.author}/${defaultOptions.repo} not found.`);
	});
	it('should be throw an error', async () => {
		const github = new Github(defaultOptions);
		const errorResponse = {
			response: {
				status: 500,
				data: 'Server Error',
			},
		};
		// @ts-expect-error - mock

		axios.get.mockRejectedValue(errorResponse);

		await expect(github.getReleases()).rejects.toThrow();
	});
	it('should be able to get the data', async () => {
		const github = new Github(defaultOptions);
		const githubReleases = vi.spyOn(github, 'getReleases').mockResolvedValue(githubMockReleases);
		const githubContributors = vi.spyOn(github, 'getContributors').mockResolvedValue(githubMockContributors);

		const result = await github.getData();
		expect(result).toBeDefined();
		githubReleases.mockRestore();
		githubContributors.mockRestore();
	});
});

describe('docula with github token', () => {
	it('should generate the site init files and folders with github token', async () => {
		// Load environment variables from .env file
		dotenv.config({quiet: true});
		if (process.env.GITHUB_TOKEN) {
			console.info('GITHUB_TOKEN is set, running test with token');
			const github = new Github(defaultOptions);
			const result = await github.getData();
			expect(result).toBeDefined();
		} else {
			console.warn('Skipping test: GITHUB_TOKEN is not set');
		}
	});
});
