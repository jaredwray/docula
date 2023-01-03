import type {DoculaOptions} from './docula-options.js';

export type Runtime = 'before' | 'after';
export type Options = Record<string, string>;
export type Rules = Record<string, any>;

export type DoculaPlugin = {
	options: Record<string, string>;
	runtime: Runtime;
	execute(config: DoculaOptions): Promise<void>;
};
