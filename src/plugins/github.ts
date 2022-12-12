import fs from 'fs-extra';
import axios from 'axios';
import {type DoculaPlugin} from '../docula-plugin.js';
import {type DoculaOptions} from '../docula-options.js';

export class GithubPlugin implements DoculaPlugin {
	private readonly options = {
		api: 'https://api.github.com',
		path: 'data',
		repo: '',
	};

	constructor(options: DoculaOptions) {
		if (options.github) {
			if (options.github.api) {
				this.options.api = options.github.api;
			}

			if (options.dataPath) {
				this.options.path = options.dataPath;
			}

			if (options.github.repo) {
				this.options.repo = options.github.repo;
			} else {
				throw new Error('Github repo must be defined in options.github.repo');
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
		await fs.writeFile(`${this.options.path}/github.json`, JSON.stringify(data, null, 2));
	}

	async getReleases(): Promise<GithubReleaseResponse> {
		const response = await axios.get<GithubReleaseResponse>(`${this.options.api}/repos/${this.options.repo}/releases`);
		return response.data;
	}

	async getContributors(): Promise<GithubContributorsResponse> {
		const response = await axios.get<GithubContributorsResponse>(`${this.options.api}/repos/${this.options.repo}/contributors`);
		return response.data;
	}
}

type GithubReleaseResponse = {
	data: GithubRelease[];
};

type GithubRelease = {
	url: string;
	assets_url: string;
	upload_url: string;
	html_url: string;
	id: number;
	author: {
		login: string;
		id: number;
		node_id: string;
		avatar_url: string;
		gravatar_id: string;
		url: string;
		html_url: string;
		followers_url: string;
		following_url: string;
		gists_url: string;
		starred_url: string;
		subscriptions_url: string;
		organizations_url: string;
		repos_url: string;
		events_url: string;
		recieved_events_url: string;
		type: string;
		site_admin: boolean;
	};
	node_id: string;
	tag_name: string;
	target_commitish: string;
	name: string;
	draft: boolean;
	prerelease: boolean;
	created_at: string;
	published_at: string;
	assets: Array<{
		url: string;
		id: number;
		node_id: string;
		name: string;
		label: string;
		uploader: {
			login: string;
			id: number;
			node_id: string;
			avatar_url: string;
			gravatar_id: string;
			url: string;
			html_url: string;
			followers_url: string;
			following_url: string;
			gists_url: string;
			starred_url: string;
			subscriptions_url: string;
			organizations_url: string;
			repos_url: string;
			events_url: string;
			recieved_events_url: string;
			type: string;
			site_admin: boolean;
		};
		content_type: string;
		state: string;
		size: number;
		download_count: number;
		updated_at: string;
		created_at: string;
		browser_download_url: string;
	}>;
	tarball_url: string;
	zipball_url: string;
	body: string;
	mention_count: number;
};

type GithubContributorsResponse = {
	data: GithubContributors[];
};

type GithubContributors = {
	login: string;
	id: number;
	node_id: string;
	avatar_url: string;
	gravatar_id: string;
	url: string;
	html_url: string;
	followers_url: string;
	following_url: string;
	gists_url: string;
	starred_url: string;
	subscriptions_url: string;
	organizations_url: string;
	repos_url: string;
	events_url: string;
	received_events_url: string;
	type: string;
	site_admin: boolean;
	contributions: number;
};
