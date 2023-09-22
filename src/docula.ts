import * as path from 'node:path';
import process from 'node:process';
import fs from 'fs-extra';
import express from 'express';
import {Eleventy} from './eleventy.js';
import {Config} from './config.js';
import {setPlugins} from './tools/inquirer-prompt.js';
import DoculaPlugins from './plugins/index.js';
import type {PluginInstance, PluginInstances} from './types/config.js';
import {getConfigPath, getFileName, getSitePath} from './tools/path.js';
import logger from './logger.js';
import type {CommanderOptions} from './index.js';

export class Docula {
	readonly config: Config;
	private readonly eleventy: Eleventy;
	private pluginInstances: PluginInstances = {};

	private readonly beforePlugins: PluginInstance[] = [];
	private readonly afterPlugins: PluginInstance[] = [];
	private readonly landingFilesExceptions: string[] = ['search-index.md', 'versions.njk', 'index.njk', 'doc.njk'];

	constructor(options?: CommanderOptions) {
		const parameters = options?.opts();
		const defaultConfigPath = getConfigPath();
		const configPath: string = parameters ? parameters?.config : defaultConfigPath;
		this.config = new Config(configPath);
		this.eleventy = new Eleventy(this.config);
		this.loadPlugins();
	}

	public async init(sitePath?: string): Promise<void> {
		const config = await this.writeConfigFile(sitePath);
		const {originPath} = this.config;
		const rootSitePath = path.join(process.cwd(), sitePath ?? originPath);

		if (config.siteType === 'multi page') {
			this.copyFolder('init', rootSitePath);
			this.copySearchEngineFiles();
		}

		if (config.siteType === 'landing') {
			this.copyLandingFolder('init', rootSitePath);
		}
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

	public async build2(): Promise<void> {
		const {originPath} = this.config;
		const userOriginPath = `${process.cwd()}/${originPath}`;
		if (!fs.existsSync(userOriginPath)) {
			throw new Error(`The origin path "${userOriginPath}" does not exist.`);
		}

		await this.executePlugins(this.beforePlugins);
		await this.eleventy.build();
		await this.executePlugins(this.afterPlugins);
	}

	public async serve(): Promise<void> {
		const {outputPath} = this.config;
		if (!fs.existsSync(outputPath)) {
			throw new Error(`The origin path "${outputPath}" does not exist.`);
		}

		const app = express();
		const port = 8080;
		app.use(express.static(outputPath));
		app.listen(port, () => {
			logger.info(`Docula is running on http://localhost:${port}`);
		});
	}

	public copyLandingFolder(source: string, target: string): void {
		const {sourcePath, targetExists, isDirectory} = this.validateFilePath(source, target);

		if (isDirectory) {
			const regex = /(search|docs|multipage)+/gi;
			if (regex.test(source)) {
				return;
			}

			if (!targetExists) {
				fs.mkdirSync(target);
			}

			for (const file of fs.readdirSync(sourcePath)) {
				if (!fs.existsSync(path.join(target, file))) {
					this.copyLandingFolder(path.join(source, file), path.join(target, file));
				}
			}
		} else if (!fs.existsSync(target)) {
			const isExcepted = this.landingFilesExceptions.some(file => source.includes(file));
			if (isExcepted) {
				return;
			}

			fs.copyFileSync(sourcePath, target);
		}
	}

	public copyFolder(source: string, target: string): void {
		const {sourcePath, targetExists, isDirectory} = this.validateFilePath(source, target);

		if (isDirectory) {
			// Exclude the search folder
			if (source.includes('search') || source.includes('landing')) {
				return;
			}

			if (!targetExists) {
				fs.mkdirSync(target);
			}

			for (const file of fs.readdirSync(sourcePath)) {
				if (!fs.existsSync(path.join(target, file))) {
					this.copyFolder(path.join(source, file), path.join(target, file));
				}
			}
		} else if (!fs.existsSync(target)) {
			// Exclude the search-index file
			if (source.includes('search-index.md') || source.includes('releases')) {
				return;
			}

			fs.copyFileSync(sourcePath, target);
		}
	}

	copySearchEngineFiles(): void {
		const {searchEngine, originPath} = this.config;
		const __filename = getFileName();
		const doculaPath = path.dirname(path.dirname(path.dirname(__filename)));
		const sourcePath = path.join(doculaPath, `init/_includes/search/${searchEngine}.njk`);
		const searchPath = path.join(process.cwd(), `${originPath}/_includes/search`);
		const targetPath = path.join(process.cwd(), `${originPath}/_includes/search/${searchEngine}.njk`);
		const searchStylesPath = path.join(process.cwd(), `${originPath}/_includes/assets/css/styles/search`);
		const sourceSearchStylesPath = path.join(doculaPath, `init/_includes/assets/css/styles/search/${searchEngine}.css`);
		const searchStylesTargetPath = path.join(process.cwd(), `${originPath}/_includes/assets/css/styles/search/${searchEngine}.css`);

		if (!fs.existsSync(searchPath)) {
			fs.mkdirSync(searchPath);
		}

		if (!fs.existsSync(targetPath)) {
			fs.copyFileSync(sourcePath, targetPath);
		}

		// Copy search styles
		if (!fs.existsSync(searchStylesPath)) {
			fs.mkdirSync(searchStylesPath);
		}

		if (!fs.existsSync(searchStylesTargetPath)) {
			fs.copyFileSync(sourceSearchStylesPath, searchStylesTargetPath);
		}

		if (searchEngine === 'algolia') {
			const indexSource = path.join(doculaPath, 'init/search-index.md');
			const indexTarget = path.join(process.cwd(), `${originPath}/search-index.md`);

			if (!fs.existsSync(indexTarget)) {
				fs.copyFileSync(indexSource, indexTarget);
			}
		}
	}

	async writeConfigFile(sitePath?: string): Promise<Record<string, unknown>> {
		const plugins = await setPlugins();
		for (const plugin in plugins) {
			if (Object.prototype.hasOwnProperty.call(plugins, plugin)) {
				// @ts-expect-error fix later
				this.config[plugin] = plugins[plugin];
			}
		}

		const originPath = getSitePath();
		const configPath = getConfigPath();

		const rootSitePath = sitePath ? path.join(process.cwd(), sitePath) : originPath;

		// Create the <site> folder
		if (!fs.existsSync(rootSitePath)) {
			fs.mkdirSync(rootSitePath);
		}

		fs.writeFileSync(configPath, JSON.stringify(plugins, null, 2));
		return plugins;
	}

	validateFilePath(source: string, target: string): Record<string, any> {
		const __filename = getFileName();
		const doculaPath = path.dirname(path.dirname(path.dirname(__filename)));
		const sourcePath = path.join(doculaPath, source);
		const sourceExists = fs.existsSync(sourcePath);
		const targetExists = fs.existsSync(target);
		const sourceStats = fs.statSync(sourcePath);
		const isDirectory = sourceExists && sourceStats.isDirectory();

		return {
			sourcePath,
			sourceExists,
			targetExists,
			isDirectory,
		};
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

