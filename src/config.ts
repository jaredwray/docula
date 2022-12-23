import {existsSync, readFileSync} from 'node:fs';
import {reportError} from "./tools";

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
			const JSONconfig = JSON.parse(data) as Record<string, any>;

			this.originPath = JSONconfig.originPath ?? this.originPath;
			this.outputPath = JSONconfig.outputPath ?? this.outputPath;
			this.dataPath = JSONconfig.dataPath ?? this.dataPath;
			this.templatePath = JSONconfig.templatePath ?? this.templatePath;
			this.searchEngine = JSONconfig.searchEngine ?? this.searchEngine;
			if (JSONconfig.algoliaAppId && JSONconfig.algoliaKey && JSONconfig.algoliaIndexName) {
				this.algolia = {
					algoliaAppId: JSONconfig.algoliaAppId,
					algoliaKey: JSONconfig.algoliaKey,
					algoliaIndexName: JSONconfig.algoliaIndexName,
				};
			}

			this.imagesPath = JSONconfig.imagesPath ?? this.imagesPath;
			this.assetsPath = JSONconfig.assetsPath ?? this.assetsPath;

			if(JSONconfig.plugins && Array.isArray(JSONconfig.plugins)) {
				if(JSONconfig.plugins.length)  {
					const validPlugins = JSONconfig.plugins.every((plugin) => typeof plugin === 'string');
					if(validPlugins) {
						JSONconfig.plugins.forEach((name: string) => {
							this.loadPlugins(name, JSONconfig[name]);
						})
					} else {
						throw 'Invalid plugins';
					}
				}
			} else {
				throw 'Plugins must be an array of strings'
			}
		} catch(error: unknown) {
			reportError(error);
		}
	}


	loadPlugins(name: string, config: Record<string, string>) {
		if(config) {
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
