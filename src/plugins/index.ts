import {type GithubConfig, GithubPlugin} from './github.js';
import {type NpmConfig, NpmPlugin} from './npm.js';
import {type RobotsConfig, RobotsPlugin} from './robots.js';
import {SitemapPlugin} from './sitemap.js';
import {PagefindPlugin} from './pagefind.js';

const plugins = {
	github: GithubPlugin,
	npm: NpmPlugin,
	robots: RobotsPlugin,
	sitemap: SitemapPlugin,
	pagefind: PagefindPlugin,
};

export type PluginConfig = GithubConfig | NpmConfig | RobotsConfig;

export type PluginInstance = GithubPlugin | NpmPlugin | RobotsPlugin | SitemapPlugin | PagefindPlugin;

export default plugins;
