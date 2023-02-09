import algoliasearch from 'algoliasearch';
import type {Config} from '../config.js';
import type {DoculaPlugin, Options, Schema, Runtime} from '../docula-plugin.js';
import {Eleventy} from "../eleventy.js";
import fs from "fs-extra";

export type AlgoliaConfig = {
  apiKey: string;
  appId: string;
  indexName: string;
}

export class AlgoliaPlugin implements DoculaPlugin {
  static schema: Schema = {
    type: 'object',
    required: ['apiKey', 'appId', 'indexName'],
    properties: {
      apiKey: {type: 'string'},
      appId: {type: 'string'},
      indexName: {type: 'string'}
    },
  };

  readonly options: Options = {
    apiKey: '',
    appId: '',
    indexName: '',
    index: '',
    outputPath: ''
  }

  runtime: Runtime = 'after';
  private readonly eleventy: Eleventy;
  private readonly client: any;

  constructor(config: Config) {
    this.eleventy = new Eleventy(config);
    const {appId, apiKey, indexName} = config.pluginConfig.algolia as AlgoliaConfig;
    this.options.outputPath = config.outputPath;
    this.options.appId = appId;
    this.options.apiKey = apiKey;
    this.options.indexName = indexName;
    // @ts-ignore TODO: updateOptions type
    this.client = algoliasearch(this.options.appId, this.options.apiKey);
    this.options.index = this.client.initIndex(this.options.indexName);

  }

  async execute(): Promise<void> {
    let jsonContent:string = '';
    const jsonPath = `${process.cwd()}/${this.options.outputPath}/algolia.json`;
    if(fs.existsSync(jsonPath)) {
      const data = fs.readFileSync(jsonPath, 'utf8');
      jsonContent = JSON.parse(data);
    }
    try {
      // @ts-ignore TODO: updateOptions type
      await this.options.index.saveObjects(jsonContent, {
        autoGenerateObjectIDIfNotExist: true,
      })
    } catch (error: any) {
      throw new Error(`Error while indexing to Algolia: ${error.message}`);
    }
  };
}

