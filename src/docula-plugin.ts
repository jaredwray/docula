import type {DoculaOptions} from './docula-options.js';

export type DoculaPlugin = {
	options: Record<string, string>,
	runtime: 'before' | 'after',
	execute(config: DoculaOptions): Promise<void>;
};
