import axios from 'axios';

export type GithubOptions = {
	api?: string | undefined;
	author: string;
	repo: string;
};

export type GithubData = {
	releases: Record<string, unknown>;
	contributors: Record<string, unknown>;
};

export class Github {
	options = {
		api: 'https://api.github.com',
		author: '',
		repo: '',
	};

	constructor(options: GithubOptions) {
		this.parseOptions(options);
	}

	async getData(): Promise<GithubData> {
		const data = {
			releases: {},
			contributors: {},
		};
		// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
		data.releases = await this.getReleases();
		// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
		data.contributors = await this.getContributors();

		return data as GithubData;
	}

	async getReleases(): Promise<any> {
		const url = `${this.options.api}/repos/${this.options.author}/${this.options.repo}/releases`;
		try {
			const result = await axios.get(url);

			if (result && result.data.length > 0) {
				// eslint-disable-next-line @typescript-eslint/no-unsafe-return
				return this.addAnchorLink(result.data as any[]);
			}

			return [];
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
			if (result && result.data.length > 0) {
				// eslint-disable-next-line @typescript-eslint/no-unsafe-return
				return result.data;
			}
		} catch (error: unknown) {
			const typedError = error as {response: {status: number}};
			if (typedError.response?.status === 404) {
				throw new Error(`Repository ${this.options.author}/${this.options.repo} not found.`);
			}

			throw error;
		}
	}

	public parseOptions(options: GithubOptions) {
		if (options.api) {
			this.options.api = options.api;
		}

		this.options.author = options.author;
		this.options.repo = options.repo;
	}

	private addAnchorLink(data: any[]): any[] {
		return data.map(release => {
			const regex = /(?<!]\()(https:\/\/[\w./]+)(?!\))/g;
			// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
			release.body = release.body.replaceAll(regex, '[$1]($1)');
			// eslint-disable-next-line @typescript-eslint/no-unsafe-return
			return release;
		});
	}
}
