import * as path from 'node:path';
import {fileURLToPath} from 'node:url';
import process from 'node:process';
import fs from 'fs-extra';
import inquirer from 'inquirer';
import {Eleventy} from './eleventy.js';
import {Config} from './config.js';
import {reportError} from './tools.js';
import DoculaPlugins from './plugins/index.js';
import type {PluginInstances, PluginInstance} from './types/config.js';
import type {CommanderOptions} from './index.js';

export class Docula {
	readonly config: Config;
	private readonly eleventy: Eleventy;
	private pluginInstances: PluginInstances = {};

	private readonly beforePlugins: PluginInstance[] = [];
	private readonly afterPlugins: PluginInstance[] = [];

	constructor(options?: CommanderOptions) {
		const parameters = options?.opts();
		this.config = new Config(parameters?.config);
		this.eleventy = new Eleventy(this.config);
		this.loadPlugins();
	}

	public init(sitePath?: string): void {
		const userConfig: any = {};
		inquirer.prompt([
			{
				type: 'input',
				name: 'siteUrl',
				message: 'What is the URL of your site?',
				// validate(value: string) {
				// 	const regex = /^(http(s)?:\/\/.)[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_\+.~#?&//=]*)$/g;
				// 	if(value.length && value.match(regex)) {
				// 		return true;
				// 	} else {
				// 		return 'Please enter a complete URL.';
				// 	}
				// }
			},
			{
				type: 'checkbox',
				name: 'plugins',
				message: 'Select the plugins you want to use',
				choices: [{name: 'github'}, {name: 'robots.txt'}, {name: 'sitemap.xml'}],
			}
		]).then(answers => {
			if(answers.plugins.length) {
				const plugins = answers.plugins.map((plugin: any) => {
					if(plugin === 'robots.txt') {
						return 'robots';
					} else if(plugin === 'sitemap.xml') {
						return 'sitemap';
					} else {
						return plugin;
					}
				});
				answers.plugins = plugins;
				userConfig.plugins = plugins;

				if(plugins.includes('github')) {
					inquirer.prompt([
					{
						type: 'input',
						name: 'author',
						message: "What is your GitHub username?",
					}, {
						type: 'input',
						name: 'repo',
						message: "What is your GitHub repository's name?",
					}
					]).then(githubData => {
						userConfig.github = githubData
					})
				}
				userConfig.plugins = plugins;
			}
			userConfig.siteUrl = answers.siteUrl;
		}).catch(error => { console.log(error, 'errpr') })


		const {originPath} = this.config;
		const rootSitePath = path.join(process.cwd(), sitePath ?? originPath);
		// Create the <site> folder
		if (!fs.existsSync(rootSitePath)) {
			fs.mkdirSync(rootSitePath);
		}

		this.copyFolder('init', rootSitePath);
	}

	public async build(): Promise<void> {
		const {originPath} = this.config;
		const userOriginPath = `${process.cwd()}/${originPath}`;
		if (!fs.existsSync(userOriginPath)) {
			throw new Error(`The origin path "${userOriginPath}" does not exist.`);
		}
		try {
			await this.executePlugins(this.beforePlugins);
			await this.eleventy.build();
			await this.executePlugins(this.afterPlugins);
		} catch (error: unknown) {
			reportError(error);
		}
	}

	public copyFolder(source: string, target = `${this.config.originPath}/${this.config.templatePath}`): void {
		//TODO: refactor and add a check to see if the folder exists
		const __filename = fileURLToPath(import.meta.url);
		const doculaPath = path.dirname(path.dirname(__filename));
		const sourcePath = path.join(doculaPath, source);
		const sourceExists = fs.existsSync(sourcePath);
		const targetExists = fs.existsSync(target);
		const sourceStats = fs.statSync(sourcePath);
		const isDirectory = sourceExists && sourceStats.isDirectory();

		if (isDirectory) {
			if (!targetExists) {
				fs.mkdirSync(target);
			}

			for (const file of fs.readdirSync(sourcePath)) {
				this.copyFolder(path.join(source, file), path.join(target, file));
			}
		} else {
			fs.copyFileSync(sourcePath, target);
		}
	}

	private loadPlugins(): void {
		const {plugins} = this.config;

		for (const plugin of plugins) {
			const pluginClass = DoculaPlugins[plugin];
			// eslint-disable-next-line new-cap
			const pluginInstance = new pluginClass(this.config);
			this.pluginInstances[plugin] = pluginInstance;

			const {runtime} = pluginInstance;
			if (runtime === 'before') {
				this.beforePlugins.push(pluginInstance);
			} else if (runtime === 'after') {
				this.afterPlugins.push(pluginInstance);
			}
		}
	}

	private readonly executePlugins = async (plugins: PluginInstance[]): Promise<void> => {
		await Promise.all(plugins.map(async plugin => plugin.execute()));
	};
}

