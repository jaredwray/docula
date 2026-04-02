import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { DoculaOptions } from "../src/options.js";

describe("DoculaOptions", () => {
	describe("constructor", () => {
		it("should default output to sitePath/dist", () => {
			const options = new DoculaOptions();
			expect(options.output).toEqual(path.join(options.sitePath, "dist"));
		});

		it("should default output to custom sitePath/dist when sitePath is provided", () => {
			const options = new DoculaOptions({ sitePath: "./custom-site" });
			expect(options.output).toEqual(
				path.join(process.cwd(), "custom-site", "dist"),
			);
		});

		it("should not override explicit output when sitePath is also provided", () => {
			const options = new DoculaOptions({
				sitePath: "./custom-site",
				output: "./my-output",
			});
			expect(options.output).toContain("/my-output");
		});

		it("should create an instance of DoculaOptions with default values", () => {
			const options = new DoculaOptions();
			expect(options.template).toEqual("modern");
			expect(options.templatePath).toEqual("");
			expect(options.output).toContain("/dist");
			expect(options.sitePath).toContain("/site");
			expect(options.githubPath).toEqual("");
			expect(options.siteTitle).toEqual("docula");
			expect(options.siteDescription).toEqual(
				"Beautiful Website for Your Projects",
			);
			expect(options.siteUrl).toEqual("https://docula.org");
			expect(options.enableReleaseChangelog).toEqual(true);
			expect(options.changelogPerPage).toEqual(20);
			expect(options.enableLlmsTxt).toEqual(true);
			expect(options.autoUpdateIgnores).toEqual(true);
			expect(options.autoReadme).toEqual(true);
			expect(options.quiet).toEqual(false);
			expect(options.ai).toBeUndefined();
			expect(options.themeMode).toBeUndefined();
			expect(options.cache).toEqual({ github: { ttl: 3600 } });
		});

		it("should create an instance of DoculaOptions with custom values", () => {
			const options = new DoculaOptions({
				templatePath: "./custom-template",
				output: "./custom-dist",
				sitePath: "./custom-site",
				githubPath: "custom/repo",
				siteTitle: "Custom Title",
				siteDescription: "Custom Description",
				siteUrl: "https://custom-url.com",
				sections: [{ name: "Custom Section", path: "custom-section" }],
			});
			expect(options.templatePath).toContain("/custom-template");
			expect(options.output).toContain("/custom-dist");
			expect(options.sitePath).toContain("/custom-site");
			expect(options.githubPath).toEqual("custom/repo");
			expect(options.siteTitle).toEqual("Custom Title");
			expect(options.siteDescription).toEqual("Custom Description");
			expect(options.siteUrl).toEqual("https://custom-url.com");
			expect(options.sections).toEqual([
				{ name: "Custom Section", path: "custom-section" },
			]);
		});
	});

	describe("getters and setters", () => {
		let options: DoculaOptions;

		beforeEach(() => {
			options = new DoculaOptions();
		});

		it("should set and get the templatePath", () => {
			options.templatePath = "./custom-template";
			expect(options.templatePath).toEqual("./custom-template");
		});

		it("should set and get the output", () => {
			options.output = "./custom-dist";
			expect(options.output).toEqual("./custom-dist");
		});

		it("should set and get the sitePath", () => {
			options.sitePath = "./custom-site";
			expect(options.sitePath).toEqual("./custom-site");
		});

		it("should set and get the githubPath", () => {
			options.githubPath = "custom/repo";
			expect(options.githubPath).toEqual("custom/repo");
		});

		it("should set and get the siteTitle", () => {
			options.siteTitle = "Custom Title";
			expect(options.siteTitle).toEqual("Custom Title");
		});

		it("should set and get the siteDescription", () => {
			options.siteDescription = "Custom Description";
			expect(options.siteDescription).toEqual("Custom Description");
		});

		it("should set and get the siteUrl", () => {
			options.siteUrl = "https://custom-url.com";
			expect(options.siteUrl).toEqual("https://custom-url.com");
		});
	});

	describe("parseOptions", () => {
		let options: DoculaOptions;

		beforeEach(() => {
			options = new DoculaOptions();
		});

		it("should parse options and update the instance", () => {
			options.parseOptions({
				templatePath: "./custom-template",
				output: "./custom-dist",
				sitePath: "./custom-site",
				githubPath: "custom/repo",
				siteTitle: "Custom Title",
				siteDescription: "Custom Description",
				siteUrl: "https://custom-url.com",
				port: 8080,
			});
			expect(options.templatePath).toContain("/custom-template");
			expect(options.output).toContain("/custom-dist");
			expect(options.sitePath).toContain("/custom-site");
			expect(options.githubPath).toEqual("custom/repo");
			expect(options.siteTitle).toEqual("Custom Title");
			expect(options.siteDescription).toEqual("Custom Description");
			expect(options.siteUrl).toEqual("https://custom-url.com");
			expect(options.port).toEqual(8080);
		});

		it("should not overwrite githubPath when only output is provided", () => {
			const defaultGithubPath = options.githubPath;
			options.parseOptions({ output: "./custom-dist-only" });

			expect(options.output).toContain("/custom-dist-only");
			expect(options.githubPath).toEqual(defaultGithubPath);
		});

		it("should parse the template option", () => {
			options.parseOptions({ template: "modern" });
			expect(options.template).toEqual("modern");
		});

		it("should parse enableReleaseChangelog set to false", () => {
			options.parseOptions({ enableReleaseChangelog: false });
			expect(options.enableReleaseChangelog).toEqual(false);
		});

		it("should not update enableReleaseChangelog for non-boolean values", () => {
			options.parseOptions({ enableReleaseChangelog: "yes" });
			expect(options.enableReleaseChangelog).toEqual(true);
		});

		it("should parse changelogPerPage", () => {
			options.parseOptions({ changelogPerPage: 10 });
			expect(options.changelogPerPage).toEqual(10);
		});

		it("should not update changelogPerPage for non-number values", () => {
			options.parseOptions({ changelogPerPage: "ten" });
			expect(options.changelogPerPage).toEqual(20);
		});

		it("should not update changelogPerPage for zero or negative values", () => {
			options.parseOptions({ changelogPerPage: 0 });
			expect(options.changelogPerPage).toEqual(20);
			options.parseOptions({ changelogPerPage: -5 });
			expect(options.changelogPerPage).toEqual(20);
		});

		it("should parse enableLlmsTxt set to false", () => {
			options.parseOptions({ enableLlmsTxt: false });
			expect(options.enableLlmsTxt).toEqual(false);
		});

		it("should not update enableLlmsTxt for non-boolean values", () => {
			options.parseOptions({ enableLlmsTxt: "yes" });
			expect(options.enableLlmsTxt).toEqual(true);
		});

		it("should parse autoUpdateIgnores set to false", () => {
			options.parseOptions({ autoUpdateIgnores: false });
			expect(options.autoUpdateIgnores).toEqual(false);
		});

		it("should not update autoUpdateIgnores for non-boolean values", () => {
			options.parseOptions({ autoUpdateIgnores: "yes" });
			expect(options.autoUpdateIgnores).toEqual(true);
		});

		it("should parse autoReadme set to false", () => {
			options.parseOptions({ autoReadme: false });
			expect(options.autoReadme).toEqual(false);
		});

		it("should parse autoReadme set to true", () => {
			options.parseOptions({ autoReadme: true });
			expect(options.autoReadme).toEqual(true);
		});

		it("should not update autoReadme for non-boolean values", () => {
			options.parseOptions({ autoReadme: "yes" });
			expect(options.autoReadme).toEqual(true);
		});

		it("should parse quiet set to true", () => {
			options.parseOptions({ quiet: true });
			expect(options.quiet).toEqual(true);
		});

		it("should parse quiet set to false", () => {
			options.parseOptions({ quiet: false });
			expect(options.quiet).toEqual(false);
		});

		it("should not update quiet for non-boolean values", () => {
			options.parseOptions({ quiet: "yes" });
			expect(options.quiet).toEqual(false);
		});

		it("should parse ai with provider and apiKey", () => {
			options.parseOptions({
				ai: { provider: "anthropic", apiKey: "test-key" },
			});
			expect(options.ai).toEqual({
				provider: "anthropic",
				apiKey: "test-key",
			});
		});

		it("should parse ai with provider, apiKey, and model", () => {
			options.parseOptions({
				ai: {
					provider: "openai",
					apiKey: "test-key",
					model: "gpt-4o",
				},
			});
			expect(options.ai).toEqual({
				provider: "openai",
				apiKey: "test-key",
				model: "gpt-4o",
			});
		});

		it("should not set ai for invalid values", () => {
			options.parseOptions({ ai: "yes" });
			expect(options.ai).toBeUndefined();
		});

		it("should not set ai for object without provider", () => {
			options.parseOptions({ ai: { apiKey: "key" } });
			expect(options.ai).toBeUndefined();
		});

		it("should not set ai for object without apiKey", () => {
			options.parseOptions({ ai: { provider: "anthropic" } });
			expect(options.ai).toBeUndefined();
		});

		it("should parse themeMode set to light", () => {
			options.parseOptions({ themeMode: "light" });
			expect(options.themeMode).toEqual("light");
		});

		it("should parse themeMode set to dark", () => {
			options.parseOptions({ themeMode: "dark" });
			expect(options.themeMode).toEqual("dark");
		});

		it("should not update themeMode for invalid values", () => {
			options.parseOptions({ themeMode: "invalid" });
			expect(options.themeMode).toBeUndefined();
		});

		it("should not update themeMode for non-string values", () => {
			options.parseOptions({ themeMode: true });
			expect(options.themeMode).toBeUndefined();
		});

		it("should parse allowedAssets from options", () => {
			options.parseOptions({ allowedAssets: [".png", ".custom"] });
			expect(options.allowedAssets).toEqual([".png", ".custom"]);
		});

		it("should not update allowedAssets for non-array values", () => {
			const defaultExtensions = [...options.allowedAssets];
			options.parseOptions({ allowedAssets: "not-an-array" });
			expect(options.allowedAssets).toEqual(defaultExtensions);
		});

		it("should have default allowedAssets", () => {
			expect(options.allowedAssets).toContain(".png");
			expect(options.allowedAssets).toContain(".jpg");
			expect(options.allowedAssets).toContain(".pdf");
			expect(options.allowedAssets).toContain(".svg");
		});

		it("should parse googleTagManager with valid string", () => {
			options.parseOptions({ googleTagManager: "GTM-XXXXXX" });
			expect(options.googleTagManager).toEqual("GTM-XXXXXX");
		});

		it("should not set googleTagManager for non-string values", () => {
			options.parseOptions({ googleTagManager: 123 });
			expect(options.googleTagManager).toBeUndefined();
		});

		it("should not set googleTagManager for empty string", () => {
			options.parseOptions({ googleTagManager: "" });
			expect(options.googleTagManager).toBeUndefined();
		});

		it("should not set googleTagManager for invalid format", () => {
			options.parseOptions({ googleTagManager: "INVALID-123" });
			expect(options.googleTagManager).toBeUndefined();
		});

		it("should have googleTagManager undefined by default", () => {
			const freshOptions = new DoculaOptions();
			expect(freshOptions.googleTagManager).toBeUndefined();
		});

		it("should parse cookieAuth with loginUrl", () => {
			options.parseOptions({
				cookieAuth: { loginUrl: "/login" },
			});
			expect(options.cookieAuth).toEqual({ loginUrl: "/login" });
		});

		it("should parse cookieAuth with all options", () => {
			options.parseOptions({
				cookieAuth: {
					loginUrl: "/login",
					logoutUrl: "/logout",
					authCheckUrl: "https://api.example.com/me",
					authCheckMethod: "POST",
					authCheckUserPath: "email",
				},
			});
			expect(options.cookieAuth).toEqual({
				loginUrl: "/login",
				logoutUrl: "/logout",
				authCheckUrl: "https://api.example.com/me",
				authCheckMethod: "POST",
				authCheckUserPath: "email",
			});
		});

		it("should not set cookieAuth when loginUrl is missing", () => {
			options.parseOptions({
				cookieAuth: { authCheckUrl: "https://api.example.com/me" },
			});
			expect(options.cookieAuth).toBeUndefined();
		});

		it("should not set cookieAuth for non-object values", () => {
			options.parseOptions({ cookieAuth: "invalid" });
			expect(options.cookieAuth).toBeUndefined();
		});

		it("should not set cookieAuth for null", () => {
			options.parseOptions({ cookieAuth: null });
			expect(options.cookieAuth).toBeUndefined();
		});

		it("should have cookieAuth undefined by default", () => {
			const freshOptions = new DoculaOptions();
			expect(freshOptions.cookieAuth).toBeUndefined();
		});

		it("should parse headerLinks with valid entries", () => {
			options.parseOptions({
				headerLinks: [
					{ label: "Blog", url: "https://blog.example.com" },
					{ label: "Support", url: "https://support.example.com" },
				],
			});
			expect(options.headerLinks).toEqual([
				{ label: "Blog", url: "https://blog.example.com" },
				{ label: "Support", url: "https://support.example.com" },
			]);
		});

		it("should parse headerLinks with a single entry", () => {
			options.parseOptions({
				headerLinks: [{ label: "Blog", url: "https://blog.example.com" }],
			});
			expect(options.headerLinks).toEqual([
				{ label: "Blog", url: "https://blog.example.com" },
			]);
		});

		it("should not set headerLinks for non-array values", () => {
			options.parseOptions({ headerLinks: "invalid" });
			expect(options.headerLinks).toBeUndefined();
		});

		it("should not set headerLinks for null", () => {
			options.parseOptions({ headerLinks: null });
			expect(options.headerLinks).toBeUndefined();
		});

		it("should filter out invalid entries from headerLinks", () => {
			options.parseOptions({
				headerLinks: [
					{ label: "Blog", url: "https://blog.example.com" },
					{ label: 123, url: "https://bad.com" },
					{ label: "NoUrl" },
					"not-an-object",
					null,
				],
			});
			expect(options.headerLinks).toEqual([
				{ label: "Blog", url: "https://blog.example.com" },
			]);
		});

		it("should not set headerLinks when all entries are invalid", () => {
			options.parseOptions({
				headerLinks: [
					{ label: 123, url: "https://bad.com" },
					{ label: "NoUrl" },
				],
			});
			expect(options.headerLinks).toBeUndefined();
		});

		it("should parse headerLinks with optional icon property", () => {
			options.parseOptions({
				headerLinks: [
					{
						label: "Blog",
						url: "https://blog.example.com",
						icon: '<svg width="16" height="16"><circle cx="8" cy="8" r="8"/></svg>',
					},
				],
			});
			expect(options.headerLinks).toEqual([
				{
					label: "Blog",
					url: "https://blog.example.com",
					icon: '<svg width="16" height="16"><circle cx="8" cy="8" r="8"/></svg>',
				},
			]);
		});

		it("should parse headerLinks without icon using default", () => {
			options.parseOptions({
				headerLinks: [
					{ label: "Blog", url: "https://blog.example.com" },
					{
						label: "Support",
						url: "https://support.example.com",
						icon: '<svg width="16" height="16"><rect width="16" height="16"/></svg>',
					},
				],
			});
			expect(options.headerLinks?.[0].icon).toBeUndefined();
			expect(options.headerLinks?.[1].icon).toBe(
				'<svg width="16" height="16"><rect width="16" height="16"/></svg>',
			);
		});

		it("should have headerLinks undefined by default", () => {
			const freshOptions = new DoculaOptions();
			expect(freshOptions.headerLinks).toBeUndefined();
		});

		it("should have default cache with github.ttl of 3600", () => {
			const freshOptions = new DoculaOptions();
			expect(freshOptions.cache).toEqual({ github: { ttl: 3600 } });
		});

		it("should parse cache option with custom ttl", () => {
			options.parseOptions({
				cache: { github: { ttl: 7200 } },
			});
			expect(options.cache).toEqual({ github: { ttl: 7200 } });
		});

		it("should parse cache option with ttl of 0", () => {
			options.parseOptions({
				cache: { github: { ttl: 0 } },
			});
			expect(options.cache).toEqual({ github: { ttl: 0 } });
		});

		it("should not update cache for non-object values", () => {
			const defaultCache = { ...options.cache };
			options.parseOptions({ cache: "invalid" });
			expect(options.cache).toEqual(defaultCache);
		});

		it("should not update cache when github is missing", () => {
			const defaultCache = { ...options.cache };
			options.parseOptions({ cache: { other: true } });
			expect(options.cache).toEqual(defaultCache);
		});

		it("should not update cache when ttl is not a number", () => {
			const defaultCache = { ...options.cache };
			options.parseOptions({ cache: { github: { ttl: "invalid" } } });
			expect(options.cache).toEqual(defaultCache);
		});

		it("should have default baseUrl as empty string", () => {
			const freshOptions = new DoculaOptions();
			expect(freshOptions.baseUrl).toEqual("");
		});

		it("should have default docsPath as docs", () => {
			const freshOptions = new DoculaOptions();
			expect(freshOptions.docsPath).toEqual("docs");
		});

		it("should have default apiPath as api", () => {
			const freshOptions = new DoculaOptions();
			expect(freshOptions.apiPath).toEqual("api");
		});

		it("should have default changelogPath as changelog", () => {
			const freshOptions = new DoculaOptions();
			expect(freshOptions.changelogPath).toEqual("changelog");
		});

		it("should parse baseUrl", () => {
			options.parseOptions({ baseUrl: "/docs" });
			expect(options.baseUrl).toEqual("/docs");
		});

		it("should strip trailing slashes from baseUrl", () => {
			options.parseOptions({ baseUrl: "/docs/" });
			expect(options.baseUrl).toEqual("/docs");
		});

		it("should parse docsPath", () => {
			options.parseOptions({ docsPath: "documentation" });
			expect(options.docsPath).toEqual("documentation");
		});

		it("should strip leading and trailing slashes from docsPath", () => {
			options.parseOptions({ docsPath: "/documentation/" });
			expect(options.docsPath).toEqual("documentation");
		});

		it("should allow empty string for docsPath", () => {
			options.parseOptions({ docsPath: "" });
			expect(options.docsPath).toEqual("");
		});

		it("should parse apiPath", () => {
			options.parseOptions({ apiPath: "reference" });
			expect(options.apiPath).toEqual("reference");
		});

		it("should strip leading and trailing slashes from apiPath", () => {
			options.parseOptions({ apiPath: "/reference/" });
			expect(options.apiPath).toEqual("reference");
		});

		it("should parse changelogPath", () => {
			options.parseOptions({ changelogPath: "releases" });
			expect(options.changelogPath).toEqual("releases");
		});

		it("should strip leading and trailing slashes from changelogPath", () => {
			options.parseOptions({ changelogPath: "/releases/" });
			expect(options.changelogPath).toEqual("releases");
		});

		it("should not update baseUrl for non-string values", () => {
			options.parseOptions({ baseUrl: 123 });
			expect(options.baseUrl).toEqual("");
		});

		it("should have homeUrl undefined by default", () => {
			const freshOptions = new DoculaOptions();
			expect(freshOptions.homeUrl).toBeUndefined();
		});

		it("should parse homeUrl", () => {
			options.parseOptions({ homeUrl: "/" });
			expect(options.homeUrl).toEqual("/");
		});

		it("should strip trailing slashes from homeUrl", () => {
			options.parseOptions({ homeUrl: "https://example.com/" });
			expect(options.homeUrl).toEqual("https://example.com");
		});

		it("should not update homeUrl for non-string values", () => {
			options.parseOptions({ homeUrl: 123 });
			expect(options.homeUrl).toBeUndefined();
		});

		it("should not update docsPath for non-string values", () => {
			options.parseOptions({ docsPath: 123 });
			expect(options.docsPath).toEqual("docs");
		});

		it("should not update apiPath for non-string values", () => {
			options.parseOptions({ apiPath: 123 });
			expect(options.apiPath).toEqual("api");
		});

		it("should not update changelogPath for non-string values", () => {
			options.parseOptions({ changelogPath: 123 });
			expect(options.changelogPath).toEqual("changelog");
		});

		it("should have editPageUrl undefined by default", () => {
			const freshOptions = new DoculaOptions();
			expect(freshOptions.editPageUrl).toBeUndefined();
		});

		it("should parse editPageUrl", () => {
			options.parseOptions({
				editPageUrl: "https://github.com/owner/repo/edit/main/site/docs",
			});
			expect(options.editPageUrl).toEqual(
				"https://github.com/owner/repo/edit/main/site/docs",
			);
		});

		it("should strip trailing slashes from editPageUrl", () => {
			options.parseOptions({
				editPageUrl: "https://github.com/owner/repo/edit/main/site/docs/",
			});
			expect(options.editPageUrl).toEqual(
				"https://github.com/owner/repo/edit/main/site/docs",
			);
		});

		it("should not update editPageUrl for non-string values", () => {
			options.parseOptions({ editPageUrl: 123 });
			expect(options.editPageUrl).toBeUndefined();
		});

		it("should allow empty string for editPageUrl", () => {
			options.parseOptions({ editPageUrl: "" });
			expect(options.editPageUrl).toEqual("");
		});
	});

	describe("openGraph", () => {
		let options: DoculaOptions;

		beforeEach(() => {
			options = new DoculaOptions();
		});

		it("should have openGraph undefined by default", () => {
			const freshOptions = new DoculaOptions();
			expect(freshOptions.openGraph).toBeUndefined();
		});

		it("should parse openGraph with all fields", () => {
			options.parseOptions({
				openGraph: {
					title: "My Site",
					description: "A great site",
					image: "https://example.com/image.png",
					url: "https://example.com",
					type: "article",
					siteName: "Example",
					twitterCard: "summary_large_image",
				},
			});
			expect(options.openGraph).toEqual({
				title: "My Site",
				description: "A great site",
				image: "https://example.com/image.png",
				url: "https://example.com",
				type: "article",
				siteName: "Example",
				twitterCard: "summary_large_image",
			});
		});

		it("should parse openGraph with partial fields", () => {
			options.parseOptions({
				openGraph: { title: "My Site" },
			});
			expect(options.openGraph).toEqual({ title: "My Site" });
		});

		it("should parse openGraph with empty object", () => {
			options.parseOptions({
				openGraph: {},
			});
			expect(options.openGraph).toEqual({});
		});

		it("should not set openGraph for non-object values", () => {
			options.parseOptions({ openGraph: "invalid" });
			expect(options.openGraph).toBeUndefined();
		});

		it("should not set openGraph for null", () => {
			options.parseOptions({ openGraph: null });
			expect(options.openGraph).toBeUndefined();
		});

		it("should not set openGraph for array values", () => {
			options.parseOptions({ openGraph: ["invalid"] });
			expect(options.openGraph).toBeUndefined();
		});
	});
});
