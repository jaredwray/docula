import fs from 'fs-extra';
import axios from 'axios';
import type {DoculaPlugin, Options, Rules} from '../docula-plugin.js';
import type {Config} from '../config.js';
import {type Runtime} from '../docula-plugin.js';

export type GithubConfig = {
	repo: string;
	author: string;
};

export class GithubPlugin implements DoculaPlugin {
	static rules: Rules = {
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
		const result = await axios.get(url);
		return result.data;
	}

	async getContributors(): Promise<any> {
		const url = `${this.options.api}/repos/${this.options.author}/${this.options.repo}/contributors`;
		const result = await axios.get(url);
		return result.data;
	}
}
