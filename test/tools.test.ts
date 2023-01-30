import inquirer from 'inquirer';
import {getGithubInfo, getSiteUrl, getUserPlugins, parsePlugins, parsePluginsData, validateUrl} from '../src/tools/inquirer-prompt.js';

jest.mock('inquirer');
describe('Tools', () => {
	describe('validateUrl', () => {
		it('returns true if the URL is valid', () => {
			const url = 'https://www.example.com';
			const result = validateUrl(url);
			expect(result).toBeTruthy();
		});
		it('returns an error message if the URL is invalid', () => {
			const url = 'example';
			const result = validateUrl(url);
			expect(result).toBe('Please enter a complete URL.');
		});
	});

	it('getGithubInfo returns user github info', async () => {
		const githubInfo: Record<string, string> = {
			author: 'jaredwray',
			repo: 'docula',
		};
		// @ts-expect-error - Mocking the inquirer.prompt method
		(inquirer.prompt as jest.Mock).mockResolvedValue(Promise.resolve(githubInfo));
		const result = await getGithubInfo();
		expect(result).toEqual(githubInfo);
	});

	it('getSiteUrl returns a valid URL', async () => {
		const url = 'https://www.example.com';
		// @ts-expect-error - Mocking the inquirer.prompt method
		(inquirer.prompt as jest.Mock).mockResolvedValue(Promise.resolve({
			url,
		}));
		const result = await getSiteUrl();
		expect(result).toBe(url);
	});

	it('getUserPlugins returns the user plugins', async () => {
		const plugins: string[] = ['robots.txt'];
		// @ts-expect-error - Mocking the inquirer.prompt method
		(inquirer.prompt as jest.Mock).mockResolvedValue(Promise.resolve(plugins));
		const result = await getUserPlugins();
		expect(result).toEqual(plugins);
	});

	describe('parsePlugins', () => {
		it('does not throw an error if the array is empty', async () => {
			const plugins: string[] = [];
			const result = parsePlugins(plugins);
			expect(result).toEqual([]);
		});

		it('returns the plugins parsed', () => {
			const plugins: string[] = ['robots.txt', 'sitemap.xml'];
			const result = parsePlugins(plugins);
			expect(result).toEqual(['robots', 'sitemap']);
		});

		it('returns the same plugin', () => {
			const plugins: string[] = ['pagefind'];
			const result = parsePlugins(plugins);
			expect(result).toEqual(['pagefind']);
		});
	});

	describe('parsePluginsData', () => {
		it('returns pagefind and plugins', async () => {
			const plugins: string[] = ['robots.txt', 'sitemap.xml'];
			const data = await parsePluginsData(plugins);
			expect(data).toEqual({
				plugins: ['robots', 'sitemap', 'pagefind'],
			});
		});

		it('returns plugins and github data', async () => {
			const plugins: string[] = ['robots.txt', 'github'];
			const githubInfo: Record<string, string> = {
				author: 'jaredwray',
				repo: 'docula',
			};
			// @ts-expect-error - Mocking the inquirer.prompt method
			(inquirer.prompt as jest.Mock).mockResolvedValue(Promise.resolve(githubInfo));
			await getGithubInfo();
			const data = await parsePluginsData(plugins);
			expect(data).toEqual({
				plugins: ['robots', 'github', 'pagefind'],
				github: githubInfo,
			});
		});
	});
});
