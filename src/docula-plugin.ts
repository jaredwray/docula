import {type DoculaOptions} from './docula-options.js';

export interface DoculaPlugin {
	execute(options: DoculaOptions): Promise<void>;
};
