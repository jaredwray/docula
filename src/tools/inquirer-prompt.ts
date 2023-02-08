import inquirer from 'inquirer';
import {urlRegex} from './tools.js';

export const getGithubInfo = async (): Promise<Record<string, string>> => {
	const data = await inquirer.prompt([
		{
			type: 'input',
			name: 'author',
			message: 'What is your GitHub username?',
		}, {
			type: 'input',
			name: 'repo',
			message: 'What is your GitHub repository\'s name?',
		},
	]);
	return data;
};

export const validateUrl = (value: string): boolean | string => {
	if (value.length > 0 && urlRegex.test(value)) {
		return true;
	}

	return 'Please enter a complete URL.';
};

export const getSiteUrl = async (): Promise<Record<string, string>> => {
	const siteAnswer = await inquirer.prompt([
		{
			type: 'input',
			name: 'url',
			message: 'What is the URL of your site?',
			validate: validateUrl,
		},
	]);
	return siteAnswer.url;
};

export const getUserPlugins = async (searchEngine: 'algolia'| 'pagefind'): Promise<string[]> => {
	const userPlugins = await inquirer.prompt([
		{
			type: 'checkbox',
			name: 'plugins',
			message: 'Select the plugins you want to use',
			choices: [
				{
					name: 'github',
					value: 'github',
				}, {
				  name: 'robots.txt',
					value: 'robots',
				}, {
					name: 'sitemap.xml',
					value: 'sitemap',
				}],
		},
	]);
	return [...userPlugins.plugins, searchEngine];
};

export const getSearchEngine = async (): Promise<'algolia'| 'pagefind'> => {
	const searchEngine = await inquirer.prompt([
		{
			type: 'list',
			name: 'engine',
			message: 'Which search engine do you want to use?',
			choices: ['Algolia', 'Pagefind'],
			default: "Pagefind",
			filter(val): any {
				return val.toLowerCase();
			}
		},
	]);
	return searchEngine.engine;
}

export const getAlgoliaInfo = async (): Promise<Record<string, string>> => {
	const algoliaInfo = await inquirer.prompt([
		{
			type: 'password',
			name: 'appId',
			message: 'What is your Algolia application ID?',
		},
		{
			type: 'password',
			name: 'apiKey',
			message: 'What is your Algolia API key?',
		},
		{
			type: 'input',
			name: 'indexName',
			message: 'What is your Algolia index name?',
		}
	])
	return algoliaInfo;
}


export const setPlugins = async (): Promise<Record<string, unknown>> => {
	let githubInfo: Record<string, string> | undefined;
	let algoliaInfo: Record<string, string> | undefined;
	const siteUrl = await getSiteUrl();
	const searchEngine = await getSearchEngine();
	const plugins = await getUserPlugins(searchEngine);

	if (searchEngine === 'algolia') {
		algoliaInfo = await getAlgoliaInfo();
	}

	if (plugins.includes('github')) {
		githubInfo = await getGithubInfo();
	}

	return {
		siteUrl,
		searchEngine,
		plugins,
		...(githubInfo && {github: githubInfo}),
		...(algoliaInfo && {algolia: algoliaInfo}),
	};
}
