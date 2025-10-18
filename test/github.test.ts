import process from "node:process";
import { CacheableNet } from "@cacheable/net";
import dotenv from "dotenv";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Github, type GithubOptions } from "../src/github.js";
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
