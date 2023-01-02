import type {GithubPlugin} from '../plugins/github.js';
import type {NpmPlugin} from '../plugins/npm.js';

export type PluginName = 'algolia' | 'github' | 'npm';

export type AlgoliaConfig = {
	appId: string;
	apiKey: string;
	indexName: string;
};

export type GithubConfig = {
	repo: string;
	author: string;
};

export type NpmConfig = {
	moduleName: string;
};

export type PluginConfig = AlgoliaConfig | GithubConfig | NpmConfig;

export type PluginInstance = GithubPlugin | NpmPlugin;

export type PluginInstances = Record<string, PluginInstance>;

export type Plugins = PluginName[];

export type PluginConfigs = Record<PluginName, PluginConfig>;
