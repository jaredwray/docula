import fs from 'fs-extra';
import axios from 'axios';
import {type DoculaPlugin} from '../docula-plugin.js';
import {type DoculaOptions} from '../docula-options.js';

export class GithubPlugin implements DoculaPlugin {
	private readonly options = {
		api: 'https://api.github.com',
		path: 'data',
		author: '',
		repo: '',
		sitePath: 'site',
		outputFile: 'github.json',
	};

	constructor(options: DoculaOptions) {
		if (options.sitePath) {
			this.options.sitePath = options.sitePath;
		}

		if (options.dataPath) {
			this.options.path = options.dataPath;
		}

		if (options.github) {
			if (options.github.api) {
				this.options.api = options.github.api;
			}

			if (options.github.repo) {
				this.options.repo = options.github.repo;
			} else {
				throw new Error('Github repo must be defined in options.github.repo');
			}

			if (options.github.author) {
				this.options.author = options.github.author;
			} else {
				throw new Error('Github author must be defined in options.github.author');
			}
		}
	}

	async execute(): Promise<void> {
		const data = {
			releases: {},
			contributors: {},
		};
		data.releases = await this.getReleases();
		data.contributors = await this.getContributors();
		const path = `${this.options.sitePath}/${this.options.path}`;
		const filePath = `${this.options.sitePath}/${this.options.path}/${this.options.outputFile}`;
		await fs.ensureDir(path);
		await fs.writeFile(filePath, JSON.stringify(data, null, 2));
	}

	async getReleases(): Promise<any> {
		const url = `${this.options.api}/repos/${this.options.author}/${this.options.repo}/releases`;
		const result = await axios.get(url);
		return result.data;
	}

	async getContributors(): Promise<any> {
		const url = `${this.options.api}/repos/${this.options.author}/${this.options.repo}/contributors`;
		const result = await axios.get(url);
		return result.data;
	}
}
