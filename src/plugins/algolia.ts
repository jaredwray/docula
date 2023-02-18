import process from 'node:process';
import algoliasearch, {type SearchClient} from 'algoliasearch';
import fs from 'fs-extra';
import type {SearchIndex} from 'algoliasearch';
import type {Config} from '../config.js';
import type {DoculaPlugin, Options, Schema, Runtime} from '../docula-plugin.js';

export type AlgoliaConfig = {
	apiKey: string;
	appId: string;
	indexName: string;
};

type SearchOptions = {
	index?: SearchIndex;
} & Options;

export class AlgoliaPlugin implements DoculaPlugin {
	static schema: Schema = {
		type: 'object',
		required: ['apiKey', 'appId', 'indexName'],
		properties: {
			apiKey: {type: 'string'},
			appId: {type: 'string'},
			indexName: {type: 'string'},
		},
	};

	readonly options: SearchOptions = {
		apiKey: '',
		appId: '',
		indexName: '',
		outputPath: '',
	};

	runtime: Runtime = 'after';
	readonly client: SearchClient;

	constructor(config: Config) {
		const {appId, apiKey, indexName} = config.pluginConfig.algolia as AlgoliaConfig;
		this.options.outputPath = config.outputPath;
		this.options.appId = appId;
		this.options.apiKey = apiKey;
		this.options.indexName = indexName;
		// @ts-expect-error - algoliasearch is not callable
		this.client = algoliasearch(this.options.appId, this.options.apiKey);
		this.options.index = this.client.initIndex(this.options.indexName);
	}

	async execute(): Promise<void> {
		let jsonContent: Array<Record<string, string>> = [];
		const jsonPath = `${process.cwd()}/${this.options.outputPath}/algolia.json`;
		if (fs.existsSync(jsonPath)) {
			const data = fs.readFileSync(jsonPath, 'utf8');
			const content: Array<Record<string, string>> = JSON.parse(data);
			jsonContent = content.filter(item => item.description.length);
		}

		try {
			// @ts-expect-error - clearObjects
			await this.options.index.clearObjects();
			// @ts-expect-error - saveObjects
			await this.options.index.saveObjects(jsonContent, {
				// eslint-disable-next-line @typescript-eslint/naming-convention
				autoGenerateObjectIDIfNotExist: true,
			});
		} catch (error: unknown) {
			throw new Error(`Error while indexing to Algolia: ${(error as Error).message}`);
		}
	}
}

