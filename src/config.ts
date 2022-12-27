import {existsSync, readFileSync} from 'node:fs';
import {reportError} from './tools.js';

type AlgoliaConfig = {
	algoliaAppId: string;
	algoliaKey: string;
	algoliaIndexName: string;
};

export class Config {
	originPath = 'site';
	outputPath = 'dist';
	dataPath = 'data';
	templatePath = 'template';
	searchEngine = 'algolia';
	algolia?: AlgoliaConfig;
	plugins?: any;
	imagesPath = 'images';
	assetsPath = 'css';

	constructor(path?: string) {
		const configFile = this.checkConfigFile(path);
		if (path) {
			if (configFile) {
				this.loadConfig(path);
			} else {
				throw new Error('Config file not found');
			}
		}
	}

	loadConfig(path: string) {
		try {
			const data = readFileSync(path, {encoding: 'utf8'});
			const jsonConfig = JSON.parse(data) as Record<string, any>;

			this.originPath = jsonConfig.originPath ?? this.originPath;
			this.outputPath = jsonConfig.outputPath ?? this.outputPath;
			this.dataPath = jsonConfig.dataPath ?? this.dataPath;
			this.templatePath = jsonConfig.templatePath ?? this.templatePath;
			this.searchEngine = jsonConfig.searchEngine ?? this.searchEngine;
			if (jsonConfig.algoliaAppId && jsonConfig.algoliaKey && jsonConfig.algoliaIndexName) {
				this.algolia = {
					algoliaAppId: jsonConfig.algoliaAppId,
					algoliaKey: jsonConfig.algoliaKey,
					algoliaIndexName: jsonConfig.algoliaIndexName,
				};
			}

			this.imagesPath = jsonConfig.imagesPath ?? this.imagesPath;
			this.assetsPath = jsonConfig.assetsPath ?? this.assetsPath;

			if (jsonConfig.plugins && Array.isArray(jsonConfig.plugins)) {
				if (jsonConfig.plugins.length > 0) {
					const validPlugins = jsonConfig.plugins.every(plugin => typeof plugin === 'string');
					if (validPlugins) {
						for (const name of jsonConfig.plugins) {
							this.loadPlugins(name, jsonConfig[name]);
						}
					} else {
						throw 'Invalid plugins';
					}
				}
			} else {
				throw 'Plugins must be an array of strings';
			}
		} catch (error: unknown) {
			reportError(error);
		}
	}

	loadPlugins(name: string, config: Record<string, string>) {
		if (config) {
			this.plugins[name] = config;
		}
	}

	checkConfigFile(path?: string): boolean {
		if (!path) {
			return false;
		}

		return existsSync(path);
	}
}
