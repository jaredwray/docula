import fs from "node:fs";
import { Writr, type WritrOptions } from "writr";
import {
	getSafeLocalOpenApiSpec,
	getSafeSiteOverrideFileContent,
	resolveOpenApiSpecUrl,
} from "./builder-api.js";
import type { DoculaData } from "./builder-types.js";
import {
	buildAbsoluteSiteUrl,
	normalizePathForUrl,
	toPosixPath,
} from "./builder-utils.js";
import type { DoculaConsole } from "./console.js";
import type { DoculaOptions } from "./options.js";

const writrOptions: WritrOptions = {
	throwOnEmitError: false,
	throwOnEmptyListeners: false,
};

export async function buildLlmsFiles(
	options: DoculaOptions,
	console: DoculaConsole,
	data: DoculaData,
): Promise<void> {
	if (!options.enableLlmsTxt) {
		return;
	}

	await fs.promises.mkdir(data.output, { recursive: true });

	const llmsOutputPath = `${data.output}/llms.txt`;
	const llmsFullOutputPath = `${data.output}/llms-full.txt`;
	const llmsOverrideContent = await getSafeSiteOverrideFileContent(
		data.sitePath,
		"llms.txt",
	);
	const llmsFullOverrideContent = await getSafeSiteOverrideFileContent(
		data.sitePath,
		"llms-full.txt",
	);

	if (llmsOverrideContent !== undefined) {
		await fs.promises.writeFile(llmsOutputPath, llmsOverrideContent, "utf8");
	} else {
		const llmsContent = generateLlmsIndexContent(data);
		await fs.promises.writeFile(llmsOutputPath, llmsContent, "utf8");
	}

	console.fileBuilt("llms.txt");

	if (llmsFullOverrideContent !== undefined) {
		await fs.promises.writeFile(
			llmsFullOutputPath,
			llmsFullOverrideContent,
			"utf8",
		);
	} else {
		const llmsFullContent = await generateLlmsFullContent(data);
		await fs.promises.writeFile(llmsFullOutputPath, llmsFullContent, "utf8");
	}

	console.fileBuilt("llms-full.txt");
}

export function generateLlmsIndexContent(data: DoculaData): string {
	const lines: string[] = [];
	const documents = data.documents ?? [];
	const changelogEntries = data.changelogEntries ?? [];

	lines.push(`# ${data.siteTitle}`);
	lines.push("");
	lines.push(data.siteDescription);
	lines.push("");
	lines.push(
		`- [Full LLM Content](${buildAbsoluteSiteUrl(data.siteUrl, `${data.baseUrl}/llms-full.txt`)})`,
	);
	lines.push("");
	lines.push("## Documentation");

	if (documents.length > 0) {
		for (const document of documents) {
			const documentUrl = buildAbsoluteSiteUrl(
				data.siteUrl,
				`${data.baseUrl}${normalizePathForUrl(document.urlPath)}`,
			);
			const description = document.description
				? ` - ${document.description}`
				: "";
			lines.push(`- [${document.navTitle}](${documentUrl})${description}`);
		}
	} else {
		lines.push("- Not available.");
	}

	lines.push("");
	lines.push("## API Reference");
	if (data.hasApi) {
		lines.push(
			`- [API Documentation](${buildAbsoluteSiteUrl(data.siteUrl, data.apiUrl)})`,
		);
	} else {
		lines.push("- Not available.");
	}

	lines.push("");
	lines.push("## Changelog");
	if (data.hasChangelog) {
		lines.push(
			`- [Changelog](${buildAbsoluteSiteUrl(data.siteUrl, data.changelogUrl)})`,
		);
		for (const entry of changelogEntries.slice(0, 20)) {
			/* v8 ignore next -- @preserve */
			const date = entry.formattedDate || entry.date || "No date";
			lines.push(
				`- [${entry.title}](${buildAbsoluteSiteUrl(data.siteUrl, `${data.changelogUrl}/${entry.slug}`)}) (${date})`,
			);
		}
	} else {
		lines.push("- Not available.");
	}

	lines.push("");

	return lines.join("\n");
}

export async function generateLlmsFullContent(
	data: DoculaData,
): Promise<string> {
	const lines: string[] = [];
	const documents = data.documents ?? [];
	const changelogEntries = data.changelogEntries ?? [];

	lines.push(`# ${data.siteTitle}`);
	lines.push("");
	lines.push(data.siteDescription);
	lines.push("");
	lines.push(
		`Source Index: ${buildAbsoluteSiteUrl(data.siteUrl, `${data.baseUrl}/llms.txt`)}`,
	);
	lines.push("");
	lines.push("## Documentation");

	if (documents.length > 0) {
		for (const document of documents) {
			const documentUrl = buildAbsoluteSiteUrl(
				data.siteUrl,
				`${data.baseUrl}${normalizePathForUrl(document.urlPath)}`,
			);
			const markdownBody = new Writr(
				document.content,
				writrOptions,
			).body.trim();

			lines.push("");
			lines.push(`### ${document.navTitle}`);
			lines.push(`URL: ${documentUrl}`);
			if (document.description) {
				lines.push(`Description: ${document.description}`);
			}
			lines.push("");
			/* v8 ignore next -- @preserve */
			lines.push(markdownBody || "_No content_");
		}
	} else {
		lines.push("- Not available.");
	}

	lines.push("");
	lines.push("## API Reference");
	if (data.hasApi) {
		lines.push(`URL: ${buildAbsoluteSiteUrl(data.siteUrl, data.apiUrl)}`);
		lines.push("");

		const localOpenApiSpec = await getSafeLocalOpenApiSpec(data);
		if (localOpenApiSpec) {
			lines.push(
				`OpenAPI Spec Source: ${toPosixPath(localOpenApiSpec.sourcePath)}`,
			);
			lines.push("");
			/* v8 ignore next -- @preserve */
			lines.push(localOpenApiSpec.content || "_No content_");
		} else {
			const openApiSpecUrl = resolveOpenApiSpecUrl(data);
			if (openApiSpecUrl) {
				lines.push(`OpenAPI Spec URL: ${openApiSpecUrl}`);
			}
		}
	} else {
		lines.push("- Not available.");
	}

	lines.push("");
	lines.push("## Changelog");
	if (data.hasChangelog && changelogEntries.length > 0) {
		lines.push(`URL: ${buildAbsoluteSiteUrl(data.siteUrl, data.changelogUrl)}`);

		for (const entry of changelogEntries) {
			lines.push("");
			lines.push(`### ${entry.title}`);
			lines.push(
				`URL: ${buildAbsoluteSiteUrl(data.siteUrl, `${data.changelogUrl}/${entry.slug}`)}`,
			);
			/* v8 ignore next 2 -- @preserve */
			if (entry.formattedDate || entry.date) {
				lines.push(`Date: ${entry.formattedDate || entry.date}`);
			}
			if (entry.tag) {
				lines.push(`Tag: ${entry.tag}`);
			}
			lines.push("");
			lines.push(entry.content.trim() || "_No content_");
		}
	} else {
		lines.push("- Not available.");
	}

	lines.push("");

	return lines.join("\n");
}
