import type DoculaPlugins from '../plugins/index.js';
import {type PluginConfig, type PluginInstance} from '../plugins/index.js';

export {type PluginConfig, type PluginInstance} from '../plugins/index.js';

export type PluginName = keyof typeof DoculaPlugins;

export type PluginInstances = Record<string, PluginInstance>;

export type Plugins = PluginName[];

export type PluginConfigs = Record<PluginName, PluginConfig>;

