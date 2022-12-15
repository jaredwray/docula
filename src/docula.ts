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

		// Create the <site>/api folder
		if (!fs.existsSync(rootSitePath + '/api')) {
			fs.mkdirSync(rootSitePath + '/api');
		}

		// Create the <site>/docs folder
		if (!fs.existsSync(rootSitePath + '/docs')) {
			fs.mkdirSync(rootSitePath + '/docs');
		}

		// Create the <site>/blog folder
		if (!fs.existsSync(rootSitePath + '/blog')) {
			fs.mkdirSync(rootSitePath + '/blog');
		}

		// Create the <site>/data folder
		if (!fs.existsSync(rootSitePath + '/data')) {
			fs.mkdirSync(rootSitePath + '/data');
		}

		// Create the <site>/template folder with initial template
	}

	public async build(): Promise<void> {
		try {
			await this.eleventy.build();
		} catch (error: unknown) {
			reportError(error);
		}
	}
}
