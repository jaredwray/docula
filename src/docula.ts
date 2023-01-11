import * as path from 'node:path';
import fs from 'fs-extra';
import {Eleventy} from './eleventy.js';
import {Config} from './config.js';
import {reportError} from './tools.js';
import DoculaPlugins from './plugins/index.js';
import type {PluginInstances, PluginInstance} from './types/config.js';
import type {CommanderOptions} from './index.js';
import {fileURLToPath} from 'url';

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
		const {originPath} = this.config;
		const rootSitePath = path.join(process.cwd(), sitePath || originPath);
		// Create the <site> folder
		if (!fs.existsSync(rootSitePath)) {
			fs.mkdirSync(rootSitePath);
		}

		this.copyFolder('init', rootSitePath);
	}

	public async build(): Promise<void> {
		const {originPath} = this.config;
		// eslint-disable-next-line unicorn/prefer-module
		const userOriginPath = `${process.cwd()}/${originPath}`;
		if(!fs.existsSync(userOriginPath)) {
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

