import algoliasearch from 'algoliasearch';
import type {Config} from '../config.js';
import type {DoculaPlugin, Options, Schema, Runtime} from '../docula-plugin.js';
import {Eleventy} from "../eleventy.js";

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
  }

  runtime: Runtime = 'after';
  private readonly eleventy: Eleventy;
  private readonly client: any;

  constructor(config: Config) {
    this.eleventy = new Eleventy(config);
    const {appId, apiKey, indexName} = config.pluginConfig.algolia as AlgoliaConfig;
    this.options.appId = appId;
    this.options.apiKey = apiKey;
    this.options.indexName = indexName;
    // @ts-ignore TODO: updateOptions type
    this.client = algoliasearch(this.options.appId, this.options.apiKey);
    this.options.index = this.client.initIndex(this.options.indexName);

  }

  async execute(): Promise<void> {
    try {
    const jsonContent = await this.eleventy.toJSON();
      console.log(jsonContent, 'jsonContent')
    // @ts-ignore TODO: updateOptions type
    this.options.index.saveObjects(jsonContent, {
      autoGenerateObjectIDIfNotExist: true,
    })
    } catch (error: unknown) {
      throw new Error(`Error while indexing to Algolia: ${error}`);
    }
  };
}

//
// //   const content = `{
// //       "apiKey": "${this.options.apiKey}",
// //       "indexName": "${this.options.indexName}",
// //       "appId": "${this.options.appId}",
// //       "inputSelector": "#search-input",
// //       "debug": true,
// //       "searchParameters": {
// //         "hitsPerPage": 10
// //       },
// //       "transformData": function(hits) {
// //         hits.forEach(function(hit) {
// //           hit.url = hit.url.replace('https://example.com', '');
// //         });
// //         return hits;
// //       },
// //       "hits": ${JSON.stringify(jsonContent)}
// //     }`;
// //
// //   fs.writeFileSync(`${this.options.outputPath}/algolia.json`, content);
// // }
