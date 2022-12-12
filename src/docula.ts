import { existsSync, mkdirSync } from 'fs';
import {Eleventy} from './eleventy.js';
import {Config} from './config.js';
import {getErrorMessage, reportError} from './tools.js';
import {type CommanderOptions} from './index.js';

export class Docula {
	readonly config: Config;
	private readonly eleventy: Eleventy;
	private readonly directories: string[] = ['data',
		'api',
		'docs',
		'template',
		'blog'
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

		this.directories.forEach((directory) => {
			if(!existsSync(rootSitePath + '/' + directory)) {
				mkdirSync(rootSitePath + '/' + directory);
			}
		})

	}

	public async build(): Promise<void> {
		try {
			await this.eleventy.build();
		} catch (error: unknown) {
			reportError({message: getErrorMessage(error)});
		}
	}
}
