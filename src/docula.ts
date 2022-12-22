import * as path from 'node:path';
import * as fs from 'fs-extra';
import {Eleventy} from './eleventy.js';
import {Config} from './config.js';
import {reportError} from './tools.js';
import {type CommanderOptions} from './index.js';

export class Docula {
	readonly config: Config;
	private readonly eleventy: Eleventy;

	constructor(options?: CommanderOptions) {
		const parameters = options?.opts();
		this.config = new Config(parameters?.config);
		this.eleventy = new Eleventy(this.config);
	}

	public init(sitePath?: string): void {
		const rootSitePath = sitePath ?? this.config.originPath;

		// Create the <site> folder
		if (!fs.existsSync(rootSitePath)) {
			fs.mkdirSync(rootSitePath);
		}

		this.copyFolder('init', rootSitePath);
	}

	public async build(): Promise<void> {
		try {
			await this.eleventy.build();
		} catch (error: unknown) {
			reportError(error);
		}
	}

	public copyFolder(source: string, target = `${this.config.originPath}/${this.config.templatePath}`): void {
		const sourceExists = fs.existsSync(source);
		const targetExists = fs.existsSync(target);
		const sourceStats = fs.statSync(source);
		const isDirectory = sourceExists && sourceStats.isDirectory();

		if (isDirectory) {
			if (!targetExists) {
				fs.mkdirSync(target);
			}

			for (const file of fs.readdirSync(source)) {
				this.copyFolder(path.join(source, file), path.join(target, file));
			}
		} else {
			fs.copyFileSync(source, target);
		}
	}
}
