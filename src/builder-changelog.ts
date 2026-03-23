import fs from "node:fs";
import path from "node:path";
import type { Ecto } from "ecto";
import type { Hashery } from "hashery";
import { Writr, type WritrOptions } from "writr";
import { hashFile } from "./builder-cache.js";
import { resolveJsonLd, resolveOpenGraphData } from "./builder-seo.js";
import { buildAbsoluteSiteUrl, buildUrlPath } from "./builder-utils.js";
import type { DoculaOptions } from "./options.js";
import type { DoculaChangelogEntry, DoculaData } from "./types.js";

const writrOptions: WritrOptions = {
	throwOnEmitError: false,
	throwOnEmptyListeners: false,
};

export function getChangelogEntries(
	changelogPath: string,
	options: DoculaOptions,
	hash: Hashery,
	cachedEntries?: Map<string, DoculaChangelogEntry>,
	previousHashes?: Record<string, string>,
	currentHashes?: Record<string, string>,
): DoculaChangelogEntry[] {
	const entries: DoculaChangelogEntry[] = [];
	if (!fs.existsSync(changelogPath)) {
		return entries;
	}

	const files = fs.readdirSync(changelogPath);
	for (const file of files) {
		const filePath = `${changelogPath}/${file}`;
		const stats = fs.statSync(filePath);
		if (stats.isFile() && (file.endsWith(".md") || file.endsWith(".mdx"))) {
			// Check if we can use cached parsed entry
			if (cachedEntries && previousHashes && currentHashes) {
				const slug = path.basename(file, path.extname(file));
				/* v8 ignore next -- @preserve */
				const entryHash = currentHashes[file] ?? hashFile(hash, filePath);
				const prevHash = previousHashes[file];
				const cached = cachedEntries.get(slug);
				if (cached && prevHash === entryHash) {
					entries.push(cached);
					continue;
				}
			}

			const entry = parseChangelogEntry(filePath, options);
			entries.push(entry);
		}
	}

	// Sort by date descending (newest first), invalid dates go to the end
	entries.sort((a, b) => {
		const dateA = new Date(a.date).getTime();
		const dateB = new Date(b.date).getTime();
		if (Number.isNaN(dateA) && Number.isNaN(dateB)) {
			return 0;
		}

		if (Number.isNaN(dateA)) {
			return 1;
		}

		if (Number.isNaN(dateB)) {
			return -1;
		}

		return dateB - dateA;
	});

	return entries;
}

export function parseChangelogEntry(
	filePath: string,
	options: DoculaOptions,
): DoculaChangelogEntry {
	const fileContent = fs.readFileSync(filePath, "utf8");
	const writr = new Writr(fileContent, writrOptions);
	const matterData = writr.frontMatter;
	const markdownContent = writr.body;

	const fileName = path.basename(filePath, path.extname(filePath));
	const slug = fileName;

	const isMdx = filePath.endsWith(".mdx");

	const tag = matterData.tag as string | undefined;
	const tagClass = tag ? tag.toLowerCase().replace(/\s+/g, "-") : undefined;

	// Handle date as Date object or string
	let dateString = "";
	if (matterData.date instanceof Date) {
		dateString = matterData.date.toISOString().split("T")[0];
	} else if (matterData.date) {
		dateString = String(matterData.date);
	}

	// Format date for display; fall back to raw string for unparseable dates
	let formattedDate = dateString;
	const parsedDate = new Date(dateString);
	if (!Number.isNaN(parsedDate.getTime())) {
		formattedDate = parsedDate.toLocaleDateString("en-US", {
			year: "numeric",
			month: "long",
			day: "numeric",
		});
	}

	const previewImage = matterData.previewImage as string | undefined;

	return {
		title: matterData.title ?? fileName,
		date: dateString,
		formattedDate,
		tag,
		tagClass,
		slug,
		content: markdownContent,
		generatedHtml: new Writr(markdownContent, writrOptions).renderSync({
			mdx: isMdx,
		}),
		preview: generateChangelogPreview(markdownContent, 500, isMdx),
		previewImage,
		urlPath: `${buildUrlPath(options.baseUrl, options.changelogPath, slug)}/index.html`,
		lastModified: fs.statSync(filePath).mtime.toISOString().split("T")[0],
	};
}

export function generateChangelogPreview(
	markdown: string,
	maxLength = 500,
	mdx = false,
): string {
	const minLength = 300;

	// Step 1: Strip markdown headings
	let cleaned = markdown
		.split("\n")
		.filter((line) => !/^#{1,6}\s/.test(line))
		.join("\n");

	// Step 2: Strip leading blank lines
	cleaned = cleaned.replace(/^\n+/, "");

	// Step 3: Clean up link syntax — remove images, convert links to text
	cleaned = cleaned.replace(/!\[[^\]]*\]\([^)]*\)/g, "");
	cleaned = cleaned.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1");

	// Strip leading blank lines after image removal
	cleaned = cleaned.replace(/^\n+/, "").trim();

	if (cleaned.length <= minLength) {
		return new Writr(cleaned, writrOptions).renderSync({ mdx });
	}

	// Step 4: Split on paragraph boundaries within the target range
	const searchArea = cleaned.slice(0, maxLength);
	let splitIndex = -1;

	// Look for last paragraph break (\n\n) that is >= minLength
	let pos = searchArea.lastIndexOf("\n\n");
	while (pos >= 0) {
		if (pos >= minLength) {
			splitIndex = pos;
			break;
		}

		// Accept any paragraph break within the max range
		if (splitIndex === -1) {
			splitIndex = pos;
		}

		pos = searchArea.lastIndexOf("\n\n", pos - 1);
	}

	// For list-heavy content, try splitting at last complete list item
	if (splitIndex === -1) {
		const lastNewline = searchArea.lastIndexOf("\n");
		if (lastNewline >= minLength) {
			// Check if the next line starts a list item
			const nextLine = cleaned.slice(lastNewline + 1);
			if (/^[-*]\s/.test(nextLine) || /^\d+\.\s/.test(nextLine)) {
				splitIndex = lastNewline;
			}
		}

		// Also try finding the last list item boundary before maxLength
		if (splitIndex === -1) {
			const lines = searchArea.split("\n");
			let charCount = 0;
			let lastItemEnd = -1;
			for (const line of lines) {
				const lineEnd = charCount + line.length;
				if (
					lineEnd <= maxLength &&
					(/^[-*]\s/.test(line) || /^\d+\.\s/.test(line))
				) {
					// The end of the previous line is a valid split point
					if (charCount > 0 && charCount >= minLength) {
						lastItemEnd = charCount - 1;
					}
				}

				charCount = lineEnd + 1; // +1 for newline
			}

			if (lastItemEnd > 0) {
				splitIndex = lastItemEnd;
			}
		}
	}

	// Step 5: Truncate and apply ellipsis only when force-truncated
	if (splitIndex > 0) {
		const truncated = cleaned.slice(0, splitIndex).trim();
		return new Writr(truncated, writrOptions).renderSync({ mdx });
	}

	// Fallback: truncate at word boundary with ellipsis
	let truncated = cleaned.slice(0, maxLength);
	const lastSpace = truncated.lastIndexOf(" ");
	if (lastSpace > 0) {
		truncated = truncated.slice(0, lastSpace);
	}

	truncated += "...";
	return new Writr(truncated, writrOptions).renderSync({ mdx });
}

export function convertReleaseToChangelogEntry(
	// biome-ignore lint/suspicious/noExplicitAny: GitHub release object
	release: Record<string, any>,
	options: DoculaOptions,
): DoculaChangelogEntry {
	const tagName = (release.tag_name as string) ?? "";
	const slug = tagName.replace(/\./g, "-");
	const name = (release.name as string) || tagName;
	const body = (release.body as string) ?? "";
	const publishedAt = (release.published_at as string) ?? "";
	const prerelease = (release.prerelease as boolean) ?? false;

	let dateString = "";
	let formattedDate = "";
	if (publishedAt) {
		const parsedDate = new Date(publishedAt);
		if (!Number.isNaN(parsedDate.getTime())) {
			dateString = parsedDate.toISOString().split("T")[0];
			formattedDate = parsedDate.toLocaleDateString("en-US", {
				year: "numeric",
				month: "long",
				day: "numeric",
			});
		}
	}

	const tag = prerelease ? "Pre-release" : "Release";
	const tagClass = tag.toLowerCase().replace(/\s+/g, "-");

	return {
		title: name,
		date: dateString,
		formattedDate,
		tag,
		tagClass,
		slug,
		content: body,
		generatedHtml: new Writr(body, writrOptions).renderSync(),
		preview: generateChangelogPreview(body),
		urlPath: `${buildUrlPath(options.baseUrl, options.changelogPath, slug)}/index.html`,
		lastModified: dateString,
	};
}

export function getReleasesAsChangelogEntries(
	// biome-ignore lint/suspicious/noExplicitAny: GitHub release objects
	releases: any[],
	options: DoculaOptions,
): DoculaChangelogEntry[] {
	const entries: DoculaChangelogEntry[] = [];
	for (const release of releases) {
		if (release.draft) {
			continue;
		}

		entries.push(convertReleaseToChangelogEntry(release, options));
	}

	return entries;
}

export async function buildChangelogPage(
	ecto: Ecto,
	options: DoculaOptions,
	data: DoculaData,
): Promise<void> {
	if (!data.hasChangelog || !data.templates?.changelog) {
		return;
	}

	/* v8 ignore next -- @preserve */
	const allEntries = data.changelogEntries ?? [];
	const perPage = options.changelogPerPage;
	const totalPages = Math.max(1, Math.ceil(allEntries.length / perPage));
	const changelogTemplate = `${data.templatePath}/${data.templates.changelog}`;

	const promises = [];
	for (let page = 1; page <= totalPages; page++) {
		const startIndex = (page - 1) * perPage;
		const pageEntries = allEntries.slice(startIndex, startIndex + perPage);

		const changelogOutputBase = `${data.output}/${data.changelogPath}`;
		const outputPath =
			page === 1 ? changelogOutputBase : `${changelogOutputBase}/page/${page}`;
		const indexPath = `${outputPath}/index.html`;

		const changelogPagePath =
			page === 1
				? `/${data.changelogPath}/`
				: `/${data.changelogPath}/page/${page}/`;

		const paginationData = {
			...data,
			entries: pageEntries,
			currentPage: page,
			totalPages,
			hasPagination: totalPages > 1,
			hasNextPage: page < totalPages,
			hasPrevPage: page > 1,
			nextPageUrl:
				page < totalPages ? `${data.changelogUrl}/page/${page + 1}/` : "",
			prevPageUrl:
				page > 1
					? page === 2
						? `${data.changelogUrl}/`
						: `${data.changelogUrl}/page/${page - 1}/`
					: "",
			...resolveOpenGraphData(data, changelogPagePath),
			jsonLd: resolveJsonLd("changelog", data, changelogPagePath),
		};

		promises.push(
			(async () => {
				await fs.promises.mkdir(outputPath, { recursive: true });
				const content = await ecto.renderFromFile(
					changelogTemplate,
					paginationData,
					data.templatePath,
				);
				await fs.promises.writeFile(indexPath, content, "utf8");
			})(),
		);
	}

	await Promise.all(promises);
}

export async function buildChangelogEntryPages(
	ecto: Ecto,
	data: DoculaData,
): Promise<void> {
	if (
		!data.hasChangelog ||
		!data.templates?.changelogEntry ||
		!data.changelogEntries?.length
	) {
		return;
	}

	const entryTemplate = `${data.templatePath}/${data.templates.changelogEntry}`;

	const promises = data.changelogEntries.map(async (entry) => {
		const entryOutputPath = `${data.output}/${data.changelogPath}/${entry.slug}`;
		await fs.promises.mkdir(entryOutputPath, { recursive: true });

		const entryPagePath = `/${data.changelogPath}/${entry.slug}/`;
		const entryContent = await ecto.renderFromFile(
			entryTemplate,
			{
				...data,
				...entry,
				entries: data.changelogEntries,
				...resolveOpenGraphData(data, entryPagePath, entry),
				jsonLd: resolveJsonLd("changelog-entry", data, entryPagePath, entry),
			},
			data.templatePath,
		);

		const entryFilePath = `${entryOutputPath}/index.html`;
		return fs.promises.writeFile(entryFilePath, entryContent, "utf8");
	});

	await Promise.all(promises);
}

export async function buildChangelogFeedJson(data: DoculaData): Promise<void> {
	const entries = data.changelogEntries;
	if (!entries?.length) {
		return;
	}

	await writeChangelogFeedJson(data, entries, "changelog.json");
}

export async function buildChangelogLatestFeedJson(
	data: DoculaData,
	options: DoculaOptions,
): Promise<void> {
	const entries = data.changelogEntries;
	if (!entries?.length) {
		return;
	}

	const latestEntries = entries.slice(0, options.changelogPerPage);
	await writeChangelogFeedJson(data, latestEntries, "changelog-latest.json");
}

export async function writeChangelogFeedJson(
	data: DoculaData,
	entries: DoculaChangelogEntry[],
	filename: string,
): Promise<void> {
	const feedUrl = buildAbsoluteSiteUrl(
		data.siteUrl,
		`${data.baseUrl}/${filename}`,
	);
	const homeUrl = buildAbsoluteSiteUrl(data.siteUrl, `${data.baseUrl}/`);

	const items = entries.map((entry) => {
		const itemUrl = buildAbsoluteSiteUrl(
			data.siteUrl,
			`${data.changelogUrl}/${entry.slug}/`,
		);
		const item: Record<string, unknown> = {
			id: entry.slug,
			title: entry.title,
			url: itemUrl,
			date_published: entry.date,
			date_modified: entry.lastModified,
			summary: entry.preview,
		};

		if (entry.generatedHtml) {
			item.content_html = entry.generatedHtml;
		}

		if (entry.content) {
			item.content_text = entry.content;
		}

		if (entry.tag) {
			item.tags = [entry.tag];
		}

		if (entry.previewImage) {
			item.image = entry.previewImage;
		}

		return item;
	});

	const feed = {
		version: "https://jsonfeed.org/version/1.1",
		title: data.siteTitle,
		description: data.siteDescription,
		home_page_url: homeUrl,
		feed_url: feedUrl,
		items,
	};

	await fs.promises.mkdir(data.output, { recursive: true });
	await fs.promises.writeFile(
		`${data.output}/${filename}`,
		JSON.stringify(feed, null, 2),
		"utf8",
	);
}
