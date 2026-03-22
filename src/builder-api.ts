import fs from "node:fs";
import path from "node:path";
import type { Ecto } from "ecto";
import { Writr, type WritrOptions } from "writr";
import { type ApiSpecData, parseOpenApiSpec } from "./api-parser.js";
import { resolveJsonLd, resolveOpenGraphData } from "./builder-seo.js";
import type { DoculaData } from "./builder-types.js";
import {
	buildAbsoluteSiteUrl,
	isPathWithinBasePath,
	isRemoteUrl,
} from "./builder-utils.js";

const writrOptions: WritrOptions = {
	throwOnEmitError: false,
	throwOnEmptyListeners: false,
};

export function resolveOpenApiSpecUrl(data: DoculaData): string | undefined {
	if (!data.openApiUrl) {
		return undefined;
	}

	if (isRemoteUrl(data.openApiUrl)) {
		return data.openApiUrl;
	}

	const normalizedPath = data.openApiUrl.startsWith("/")
		? data.openApiUrl
		: `/${data.openApiUrl}`;
	return buildAbsoluteSiteUrl(data.siteUrl, normalizedPath);
}

export function resolveLocalOpenApiPath(data: DoculaData): string | undefined {
	if (!data.openApiUrl || isRemoteUrl(data.openApiUrl)) {
		return undefined;
	}

	const openApiPathWithoutQuery = data.openApiUrl.split(/[?#]/)[0];
	if (!openApiPathWithoutQuery) {
		return undefined;
	}

	const normalizedPath = openApiPathWithoutQuery.startsWith("/")
		? openApiPathWithoutQuery.slice(1)
		: openApiPathWithoutQuery;
	return path.join(data.sitePath, normalizedPath);
}

export async function getSafeSiteOverrideFileContent(
	sitePath: string,
	fileName: "llms.txt" | "llms-full.txt",
): Promise<string | undefined> {
	const resolvedSitePath = path.resolve(sitePath);
	const candidatePath = path.resolve(sitePath, fileName);

	if (!isPathWithinBasePath(candidatePath, resolvedSitePath)) {
		return undefined;
	}

	let candidateStats: fs.Stats;
	try {
		candidateStats = await fs.promises.lstat(candidatePath);
	} catch {
		return undefined;
	}

	// Do not follow symbolic links for site-level llms override files.
	if (!candidateStats.isFile() || candidateStats.isSymbolicLink()) {
		return undefined;
	}

	let realSitePath: string;
	let realCandidatePath: string;
	try {
		realSitePath = await fs.promises.realpath(resolvedSitePath);
		realCandidatePath = await fs.promises.realpath(candidatePath);
	} catch {
		return undefined;
	}

	if (!isPathWithinBasePath(realCandidatePath, realSitePath)) {
		return undefined;
	}

	return fs.promises.readFile(realCandidatePath, "utf8");
}

export async function getSafeLocalOpenApiSpec(
	data: DoculaData,
): Promise<{ sourcePath: string; content: string } | undefined> {
	const localOpenApiPath = resolveLocalOpenApiPath(data);
	if (!localOpenApiPath) {
		return undefined;
	}

	const resolvedSitePath = path.resolve(data.sitePath);
	const resolvedLocalOpenApiPath = path.resolve(localOpenApiPath);

	if (!isPathWithinBasePath(resolvedLocalOpenApiPath, resolvedSitePath)) {
		return undefined;
	}

	let localOpenApiStats: fs.Stats;
	try {
		localOpenApiStats = await fs.promises.lstat(resolvedLocalOpenApiPath);
	} catch {
		return undefined;
	}

	// Do not follow symbolic links for local OpenAPI spec ingestion.
	if (!localOpenApiStats.isFile() || localOpenApiStats.isSymbolicLink()) {
		return undefined;
	}

	let realSitePath: string;
	let realLocalOpenApiPath: string;
	try {
		realSitePath = await fs.promises.realpath(resolvedSitePath);
		realLocalOpenApiPath = await fs.promises.realpath(resolvedLocalOpenApiPath);
	} catch {
		return undefined;
	}

	if (!isPathWithinBasePath(realLocalOpenApiPath, realSitePath)) {
		return undefined;
	}

	const localOpenApiContent = (
		await fs.promises.readFile(realLocalOpenApiPath, "utf8")
	).trim();
	return {
		sourcePath: realLocalOpenApiPath,
		content: localOpenApiContent,
	};
}

export async function renderApiContent(
	ecto: Ecto,
	data: DoculaData,
): Promise<string> {
	if (!data.openApiUrl || !data.templates?.api) {
		throw new Error("No API template or openApiUrl found");
	}

	// Copy swagger.json to output if it exists in the site directory
	const swaggerSource = `${data.sitePath}/api/swagger.json`;
	const apiOutputPath = `${data.output}/${data.apiPath}`;
	await fs.promises.mkdir(apiOutputPath, { recursive: true });
	if (fs.existsSync(swaggerSource)) {
		await fs.promises.copyFile(swaggerSource, `${apiOutputPath}/swagger.json`);
	}

	// Parse the OpenAPI spec for native rendering
	let apiSpec: ApiSpecData | undefined;
	const localSpec = await getSafeLocalOpenApiSpec(data);
	if (localSpec) {
		apiSpec = parseOpenApiSpec(localSpec.content);
		/* v8 ignore next 9 -- @preserve */
	} else if (data.openApiUrl && isRemoteUrl(data.openApiUrl)) {
		try {
			const response = await fetch(data.openApiUrl);
			const specContent = await response.text();
			apiSpec = parseOpenApiSpec(specContent);
		} catch {
			// If remote fetch fails, render page without parsed spec
		}
	}

	// Render Markdown descriptions to HTML
	/* v8 ignore next -- @preserve */
	if (apiSpec) {
		apiSpec.info.description = new Writr(
			apiSpec.info.description,
			writrOptions,
		).renderSync();
		for (const group of apiSpec.groups) {
			group.description = new Writr(
				group.description,
				writrOptions,
			).renderSync();
			for (const op of group.operations) {
				op.description = new Writr(op.description, writrOptions).renderSync();
			}
		}
	}

	const apiTemplate = `${data.templatePath}/${data.templates.api}`;
	return ecto.renderFromFile(
		apiTemplate,
		{
			...data,
			specUrl: data.openApiUrl,
			apiSpec,
			...resolveOpenGraphData(data, `/${data.apiPath}/`),
			jsonLd: resolveJsonLd("api", data, `/${data.apiPath}/`),
		},
		data.templatePath,
	);
}

export async function buildApiPage(
	ecto: Ecto,
	data: DoculaData,
): Promise<void> {
	if (!data.openApiUrl || !data.templates?.api) {
		return;
	}

	const apiPath = `${data.output}/${data.apiPath}/index.html`;
	const apiContent = await renderApiContent(ecto, data);
	await fs.promises.writeFile(apiPath, apiContent, "utf8");
}

export async function buildApiHomePage(
	ecto: Ecto,
	data: DoculaData,
): Promise<void> {
	const indexPath = `${data.output}/index.html`;
	await fs.promises.mkdir(data.output, { recursive: true });
	const apiContent = await renderApiContent(ecto, data);
	await fs.promises.writeFile(indexPath, apiContent, "utf8");
}
