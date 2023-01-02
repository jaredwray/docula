import fs from 'fs-extra';
import axios from 'axios';
import type {DoculaPlugin} from '../docula-plugin.js';
import type {Config} from '../config.js';
import type {GithubConfig} from '../types/config.js';

export class GithubPlugin implements DoculaPlugin {
	readonly options: Record<string, string> = {
		api: 'https://api.github.com',
		path: '_data',
		author: '',
		repo: '',
		sitePath: 'site',
		outputFile: 'github.json',
	};

	runtime: 'before' | 'after' = 'before';

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
