import {existsSync, readFileSync} from 'node:fs';
import Ajv from 'ajv';
import {jsonConfigSchema} from './schemas.js';
import type {PluginConfig, PluginConfigs, PluginName, Plugins} from './types/config.js';

export class Config {
	originPath = 'site';
	outputPath = 'dist';
	dataPath = 'data';
	templatePath = 'template';
	searchEngine = 'algolia';
	// eslint-disable-next-line  @typescript-eslint/consistent-type-assertions
	pluginConfig: PluginConfigs = {} as PluginConfigs;
	plugins: Plugins = [];
	imagesPath = 'images';
	assetsPath = 'css';
	ajv = new Ajv();

	constructor(path?: string) {
		const configPath = path ?? `./${this.originPath}/config.json`;
		const configFile = this.checkConfigFile(configPath);
		if (configFile) {
			this.loadConfig(configPath);
		}

		if (path && !configFile) {
			throw new Error('Config file not found');
		}
	}

	loadConfig(path: string) {
		const data = readFileSync(path, {encoding: 'utf8'});
		const jsonConfig = JSON.parse(data) as Record<string, any>;

		const validate = this.ajv.compile(jsonConfigSchema);

		// eslint-disable-next-line @typescript-eslint/no-floating-promises
		validate(jsonConfig);

		if (validate.errors) {
			const [error] = validate.errors;
			const {dataPath, message, keyword, params} = error;
			if (keyword === 'additionalProperties') {
				const {additionalProperty} = params as Record<string, string>;
				throw new Error(`The config file has an invalid property: ${additionalProperty}`);
			}

			throw new Error(`${dataPath} ${message!}`);
		}

		this.originPath = jsonConfig.originPath ?? this.originPath;
		this.outputPath = jsonConfig.outputPath ?? this.outputPath;
		this.dataPath = jsonConfig.dataPath ?? this.dataPath;
		this.templatePath = jsonConfig.templatePath ?? this.templatePath;
		this.searchEngine = jsonConfig.searchEngine ?? this.searchEngine;

		this.imagesPath = jsonConfig.imagesPath ?? this.imagesPath;
		this.assetsPath = jsonConfig.assetsPath ?? this.assetsPath;

		if (jsonConfig.plugins) {
			for (const name of jsonConfig.plugins) {
				this.loadPlugins(name, jsonConfig[name]);
			}
		}
	}

	loadPlugins(name: PluginName, config: PluginConfig) {
		if (config) {
			this.pluginConfig[name] = config;
		}
	}

	checkConfigFile(path: string): boolean {
		return existsSync(path);
	}
}
