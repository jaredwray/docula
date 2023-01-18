import logger from './logger.js';
import inquirer from "inquirer";

export const reportError = (error: unknown): void => {
	let message = String(error);
	if (error instanceof Error) {
		message = error.message;
	}

	logger.error(message);
};

const urlRegex = /^(http(s)?:\/\/.)[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_\+.~#?&//=]*)$/g

const getGithubInfo = async (): Promise<Record<string, string>> => {
	const data = await inquirer.prompt([
		{
			type: 'input',
			name: 'author',
			message: "What is your GitHub username?",
		}, {
			type: 'input',
			name: 'repo',
			message: "What is your GitHub repository's name?",
		}
	]);
	return data;
}

export const getSiteURL = async (): Promise<Record<string, string>> => {
	const siteAnswer = await inquirer.prompt([
		{
			type: 'input',
			name: 'url',
			message: 'What is the URL of your site?',
			validate(value: string) {
				if(value.length && value.match(urlRegex)) {
					return true;
				} else {
					return 'Please enter a complete URL.';
				}
			}
		}
	]);
	return siteAnswer.url;
}


export const getUserPlugins = async (): Promise<any> => {
	const pluginsAnswer = await inquirer.prompt([
		{
			type: 'checkbox',
			name: 'plugins',
			message: 'Select the plugins you want to use',
			choices: [{name: 'github'}, {name: 'robots.txt'}, {name: 'sitemap.xml'}],
		}
	])

	if(pluginsAnswer.plugins.length) {
		let githubInfo:Record<string, string> | undefined
		const parsedPlugins = pluginsAnswer.plugins.map((plugin: any) => {
			if (plugin === 'robots.txt') {
				return 'robots';
			} else if (plugin === 'sitemap.xml') {
				return 'sitemap';
			} else {
				return plugin;
			}
		});
		if(parsedPlugins.includes('github')) {
			githubInfo = await getGithubInfo()
		}

		return {
			plugins: [...parsedPlugins, 'pagefind'],
			github: githubInfo
		};
	} else {
		return {
			plugins: ['pagefind']
		};
	}
}


