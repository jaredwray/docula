import type {DoculaOptions} from './docula-options.js';
import type {Config} from './config.js';

export type DoculaPlugin = {
	execute(config: DoculaOptions): Promise<void>;
};
