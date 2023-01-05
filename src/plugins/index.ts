import {type GithubConfig, GithubPlugin} from './github.js';
import {type NpmConfig, NpmPlugin} from './npm.js';
import {type RobotsConfig, RobotsPlugin} from './robots.js';

const plugins = {
	github: GithubPlugin,
	npm: NpmPlugin,
	robots: RobotsPlugin,
};

export type PluginConfig = GithubConfig | NpmConfig | RobotsConfig;

export type PluginInstance = GithubPlugin | NpmPlugin | RobotsPlugin;

export default plugins;
