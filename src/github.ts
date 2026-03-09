import fs from "node:fs";
import path from "node:path";
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

export type GithubCacheConfig = {
	cachePath: string;
	ttl: number;
};

export class Github {
	options = {
		api: "https://api.github.com",
		author: "",
		repo: "",
	};

	private net: CacheableNet;
	private cacheConfig?: GithubCacheConfig;

	constructor(options: GithubOptions, cacheConfig?: GithubCacheConfig) {
		this.parseOptions(options);
		this.net = new CacheableNet();
		if (cacheConfig) {
			this.cacheConfig = cacheConfig;
		}
	}

	async getData(): Promise<GithubData> {
		// Try loading from file cache first
		if (this.cacheConfig && this.cacheConfig.ttl > 0) {
			const cached = this.loadCache();
			if (cached) {
				return cached;
			}
		}

		const data = {
			releases: {},
			contributors: {},
		};

		data.releases = await this.getReleases();

		data.contributors = await this.getContributors();

		const result = data as GithubData;

		// Save to file cache
		if (this.cacheConfig && this.cacheConfig.ttl > 0) {
			this.saveCache(result);
		}

		return result;
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

	private getCacheFilePath(): string {
		/* v8 ignore next 3 -- @preserve */
		if (!this.cacheConfig) {
			throw new Error("Cache config is not set");
		}

		const cacheDir = path.join(this.cacheConfig.cachePath, "github");
		return path.join(cacheDir, "github-data.json");
	}

	private loadCache(): GithubData | undefined {
		try {
			const cacheFile = this.getCacheFilePath();
			if (!fs.existsSync(cacheFile)) {
				return undefined;
			}

			const stat = fs.statSync(cacheFile);
			const ageInSeconds = (Date.now() - stat.mtimeMs) / 1000;
			if (ageInSeconds > (this.cacheConfig?.ttl ?? 0)) {
				return undefined;
			}

			const raw = fs.readFileSync(cacheFile, "utf8");
			return JSON.parse(raw) as GithubData;
		} catch {
			return undefined;
		}
	}

	private saveCache(data: GithubData): void {
		try {
			const cacheFile = this.getCacheFilePath();
			const cacheDir = path.dirname(cacheFile);
			if (!fs.existsSync(cacheDir)) {
				fs.mkdirSync(cacheDir, { recursive: true });
			}

			fs.writeFileSync(cacheFile, JSON.stringify(data, null, 2));
		} catch {
			// Silently fail on cache write errors
		}
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
