import fs from 'fs-extra';
import axios from 'axios';
import type {DoculaPlugin, Options, Schema, Runtime} from '../docula-plugin.js';
import type {Config} from '../config.js';

export type GithubConfig = {
	repo: string;
	author: string;
};

export class GithubPlugin implements DoculaPlugin {
	static schema: Schema = {
		type: 'object',
		required: ['repo', 'author'],
		properties: {
			repo: {type: 'string'},
			author: {type: 'string'},
		},
	};

	readonly options: Options = {
		api: 'https://api.github.com',
		dataPath: '_data',
		author: '',
		repo: '',
		outputFile: 'github.json',
		sitePath: '',
	};

	runtime: Runtime = 'after';

	constructor(config: Config) {
		this.options.sitePath = config.originPath;
		const {author, repo} = config.pluginConfig.github as GithubConfig;
		this.options.author = author;
		this.options.repo = repo;
	}

	async execute(): Promise<void> {
		const data = {
			releases: {},
			contributors: {},
		};
		data.releases = await this.getReleases();
		data.contributors = await this.getContributors();
		const path = `${this.options.sitePath}/${this.options.dataPath}`;
		const filePath = `${path}/${this.options.outputFile}`;
		await fs.ensureDir(path);
		await fs.writeFile(filePath, JSON.stringify(data, null, 2));
	}

	async getReleases(): Promise<any> {
		const url = `${this.options.api}/repos/${this.options.author}/${this.options.repo}/releases`;
		try {
			const result = await axios.get(url);
			return result.data;
		} catch (error: unknown) {
			const typedError = error as {response: {status: number}};
			if (typedError.response?.status === 404) {
				throw new Error(`Repository ${this.options.author}/${this.options.repo} not found.`);
			}

			throw error;
		}
	}

	async getContributors(): Promise<any> {
		const url = `${this.options.api}/repos/${this.options.author}/${this.options.repo}/contributors`;
		try {
			const result = await axios.get(url);
			return result.data;
		} catch (error: unknown) {
			const typedError = error as {response: {status: number}};
			if (typedError.response?.status === 404) {
				throw new Error(`Repository ${this.options.author}/${this.options.repo} not found.`);
			}

			throw error;
		}
	}
}
