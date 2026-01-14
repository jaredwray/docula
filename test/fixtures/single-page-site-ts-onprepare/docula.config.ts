import type { DoculaOptions } from "../../../src/options.js";

export const options: Partial<DoculaOptions> = {
	templatePath: "./template",
	githubPath: "jaredwray/docula",
	sitePath: "../single-page-site-ts-onprepare",
	outputPath: "../single-page-site-ts-onprepare/dist",
	siteTitle: "docula",
	siteDescription: "Beautiful Website for Your Projects",
	siteUrl: "https://docula.org",
};

export const onPrepare = async (): Promise<void> => {
	console.info("onPrepare TypeScript");
};
