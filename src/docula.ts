import * as path from 'node:path';
import {fileURLToPath} from 'node:url';
import process from 'node:process';
import fs from 'fs-extra';
import {Eleventy} from './eleventy.js';
import {Config} from './config.js';
import {getSiteURL, getUserPlugins} from './tools.js';
import DoculaPlugins from './plugins/index.js';
import type {PluginInstance, PluginInstances} from './types/config.js';
import type {CommanderOptions} from './index.js';

export class Docula {
	readonly config: Config;
	private readonly eleventy: Eleventy;
	private pluginInstances: PluginInstances = {};

	private readonly beforePlugins: PluginInstance[] = [];
	private readonly afterPlugins: PluginInstance[] = [];

	constructor(options?: CommanderOptions) {
		const parameters = options?.opts();
		const configPath = `${process.cwd()}/site/config.json`;
		const config: string = parameters ? parameters?.config : configPath;
		this.config = new Config(config);
		this.eleventy = new Eleventy(this.config);
		this.loadPlugins();
	}

	public async init(sitePath?: string): Promise<void> {
		await this.buildConfigFile();
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
		await this.executePlugins(this.beforePlugins);
		await this.eleventy.build();
		await this.executePlugins(this.afterPlugins);
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

	private async buildConfigFile(): Promise<void> {
		const userConfig: any = {};
		const siteUrl = await getSiteURL();
		const plugins = await getUserPlugins();
		userConfig.siteUrl = siteUrl;

		for (const plugin in plugins) {
			userConfig[plugin] = plugins[plugin];
		}

		const configPath = `${process.cwd()}/${this.config.originPath}/config.json`;
		fs.writeFileSync(configPath, JSON.stringify(userConfig, null, 2));
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

