import * as fs from 'fs-extra';
import {type DoculaOptions} from './docula-options.js';

export class Docula {
	private _sitePath = 'site';
	private _outputPath = 'dist';

	constructor(options?: DoculaOptions) {
		if (options) {
			this.loadOptions(options);
		}
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

	private loadOptions(options: DoculaOptions) {
		if (options.sitePath) {
			this._sitePath = options.sitePath;
		}

		if (options.outputPath) {
			this._outputPath = options.outputPath;
		}
	}
}
