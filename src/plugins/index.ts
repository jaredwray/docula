import {type GithubConfig, GithubPlugin} from './github.js';
import {type NpmConfig, NpmPlugin} from './npm.js';
import {type RobotsConfig, RobotsPlugin} from './robots.js';
import {SitemapPlugin} from './sitemap.js';
import {PagefindPlugin} from './pagefind.js';
import {type AlgoliaConfig, AlgoliaPlugin} from './algolia.js';

const plugins = {
	github: GithubPlugin,
	npm: NpmPlugin,
	robots: RobotsPlugin,
	sitemap: SitemapPlugin,
	pagefind: PagefindPlugin,
	algolia: AlgoliaPlugin,
};

export type PluginConfig = GithubConfig | NpmConfig | RobotsConfig | AlgoliaConfig;

export type PluginInstance = GithubPlugin | NpmPlugin | RobotsPlugin | SitemapPlugin | PagefindPlugin | AlgoliaPlugin;

export default plugins;
