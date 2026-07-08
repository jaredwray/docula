import path from "node:path";
import { describe, expect, it } from "vitest";
import {
	buildAbsoluteSiteUrl,
	buildGtmEnvironmentParams,
	buildUrlPath,
	escapeXml,
	isPathWithinBasePath,
	isRemoteUrl,
	normalizePathForUrl,
	summarizeMarkdown,
	toPosixPath,
} from "../src/builder-utils.js";

describe("builder-utils", () => {
	describe("buildUrlPath", () => {
		it("joins clean segments with a leading slash", () => {
			expect(buildUrlPath("api", "v1")).toBe("/api/v1");
		});

		it("trims leading and trailing slashes from each segment", () => {
			expect(buildUrlPath("/api/", "/v1/")).toBe("/api/v1");
			expect(buildUrlPath("///api///", "///v1///")).toBe("/api/v1");
		});

		it("skips undefined and empty segments", () => {
			expect(buildUrlPath(undefined, "docs", "", "guide")).toBe("/docs/guide");
		});

		it("returns root for no segments", () => {
			expect(buildUrlPath()).toBe("/");
		});

		it("returns root when every segment is only slashes", () => {
			expect(buildUrlPath("///", "/")).toBe("/");
		});
	});

	describe("buildAbsoluteSiteUrl", () => {
		it("joins a site URL and path", () => {
			expect(buildAbsoluteSiteUrl("https://x.com", "/docs")).toBe(
				"https://x.com/docs",
			);
		});

		it("strips a trailing slash from the site URL", () => {
			expect(buildAbsoluteSiteUrl("https://x.com/", "/docs")).toBe(
				"https://x.com/docs",
			);
		});
	});

	describe("normalizePathForUrl", () => {
		it("strips a trailing index.html", () => {
			expect(normalizePathForUrl("/docs/index.html")).toBe("/docs/");
		});

		it("leaves other paths untouched", () => {
			expect(normalizePathForUrl("/docs/guide/")).toBe("/docs/guide/");
		});
	});

	describe("isPathWithinBasePath", () => {
		const base = path.resolve("base");

		it("returns true for the base path itself", () => {
			expect(isPathWithinBasePath(base, base)).toBe(true);
		});

		it("returns true for a nested path", () => {
			expect(isPathWithinBasePath(path.join(base, "a", "b"), base)).toBe(true);
		});

		it("returns false for a sibling escape", () => {
			expect(isPathWithinBasePath(path.resolve("other"), base)).toBe(false);
		});

		it("returns false for a parent traversal", () => {
			expect(isPathWithinBasePath(path.join(base, ".."), base)).toBe(false);
		});
	});

	describe("toPosixPath", () => {
		it("converts OS separators to posix separators", () => {
			expect(toPosixPath(["a", "b", "c"].join(path.sep))).toBe("a/b/c");
		});
	});

	describe("escapeXml", () => {
		it("escapes all special XML characters", () => {
			expect(escapeXml(`<a href="x" id='y'>&</a>`)).toBe(
				"&lt;a href=&quot;x&quot; id=&apos;y&apos;&gt;&amp;&lt;/a&gt;",
			);
		});

		it("treats undefined as an empty string", () => {
			expect(escapeXml(undefined)).toBe("");
		});
	});

	describe("summarizeMarkdown", () => {
		it("strips markdown syntax into plain text", () => {
			const md =
				"# Title\n\n- item\n\n```js\ncode\n```\n\nSome `inline` and [link](http://x) and ![img](http://y/i.png) **bold**.";
			const summary = summarizeMarkdown(md);
			expect(summary).not.toContain("#");
			expect(summary).not.toContain("```");
			expect(summary).toContain("inline");
			expect(summary).toContain("link");
			expect(summary).toContain("bold");
			expect(summary).not.toContain("http://x");
		});

		it("returns the full text when within the max length", () => {
			expect(summarizeMarkdown("short text")).toBe("short text");
		});

		it("truncates and appends an ellipsis when too long", () => {
			const long = "word ".repeat(100).trim();
			const summary = summarizeMarkdown(long, 20);
			expect(summary.endsWith("...")).toBe(true);
			expect(summary.length).toBeLessThanOrEqual(23);
		});
	});

	describe("isRemoteUrl", () => {
		it("returns true for http and https URLs", () => {
			expect(isRemoteUrl("http://x.com")).toBe(true);
			expect(isRemoteUrl("HTTPS://x.com")).toBe(true);
		});

		it("returns false for local paths", () => {
			expect(isRemoteUrl("/api/spec.json")).toBe(false);
			expect(isRemoteUrl("./spec.json")).toBe(false);
		});
	});

	describe("buildGtmEnvironmentParams", () => {
		it("returns undefined when neither auth nor env is set", () => {
			expect(buildGtmEnvironmentParams()).toBeUndefined();
			expect(buildGtmEnvironmentParams("", "")).toBeUndefined();
		});

		it("returns undefined when only auth is set", () => {
			expect(buildGtmEnvironmentParams("abc123")).toBeUndefined();
		});

		it("returns undefined when only env is set", () => {
			expect(buildGtmEnvironmentParams(undefined, "env-3")).toBeUndefined();
		});

		it("builds params when both auth and env are set", () => {
			expect(buildGtmEnvironmentParams("abc123", "env-3")).toBe(
				"&gtm_auth=abc123&gtm_preview=env-3&gtm_cookies_win=x",
			);
		});

		it("url-encodes auth and env values", () => {
			expect(buildGtmEnvironmentParams("a b/c", "env 3")).toBe(
				"&gtm_auth=a%20b%2Fc&gtm_preview=env%203&gtm_cookies_win=x",
			);
		});
	});
});
