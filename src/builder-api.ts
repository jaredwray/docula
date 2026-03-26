import fs from "node:fs";
import path from "node:path";
import type { Ecto } from "ecto";
import { Writr, type WritrOptions } from "writr";
import { type ApiSpecData, parseOpenApiSpec } from "./api-parser.js";
import { resolveJsonLd, resolveOpenGraphData } from "./builder-seo.js";
import {
	buildAbsoluteSiteUrl,
	buildUrlPath,
	isPathWithinBasePath,
	isRemoteUrl,
} from "./builder-utils.js";
import type { DoculaData, DoculaOpenApiSpecEntry } from "./types.js";

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
	if (!data.openApiUrl) {
		return undefined;
	}

	return resolveLocalOpenApiPathForSpec(data, data.openApiUrl);
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
	if (!data.openApiUrl) {
		return undefined;
	}

	return getSafeLocalOpenApiSpecForSpec(data, data.openApiUrl);
}

export function resolveLocalOpenApiPathForSpec(
	data: DoculaData,
	specUrl: string,
): string | undefined {
	if (isRemoteUrl(specUrl)) {
		return undefined;
	}

	const urlWithoutQuery = specUrl.split(/[?#]/)[0];
	/* v8 ignore next 3 -- @preserve */
	if (!urlWithoutQuery) {
		return undefined;
	}

	const normalizedPath = urlWithoutQuery.startsWith("/")
		? urlWithoutQuery.slice(1)
		: urlWithoutQuery;
	return path.join(data.sitePath, normalizedPath);
}

export async function getSafeLocalOpenApiSpecForSpec(
	data: DoculaData,
	specUrl: string,
): Promise<{ sourcePath: string; content: string } | undefined> {
	const localPath = resolveLocalOpenApiPathForSpec(data, specUrl);
	if (!localPath) {
		return undefined;
	}

	const resolvedSitePath = path.resolve(data.sitePath);
	const resolvedLocalPath = path.resolve(localPath);

	if (!isPathWithinBasePath(resolvedLocalPath, resolvedSitePath)) {
		return undefined;
	}

	let localStats: fs.Stats;
	try {
		localStats = await fs.promises.lstat(resolvedLocalPath);
		/* v8 ignore next 3 -- @preserve */
	} catch {
		return undefined;
	}

	if (!localStats.isFile() || localStats.isSymbolicLink()) {
		return undefined;
	}

	let realSitePath: string;
	let realLocalPath: string;
	try {
		realSitePath = await fs.promises.realpath(resolvedSitePath);
		realLocalPath = await fs.promises.realpath(resolvedLocalPath);
		/* v8 ignore next 3 -- @preserve */
	} catch {
		return undefined;
	}

	if (!isPathWithinBasePath(realLocalPath, realSitePath)) {
		return undefined;
	}

	const content = (await fs.promises.readFile(realLocalPath, "utf8")).trim();
	return { sourcePath: realLocalPath, content };
}

export function resolveSpecUrl(data: DoculaData, specUrl: string): string {
	if (isRemoteUrl(specUrl)) {
		return specUrl;
	}

	const normalizedPath = specUrl.startsWith("/") ? specUrl : `/${specUrl}`;
	return buildAbsoluteSiteUrl(data.siteUrl, normalizedPath);
}

async function parseAndRenderSpec(
	data: DoculaData,
	specUrl: string,
): Promise<ApiSpecData | undefined> {
	let apiSpec: ApiSpecData | undefined;
	const localSpec = await getSafeLocalOpenApiSpecForSpec(data, specUrl);
	if (localSpec) {
		apiSpec = parseOpenApiSpec(localSpec.content);
		/* v8 ignore next 9 -- @preserve */
	} else if (isRemoteUrl(specUrl)) {
		try {
			const response = await fetch(specUrl);
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

	return apiSpec;
}

async function copySpecSourceFile(
	data: DoculaData,
	specUrl: string,
	outputDir: string,
): Promise<void> {
	// Use the safe spec resolver to validate the path (prevents traversal/symlink attacks)
	const safeSpec = await getSafeLocalOpenApiSpecForSpec(data, specUrl);
	if (safeSpec) {
		await fs.promises.mkdir(outputDir, { recursive: true });
		await fs.promises.copyFile(
			safeSpec.sourcePath,
			`${outputDir}/swagger.json`,
		);
	}
}

export async function renderApiContentForSpec(
	ecto: Ecto,
	data: DoculaData,
	spec: DoculaOpenApiSpecEntry,
): Promise<string> {
	if (!data.templates?.api) {
		throw new Error("No API template found");
	}

	const specOutputPath = spec.path
		? `${data.output}/${data.apiPath}/${spec.path}`
		: `${data.output}/${data.apiPath}`;
	await copySpecSourceFile(data, spec.url, specOutputPath);

	const apiSpec = await parseAndRenderSpec(data, spec.url);

	const specUrlPath = spec.path
		? buildUrlPath(data.apiPath, spec.path)
		: data.apiPath;

	const resolvedSpecUrl = resolveSpecUrl(data, spec.url);

	const allApiSpecs = (data.allApiSpecs ?? []).map((s) => ({
		...s,
		active: s.path === spec.path,
	}));

	const apiTemplate = `${data.templatePath}/${data.templates.api}`;
	return ecto.renderFromFile(
		apiTemplate,
		{
			...data,
			specUrl: resolvedSpecUrl,
			apiSpec,
			specName: spec.name,
			allApiSpecs,
			multipleApiSpecs: allApiSpecs.length > 1,
			...resolveOpenGraphData(data, `/${specUrlPath}/`),
			jsonLd: resolveJsonLd("api", data, `/${specUrlPath}/`),
		},
		data.templatePath,
	);
}

export async function buildAllApiPages(
	ecto: Ecto,
	data: DoculaData,
): Promise<void> {
	if (
		!data.openApiSpecs ||
		data.openApiSpecs.length === 0 ||
		!data.templates?.api
	) {
		return;
	}

	for (const spec of data.openApiSpecs) {
		const outputDir = spec.path
			? `${data.output}/${data.apiPath}/${spec.path}`
			: `${data.output}/${data.apiPath}`;
		await fs.promises.mkdir(outputDir, { recursive: true });
		const content = await renderApiContentForSpec(ecto, data, spec);
		await fs.promises.writeFile(`${outputDir}/index.html`, content, "utf8");
	}
}

export async function renderApiContent(
	ecto: Ecto,
	data: DoculaData,
): Promise<string> {
	if (!data.openApiUrl || !data.templates?.api) {
		throw new Error("No API template or openApiUrl found");
	}

	// When openApiSpecs is populated, render the first spec
	if (data.openApiSpecs && data.openApiSpecs.length > 0) {
		return renderApiContentForSpec(ecto, data, data.openApiSpecs[0]);
	}

	// Legacy fallback: copy swagger.json to output if it exists in the site directory
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
