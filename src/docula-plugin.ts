import {type DoculaOptions} from './docula-options.js';

export type DoculaPlugin = {
	execute(options: DoculaOptions): Promise<void>;
};
