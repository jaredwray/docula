import process from "node:process";
import { CacheableNet } from "@cacheable/net";

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
		api: "https://api.github.com",
		author: "",
		repo: "",
	};

	private net: CacheableNet;

	constructor(options: GithubOptions) {
		this.parseOptions(options);
		this.net = new CacheableNet();
	}

	async getData(): Promise<GithubData> {
		const data = {
			releases: {},
			contributors: {},
		};

		data.releases = await this.getReleases();

		data.contributors = await this.getContributors();

		return data as GithubData;
	}

	// biome-ignore lint/suspicious/noExplicitAny: need to fix
	async getReleases(): Promise<any> {
		const url = `${this.options.api}/repos/${this.options.author}/${this.options.repo}/releases`;
		let options = {};
		if (process.env.GITHUB_TOKEN) {
			options = {
				headers: {
					Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
					Accept: "application/vnd.github.v3+json",
				},
			};
		}

		try {
			const result = await this.net.get<unknown[]>(url, options);

			if (result && result.data.length > 0) {
				// biome-ignore lint/suspicious/noExplicitAny: need to fix
				return this.addAnchorLink(result.data as any[]);
			}

			return [];
		} catch (error: unknown) {
			const typedError = error as { response: { status: number } };
			if (typedError.response?.status === 404) {
				throw new Error(
					`Repository ${this.options.author}/${this.options.repo} not found.`,
				);
			}

			throw error;
		}
	}

	// biome-ignore lint/suspicious/noExplicitAny: need to fix
	async getContributors(): Promise<any> {
		const url = `${this.options.api}/repos/${this.options.author}/${this.options.repo}/contributors`;
		let options = {};
		if (process.env.GITHUB_TOKEN) {
			options = {
				headers: {
					Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
					Accept: "application/vnd.github.v3+json",
				},
			};
		}

		try {
			const result = await this.net.get<unknown[]>(url, options);
			if (result && result.data.length > 0) {
				return result.data;
			}
		} catch (error: unknown) {
			const typedError = error as { response: { status: number } };
			if (typedError.response?.status === 404) {
				throw new Error(
					`Repository ${this.options.author}/${this.options.repo} not found.`,
				);
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

	// biome-ignore lint/suspicious/noExplicitAny: need to fix
	private addAnchorLink(data: any[]): any[] {
		return data.map((release) => {
			const regex = /(?<!]\()(https:\/\/[\w./]+)(?!\))/g;

			release.body = release.body.replaceAll(regex, "[$1]($1)");
			return release;
		});
	}
}
