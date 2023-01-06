import {type GithubConfig, GithubPlugin} from './github.js';
import {type NpmConfig, NpmPlugin} from './npm.js';
import {type RobotsConfig, RobotsPlugin} from './robots.js';
import {type SitemapConfig, SitemapPlugin} from './sitemap.js';

const plugins = {
	github: GithubPlugin,
	npm: NpmPlugin,
	robots: RobotsPlugin,
	sitemap: SitemapPlugin,
};

export type PluginConfig = GithubConfig | NpmConfig | RobotsConfig | SitemapConfig;

export type PluginInstance = GithubPlugin | NpmPlugin | RobotsPlugin | SitemapPlugin;

export default plugins;
