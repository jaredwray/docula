import {existsSync, readFileSync} from 'node:fs';

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
	imagesPath = 'images';
	assetsPath = 'public';

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
		const data = readFileSync(path, {encoding: 'utf8'});
		const config = JSON.parse(data) as Record<string, string>;
		// Replace originPath with config.originPath if exist
		this.originPath = config.originPath ?? this.originPath;
		this.outputPath = config.outputPath ?? this.outputPath;
		this.dataPath = config.dataPath ?? this.dataPath;
		this.templatePath = config.templatePath ?? this.templatePath;
		this.searchEngine = config.searchEngine ?? this.searchEngine;
		if (config.algoliaAppId && config.algoliaKey && config.algoliaIndexName) {
			this.algolia = {
				algoliaAppId: config.algoliaAppId,
				algoliaKey: config.algoliaKey,
				algoliaIndexName: config.algoliaIndexName,
			};
		}

		this.imagesPath = config.imagesPath ?? this.imagesPath;
		this.assetsPath = config.assetsPath ?? this.assetsPath;
	}

	checkConfigFile(path?: string): boolean {
		if (!path) {
			return false;
		}

		return existsSync(path);
	}
}
