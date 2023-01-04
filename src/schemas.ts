import DoculaPlugins from './plugins/index.js';
import {type Plugins} from './types/config.js';

type Property = Record<string, string | Array<string | undefined>>;
type PluginsType = {
	type: string;
	items: {
		type: string;
		enum: Plugins;
	};
};

export type ConfigSchema = {
	type: 'object';
	additionalProperties: boolean;
	properties: {
		[key: string]: Property | PluginsType;
		plugins: PluginsType;
	};
	required: string[];
};

export const jsonConfigSchema: ConfigSchema = {
	type: 'object',
	additionalProperties: false,
	properties: {
		originPath: {type: 'string'},
		outputPath: {type: 'string'},
		dataPath: {type: 'string'},
		templatePath: {type: 'string'},
		searchEngine: {type: 'string', enum: ['algolia', null]},
		plugins: {
			type: 'array',
			items: {
				type: 'string',
				enum: Object.keys(DoculaPlugins) as Plugins,
			},
		},
		imagesPath: {type: 'string'},
		assetsPath: {type: 'string'},
	},
	required: [],
};
