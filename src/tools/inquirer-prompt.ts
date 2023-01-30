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

export const parsePlugins = (plugins: string[]): string[] => plugins.map((plugin: string) => {
	if (plugin.endsWith('.txt') || plugin.endsWith('.xml')) {
		return plugin.split('.')[0];
	}

	return plugin;
});

export const getUserPlugins = async (): Promise<string[]> => {
	const userPlugins = await inquirer.prompt([
		{
			type: 'checkbox',
			name: 'plugins',
			message: 'Select the plugins you want to use',
			choices: [{name: 'github'}, {name: 'robots.txt'}, {name: 'sitemap.xml'}],
		},
	]);
	return userPlugins;
};

export const parsePluginsData = async (plugins: string[]): Promise<Record<string, unknown>> => {
	const parsedPlugins = parsePlugins(plugins);
	let githubInfo: Record<string, string> | undefined;
	if (parsedPlugins.includes('github')) {
		githubInfo = await getGithubInfo();
	}

	return {
		plugins: [...parsedPlugins, 'pagefind'],
		...(githubInfo && {github: githubInfo}),
	};
};
