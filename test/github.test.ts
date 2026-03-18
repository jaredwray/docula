import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { CacheableNet } from "@cacheable/net";
import dotenv from "dotenv";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	Github,
	type GithubCacheConfig,
	type GithubOptions,
} from "../src/github.js";
import githubMockContributors from "./fixtures/data-mocks/github-contributors.json";
import githubMockReleases from "./fixtures/data-mocks/github-releases.json";

const defaultOptions: GithubOptions = {
	api: "https://api.github.com",
	author: "jaredwray",
	repo: "docula",
};

vi.mock("@cacheable/net");

describe("Github", () => {
	afterEach(() => {
		// Reset the mock after each test
		vi.resetAllMocks();
	});
	beforeEach(() => {
		// biome-ignore lint/suspicious/noExplicitAny: test file
		(CacheableNet.prototype.get as any) = vi.fn(async (url: string) => {
			if (url.endsWith("releases")) {
				return { data: githubMockReleases };
			}

			if (url.endsWith("contributors")) {
				return { data: githubMockContributors };
			}

			// Default response or throw an error if you prefer
			return { data: {} };
		});
	});

	it("should be able to initialize", () => {
		const github = new Github(defaultOptions);
		expect(github).toBeDefined();
	});
	it("should be able to have default options", () => {
		const newOptions: GithubOptions = {
			api: undefined,
			author: "jaredwray1",
			repo: "docula1",
		};
		const github = new Github(newOptions);
		expect(github.options.api).toEqual(defaultOptions.api);
		expect(github.options.author).toEqual(newOptions.author);
		expect(github.options.repo).toEqual(newOptions.repo);
	});
	it("should be able to get the contributors", async () => {
		const github = new Github(defaultOptions);

		CacheableNet.prototype.get = vi
			.fn()
			.mockResolvedValue({ data: githubMockContributors });

		const result = await github.getContributors();
		expect(result).toBeDefined();
	});
	it("should use GITHUB_TOKEN for contributors if present", async () => {
		process.env.GITHUB_TOKEN = "test-token";
		const mockGet = vi.fn().mockResolvedValue({ data: githubMockContributors });
		CacheableNet.prototype.get = mockGet;
		const github = new Github(defaultOptions);

		await github.getContributors();

		expect(mockGet).toHaveBeenCalledWith(
			`${defaultOptions.api}/repos/${defaultOptions.author}/${defaultOptions.repo}/contributors`,
			{
				headers: {
					Authorization: "Bearer test-token",
					Accept: "application/vnd.github.v3+json",
				},
			},
		);

		delete process.env.GITHUB_TOKEN;
	});
	it("should be throw an error on 404", async () => {
		const errorResponse = {
			response: {
				status: 404,
				data: "Not Found",
			},
		};
		CacheableNet.prototype.get = vi.fn().mockRejectedValue(errorResponse);
		const github = new Github(defaultOptions);

		await expect(github.getContributors()).rejects.toThrow(
			`Repository ${defaultOptions.author}/${defaultOptions.repo} not found.`,
		);
	});
	it("should be throw an error", async () => {
		const errorResponse = {
			response: {
				status: 500,
				data: "Server Error",
			},
		};
		CacheableNet.prototype.get = vi.fn().mockRejectedValue(errorResponse);
		const github = new Github(defaultOptions);

		await expect(github.getContributors()).rejects.toThrow();
	});
	it("should be able to get the releases", async () => {
		const github = new Github(defaultOptions);

		CacheableNet.prototype.get = vi
			.fn()
			.mockResolvedValue({ data: githubMockReleases });

		const result = await github.getReleases();

		expect(result).toBeDefined();
	});
	it("should use GITHUB_TOKEN for releases if present", async () => {
		process.env.GITHUB_TOKEN = "test-token";
		const mockGet = vi.fn().mockResolvedValue({ data: githubMockReleases });
		CacheableNet.prototype.get = mockGet;
		const github = new Github(defaultOptions);

		await github.getReleases();

		expect(mockGet).toHaveBeenCalledWith(
			`${defaultOptions.api}/repos/${defaultOptions.author}/${defaultOptions.repo}/releases`,
			{
				headers: {
					Authorization: "Bearer test-token",
					Accept: "application/vnd.github.v3+json",
				},
			},
		);

		delete process.env.GITHUB_TOKEN;
	});
	it("should return empty array when no releases found", async () => {
		CacheableNet.prototype.get = vi.fn().mockResolvedValue({ data: [] });
		const github = new Github(defaultOptions);

		const result = await github.getReleases();
		expect(result).toEqual([]);
	});
	it("should be throw an error on 404", async () => {
		const errorResponse = {
			response: {
				status: 404,
				data: "Not Found",
			},
		};
		CacheableNet.prototype.get = vi.fn().mockRejectedValue(errorResponse);
		const github = new Github(defaultOptions);

		await expect(github.getReleases()).rejects.toThrow(
			`Repository ${defaultOptions.author}/${defaultOptions.repo} not found.`,
		);
	});
	it("should be throw an error", async () => {
		const errorResponse = {
			response: {
				status: 500,
				data: "Server Error",
			},
		};
		CacheableNet.prototype.get = vi.fn().mockRejectedValue(errorResponse);
		const github = new Github(defaultOptions);

		await expect(github.getReleases()).rejects.toThrow();
	});
	it("should be able to get the data", async () => {
		const github = new Github(defaultOptions);
		const githubReleases = vi
			.spyOn(github, "getReleases")
			.mockResolvedValue(githubMockReleases);
		const githubContributors = vi
			.spyOn(github, "getContributors")
			.mockResolvedValue(githubMockContributors);

		const result = await github.getData();
		expect(result).toBeDefined();
		githubReleases.mockRestore();
		githubContributors.mockRestore();
	});
});

describe("Github file caching", () => {
	const testCachePath = path.join(process.cwd(), "test/temp/github-cache");
	const cacheConfig: GithubCacheConfig = {
		cachePath: testCachePath,
		ttl: 3600,
	};

	afterEach(() => {
		vi.resetAllMocks();
		if (fs.existsSync(testCachePath)) {
			fs.rmSync(testCachePath, { recursive: true, force: true });
		}
	});

	beforeEach(() => {
		// biome-ignore lint/suspicious/noExplicitAny: test file
		(CacheableNet.prototype.get as any) = vi.fn(async (url: string) => {
			if (url.endsWith("releases")) {
				return { data: githubMockReleases };
			}

			if (url.endsWith("contributors")) {
				return { data: githubMockContributors };
			}

			return { data: {} };
		});
	});

	it("should initialize with cache config", () => {
		const github = new Github(defaultOptions, cacheConfig);
		expect(github).toBeDefined();
	});

	it("should save data to cache after fetching", async () => {
		const github = new Github(defaultOptions, cacheConfig);
		const githubReleases = vi
			.spyOn(github, "getReleases")
			.mockResolvedValue(githubMockReleases);
		const githubContributors = vi
			.spyOn(github, "getContributors")
			.mockResolvedValue(githubMockContributors);

		await github.getData();

		const cacheFile = path.join(testCachePath, "github", "github-data.json");
		expect(fs.existsSync(cacheFile)).toBe(true);

		const cached = JSON.parse(fs.readFileSync(cacheFile, "utf8"));
		expect(cached.releases).toBeDefined();
		expect(cached.contributors).toBeDefined();

		githubReleases.mockRestore();
		githubContributors.mockRestore();
	});

	it("should load data from cache when fresh", async () => {
		const github = new Github(defaultOptions, cacheConfig);

		// First call - populates cache
		const githubReleases = vi
			.spyOn(github, "getReleases")
			.mockResolvedValue(githubMockReleases);
		const githubContributors = vi
			.spyOn(github, "getContributors")
			.mockResolvedValue(githubMockContributors);

		await github.getData();
		expect(githubReleases).toHaveBeenCalledTimes(1);
		expect(githubContributors).toHaveBeenCalledTimes(1);

		// Second call - should use cache
		const result = await github.getData();
		expect(result).toBeDefined();
		expect(result.releases).toBeDefined();
		expect(result.contributors).toBeDefined();
		// Should not have called the API again
		expect(githubReleases).toHaveBeenCalledTimes(1);
		expect(githubContributors).toHaveBeenCalledTimes(1);

		githubReleases.mockRestore();
		githubContributors.mockRestore();
	});

	it("should fetch fresh data when cache is expired", async () => {
		const shortTtlConfig: GithubCacheConfig = {
			cachePath: testCachePath,
			ttl: 0.001,
		};
		const github = new Github(defaultOptions, shortTtlConfig);

		// Manually write an expired cache file
		const cacheDir = path.join(testCachePath, "github");
		fs.mkdirSync(cacheDir, { recursive: true });
		const cacheFile = path.join(cacheDir, "github-data.json");
		const oldData = {
			releases: [{ old: true }],
			contributors: [{ old: true }],
		};
		fs.writeFileSync(cacheFile, JSON.stringify(oldData));

		// Set mtime to past so TTL is expired
		const pastTime = new Date(Date.now() - 10_000);
		fs.utimesSync(cacheFile, pastTime, pastTime);

		const githubReleases = vi
			.spyOn(github, "getReleases")
			.mockResolvedValue(githubMockReleases);
		const githubContributors = vi
			.spyOn(github, "getContributors")
			.mockResolvedValue(githubMockContributors);

		const result = await github.getData();
		expect(result).toBeDefined();
		expect(githubReleases).toHaveBeenCalledTimes(1);
		expect(githubContributors).toHaveBeenCalledTimes(1);

		githubReleases.mockRestore();
		githubContributors.mockRestore();
	});

	it("should not use cache when ttl is 0", async () => {
		const noTtlConfig: GithubCacheConfig = {
			cachePath: testCachePath,
			ttl: 0,
		};
		const github = new Github(defaultOptions, noTtlConfig);
		const githubReleases = vi
			.spyOn(github, "getReleases")
			.mockResolvedValue(githubMockReleases);
		const githubContributors = vi
			.spyOn(github, "getContributors")
			.mockResolvedValue(githubMockContributors);

		await github.getData();
		await github.getData();

		// Should have called API both times since ttl is 0
		expect(githubReleases).toHaveBeenCalledTimes(2);
		expect(githubContributors).toHaveBeenCalledTimes(2);

		// Cache file should not exist
		const cacheFile = path.join(testCachePath, "github", "github-data.json");
		expect(fs.existsSync(cacheFile)).toBe(false);

		githubReleases.mockRestore();
		githubContributors.mockRestore();
	});

	it("should not use cache when no cache config is provided", async () => {
		const github = new Github(defaultOptions);
		const githubReleases = vi
			.spyOn(github, "getReleases")
			.mockResolvedValue(githubMockReleases);
		const githubContributors = vi
			.spyOn(github, "getContributors")
			.mockResolvedValue(githubMockContributors);

		await github.getData();
		await github.getData();

		expect(githubReleases).toHaveBeenCalledTimes(2);
		expect(githubContributors).toHaveBeenCalledTimes(2);

		githubReleases.mockRestore();
		githubContributors.mockRestore();
	});

	it("should handle corrupted cache file gracefully", async () => {
		const github = new Github(defaultOptions, cacheConfig);

		// Write invalid JSON to cache
		const cacheDir = path.join(testCachePath, "github");
		fs.mkdirSync(cacheDir, { recursive: true });
		fs.writeFileSync(
			path.join(cacheDir, "github-data.json"),
			"not valid json{{{",
		);

		const githubReleases = vi
			.spyOn(github, "getReleases")
			.mockResolvedValue(githubMockReleases);
		const githubContributors = vi
			.spyOn(github, "getContributors")
			.mockResolvedValue(githubMockContributors);

		// Should fall back to fetching
		const result = await github.getData();
		expect(result).toBeDefined();
		expect(githubReleases).toHaveBeenCalledTimes(1);

		githubReleases.mockRestore();
		githubContributors.mockRestore();
	});
});

describe("docula with github token", () => {
	it("should generate the site init files and folders with github token", async () => {
		// Load environment variables from .env file
		dotenv.config({ quiet: true });
		if (process.env.GITHUB_TOKEN) {
			console.info("GITHUB_TOKEN is set, running test with token");
			const github = new Github(defaultOptions);
			const result = await github.getData();
			expect(result).toBeDefined();
		} else {
			console.warn("Skipping test: GITHUB_TOKEN is not set");
		}
	});
});
