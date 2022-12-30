import type {DoculaOptions} from './docula-options.js';

export type DoculaPlugin = {
	execute(config: DoculaOptions): Promise<void>;
};
