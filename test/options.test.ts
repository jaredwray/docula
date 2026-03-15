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

		it("should log deprecation warning when homePage is provided", () => {
			const consoleWarn = console.warn;
			let warnMessage = "";
			console.warn = (message: string) => {
				warnMessage = message;
			};

			options.parseOptions({ homePage: false });
			expect(warnMessage).toContain("homePage");
			expect(warnMessage).toContain("deprecated");
			console.warn = consoleWarn;
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
					cookieName: "auth_token",
					logoutUrl: "/logout",
				},
			});
			expect(options.cookieAuth).toEqual({
				loginUrl: "/login",
				cookieName: "auth_token",
				logoutUrl: "/logout",
			});
		});

		it("should not set cookieAuth when loginUrl is missing", () => {
			options.parseOptions({
				cookieAuth: { cookieName: "token" },
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
	});
});
