import {exec} from 'node:child_process';
import type {DoculaPlugin, Options, Schema, Runtime} from '../docula-plugin.js';
import type {Config} from '../config.js';

export class PagefindPlugin implements DoculaPlugin {
	static schema: Schema = {};

	readonly options: Options = {
		outputPath: '',
	};

	runtime: Runtime = 'after';

	constructor(config: Config) {
		this.options.outputPath = config.outputPath;
	}

	async execute(): Promise<void> {
		await new Promise((resolve, reject) => {
			exec(`npx pagefind --source ${this.options.outputPath}`, (error: any, stdout: any) => {
				if (error) {
					reject(error);
				}

				resolve(stdout);
			});
		});
	}
}
