import {type GithubConfig, GithubPlugin} from './github.js';
import {type NpmConfig, NpmPlugin} from './npm.js';

const plugins = {
	github: GithubPlugin,
	npm: NpmPlugin,
};

export type PluginConfig = GithubConfig | NpmConfig;

export type PluginInstance = GithubPlugin | NpmPlugin;

export default plugins;
