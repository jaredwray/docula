import {existsSync, mkdirSync, statSync, readdirSync, copyFileSync} from 'node:fs';
import * as path from 'node:path';
import {Eleventy} from './eleventy.js';
import {Config} from './config.js';
import {reportError} from './tools.js';
import {type CommanderOptions} from './index.js';

export class Docula {
	readonly config: Config;
	private readonly eleventy: Eleventy;
	private readonly directories: string[] = [
		'api',
		'docs',
		'template',
		'blog',
	];

	constructor(options?: CommanderOptions) {
		const parameters = options?.opts();
		this.config = new Config(parameters?.config);
		this.eleventy = new Eleventy(this.config);
	}

	public init(sitePath?: string): void {
		const rootSitePath = sitePath ?? this.config.originPath;

		// Create the <site> folder
		if (!existsSync(rootSitePath)) {
			mkdirSync(rootSitePath);
		}

		for (const directory of this.directories) {
			if (!existsSync(rootSitePath + '/' + directory)) {
				mkdirSync(rootSitePath + '/' + directory);
			}
		}
	}

	public async build(): Promise<void> {
		try {
			await this.eleventy.build();
		} catch (error: unknown) {
			reportError(error);
		}
	}

	public copyTemplate(source: string, target = `${this.config.originPath}/${this.config.templatePath}`): void {
		const sourceExists = existsSync(source);
		const targetExists = existsSync(target);
		const sourceStats = statSync(source);
		const isDirectory = sourceExists && sourceStats.isDirectory();

		if (isDirectory) {
			if (!targetExists) {
				mkdirSync(target);
			}

			for (const file of readdirSync(source)) {
				this.copyTemplate(path.join(source, file), path.join(target, file));
			}
		} else {
			copyFileSync(source, target);
		}
	}
}
