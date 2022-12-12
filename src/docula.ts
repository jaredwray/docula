import { existsSync, mkdirSync } from 'fs';
import {type DoculaOptions} from './docula-options.js';
import {Eleventy} from "./eleventy.js";
import {Config} from "./config.js";

export class Docula {
	private _sitePath = 'site';
	private _outputPath = 'dist';
	private eleventy: Eleventy;
	private readonly config: Config;
	private readonly directories: string[] = ['data',
		'api',
		'docs',
		'template',
		'blog'
	];

	constructor(options: any) {
		const params = options.opts();

		this.config = new Config(params.config);

		this.eleventy = new Eleventy(this.config);
	}

	get sitePath() {
		return this._sitePath;
	}

	get outputPath() {
		return this._outputPath;
	}

	public init(sitePath?: string): void {
		const rootSitePath = sitePath ?? this._sitePath;

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

	private loadOptions(options: DoculaOptions) {
		if (options.sitePath) {
			this._sitePath = options.sitePath;
		}

		if (options.outputPath) {
			this._outputPath = options.outputPath;
		}
	}

	public async build(): Promise<void> {
		try{
			await this.eleventy.build();
		} catch (error: any) {
			console.log('Error: ', error.message);
		}
	}

}
