import { beforeEach, describe, expect, it } from "vitest";
import { DoculaOptions } from "../src/options.js";

describe("DoculaOptions", () => {
	describe("constructor", () => {
		it("should create an instance of DoculaOptions with default values", () => {
			const options = new DoculaOptions();
			expect(options.template).toEqual("modern");
			expect(options.templatePath).toEqual("");
			expect(options.outputPath).toContain("/dist");
			expect(options.sitePath).toContain("/site");
			expect(options.githubPath).toEqual("jaredwray/docula");
			expect(options.siteTitle).toEqual("docula");
			expect(options.siteDescription).toEqual(
				"Beautiful Website for Your Projects",
			);
			expect(options.siteUrl).toEqual("https://docula.org");
			expect(options.singlePage).toEqual(true);
			expect(options.enableReleaseChangelog).toEqual(true);
			expect(options.homePage).toEqual(true);
			expect(options.enableLlmsTxt).toEqual(true);
		});

		it("should create an instance of DoculaOptions with custom values", () => {
			const options = new DoculaOptions({
				templatePath: "./custom-template",
				outputPath: "./custom-dist",
				sitePath: "./custom-site",
				githubPath: "custom/repo",
				siteTitle: "Custom Title",
				siteDescription: "Custom Description",
				siteUrl: "https://custom-url.com",
				singlePage: false,
				sections: [{ name: "Custom Section", path: "custom-section" }],
			});
			expect(options.templatePath).toContain("/custom-template");
			expect(options.outputPath).toContain("/custom-dist");
			expect(options.sitePath).toContain("/custom-site");
			expect(options.githubPath).toEqual("custom/repo");
			expect(options.siteTitle).toEqual("Custom Title");
			expect(options.siteDescription).toEqual("Custom Description");
			expect(options.siteUrl).toEqual("https://custom-url.com");
			expect(options.singlePage).toEqual(false);
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

		it("should set and get the outputPath", () => {
			options.outputPath = "./custom-dist";
			expect(options.outputPath).toEqual("./custom-dist");
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
				outputPath: "./custom-dist",
				sitePath: "./custom-site",
				githubPath: "custom/repo",
				siteTitle: "Custom Title",
				siteDescription: "Custom Description",
				siteUrl: "https://custom-url.com",
				port: 8080,
			});
			expect(options.templatePath).toContain("/custom-template");
			expect(options.outputPath).toContain("/custom-dist");
			expect(options.sitePath).toContain("/custom-site");
			expect(options.githubPath).toEqual("custom/repo");
			expect(options.siteTitle).toEqual("Custom Title");
			expect(options.siteDescription).toEqual("Custom Description");
			expect(options.siteUrl).toEqual("https://custom-url.com");
			expect(options.port).toEqual(8080);
		});

		it("should not overwrite githubPath when only outputPath is provided", () => {
			const defaultGithubPath = options.githubPath;
			options.parseOptions({ outputPath: "./custom-dist-only" });

			expect(options.outputPath).toContain("/custom-dist-only");
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

		it("should parse homePage set to false", () => {
			options.parseOptions({ homePage: false });
			expect(options.homePage).toEqual(false);
		});

		it("should not update homePage for non-boolean values", () => {
			options.parseOptions({ homePage: "yes" });
			expect(options.homePage).toEqual(true);
		});

		it("should parse enableLlmsTxt set to false", () => {
			options.parseOptions({ enableLlmsTxt: false });
			expect(options.enableLlmsTxt).toEqual(false);
		});

		it("should not update enableLlmsTxt for non-boolean values", () => {
			options.parseOptions({ enableLlmsTxt: "yes" });
			expect(options.enableLlmsTxt).toEqual(true);
		});
	});
});
