import {exec} from 'node:child_process';
import type {DoculaPlugin, Options, Schema} from '../docula-plugin.js';
import type {Config} from '../config.js';
import {type Runtime} from '../docula-plugin.js';

export type PagefindConfig = {
	output: string;
};

export class PagefindPlugin implements DoculaPlugin {
	static schema: Schema = {
		type: 'object',
		properties: {
			output: {type: 'string'},
		},
	};

	readonly options: Options = {
		outputPath: '',
	};

	runtime: Runtime = 'after';

	constructor(config: Config) {
		this.options.outputPath = config.outputPath;
	}

	async execute(): Promise<void> {
		await new Promise((resolve, reject) => {
			exec(`npx pagefind --source ${this.options.outputPath}`, (error, stdout) => {
				if (error) {
					reject(error);
				}
				resolve(stdout);
			});
		});
	}
}
