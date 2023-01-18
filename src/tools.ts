import inquirer from 'inquirer';
import logger from './logger.js';

export const reportError = (error: unknown): void => {
	let message = String(error);
	if (error instanceof Error) {
		message = error.message;
	}

	logger.error(message);
};

const urlRegex = /^(http(s)?:\/\/.)[-\w@:%.+~#=]{2,256}\.[a-z]{2,6}\b([-\w@:%+.~#?&/=]*)$/g;

const getGithubInfo = async (): Promise<Record<string, string>> => {
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

export const getSiteUrl = async (): Promise<Record<string, string>> => {
	const siteAnswer = await inquirer.prompt([
		{
			type: 'input',
			name: 'url',
			message: 'What is the URL of your site?',
			validate(value: string) {
				if (value.length > 0 && urlRegex.test(value)) {
					return true;
				}

				return 'Please enter a complete URL.';
			},
		},
	]);
	return siteAnswer.url;
};

export const getUserPlugins = async (): Promise<Record<string, unknown>> => {
	const pluginsAnswer = await inquirer.prompt([
		{
			type: 'checkbox',
			name: 'plugins',
			message: 'Select the plugins you want to use',
			choices: [{name: 'github'}, {name: 'robots.txt'}, {name: 'sitemap.xml'}],
		},
	]);

	if (pluginsAnswer.plugins.length > 0) {
		let githubInfo: Record<string, string> | undefined;
		// eslint-disable-next-line @typescript-eslint/no-unsafe-call
		const parsedPlugins: string[] = pluginsAnswer.plugins.map((plugin: string) => {
			if (plugin === 'robots.txt') {
				return 'robots';
			}

			if (plugin === 'sitemap.xml') {
				return 'sitemap';
			}

			return plugin;
		});
		if (parsedPlugins.includes('github')) {
			githubInfo = await getGithubInfo();
		}

		return {
			plugins: [...parsedPlugins, 'pagefind'],
			github: githubInfo,
		};
	}

	return {
		plugins: ['pagefind'],
	};
};

