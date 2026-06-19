import fs from "node:fs";
import type { DoculaConsole } from "./console.js";
import type { DoculaData } from "./types.js";

/**
 * Name of the JSON search index written to the output root. The client-side
 * search script fetches this file (relative to {@link DoculaData.baseUrl}) to
 * power the search modal.
 */
export const SEARCH_INDEX_FILENAME = "search-index.json";

/**
 * A single searchable record. Each documentation/changelog page is split into
 * one record per heading section so results can deep-link to the matching
 * heading anchor, similar to the local search used by VitePress.
 */
export type SearchRecord = {
	/** Unique identifier (the record url). */
	id: string;
	/** The heading text for this section, or the page title for the intro record. */
	title: string;
	/** Breadcrumb of ancestor titles (page title first, then parent headings). */
	titles: string[];
	/** Plain-text content of the section, used for matching and snippets. */
	text: string;
	/** Absolute site-relative url, including the heading anchor when applicable. */
	url: string;
};

const NAMED_ENTITIES: Record<string, string> = {
	amp: "&",
	lt: "<",
	gt: ">",
	quot: '"',
	apos: "'",
	nbsp: " ",
	copy: "©",
	reg: "®",
	trade: "™",
	hellip: "…",
	mdash: "—",
	ndash: "–",
	lsquo: "‘",
	rsquo: "’",
	ldquo: "“",
	rdquo: "”",
};

const ENTITY_REGEX = /&(#[xX]?[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);/g;
const HEADING_REGEX = /<h([1-6])\b[^>]*\bid="([^"]+)"[^>]*>([\s\S]*?)<\/h\1>/gi;

/**
 * Decode the small set of HTML entities that can appear in rendered markdown
 * (named, decimal, and hexadecimal). Unknown named entities are left intact.
 */
export function decodeEntities(text: string): string {
	return text.replace(ENTITY_REGEX, (match, entity: string) => {
		if (entity[0] === "#") {
			const isHex = entity[1] === "x" || entity[1] === "X";
			const codePoint = isHex
				? Number.parseInt(entity.slice(2), 16)
				: Number.parseInt(entity.slice(1), 10);
			if (Number.isNaN(codePoint)) {
				return match;
			}

			try {
				return String.fromCodePoint(codePoint);
			} catch {
				return match;
			}
		}

		const named = NAMED_ENTITIES[entity.toLowerCase()];
		return named ?? match;
	});
}

/**
 * Convert an HTML fragment into collapsed, decoded plain text. Script and
 * style blocks are dropped entirely before tags are stripped.
 */
export function stripHtml(html: string): string {
	if (!html) {
		return "";
	}

	const withoutBlocks = html
		.replace(/<script[\s\S]*?<\/script>/gi, " ")
		.replace(/<style[\s\S]*?<\/style>/gi, " ");
	const withoutTags = withoutBlocks.replace(/<[^>]+>/g, " ");
	return decodeEntities(withoutTags).replace(/\s+/g, " ").trim();
}

/**
 * Remove a trailing `index.html` so urls point at the clean directory path
 * that the static site actually serves.
 */
export function stripIndexHtml(urlPath: string): string {
	return urlPath.replace(/index\.html$/, "");
}

function isTableOfContents(anchor: string, title: string): boolean {
	return (
		anchor === "table-of-contents" ||
		title.trim().toLowerCase() === "table of contents"
	);
}

/**
 * Split a rendered HTML page into search records: one for the page intro
 * (content before the first heading) plus one per heading section. The
 * injected "Table of Contents" section is skipped.
 */
export function extractSections(
	html: string,
	pageTitle: string,
	pageUrl: string,
): SearchRecord[] {
	const source = html ?? "";
	const records: SearchRecord[] = [];

	const headings: Array<{
		level: number;
		anchor: string;
		title: string;
		headingStart: number;
		contentStart: number;
	}> = [];

	HEADING_REGEX.lastIndex = 0;
	let match = HEADING_REGEX.exec(source);
	while (match !== null) {
		headings.push({
			level: Number.parseInt(match[1], 10),
			anchor: match[2],
			title: stripHtml(match[3]),
			headingStart: match.index,
			contentStart: match.index + match[0].length,
		});
		match = HEADING_REGEX.exec(source);
	}

	// Intro / page-level record: everything before the first heading.
	const introEnd =
		headings.length > 0 ? headings[0].headingStart : source.length;
	records.push({
		id: pageUrl,
		title: pageTitle,
		titles: [],
		text: stripHtml(source.slice(0, introEnd)),
		url: pageUrl,
	});

	// One record per heading, tracking the ancestor breadcrumb via a stack.
	const stack: Array<{ level: number; title: string }> = [];
	for (let index = 0; index < headings.length; index++) {
		const heading = headings[index];
		while (stack.length > 0 && stack[stack.length - 1].level >= heading.level) {
			stack.pop();
		}

		if (isTableOfContents(heading.anchor, heading.title)) {
			continue;
		}

		const next = headings[index + 1];
		const sectionEnd = next ? next.headingStart : source.length;
		const url = `${pageUrl}#${heading.anchor}`;
		records.push({
			id: url,
			title: heading.title,
			titles: [pageTitle, ...stack.map((item) => item.title)],
			text: stripHtml(source.slice(heading.contentStart, sectionEnd)),
			url,
		});

		stack.push({ level: heading.level, title: heading.title });
	}

	return records;
}

/**
 * Build the full list of search records for a site from its documents and
 * (published) changelog entries.
 */
export function generateSearchRecords(data: DoculaData): SearchRecord[] {
	const records: SearchRecord[] = [];

	for (const document of data.documents ?? []) {
		const pageTitle = document.navTitle || document.title || "Untitled";
		const url = `${data.baseUrl}${stripIndexHtml(document.urlPath)}`;
		records.push(...extractSections(document.generatedHtml, pageTitle, url));
	}

	for (const entry of data.changelogEntries ?? []) {
		if (entry.draft) {
			continue;
		}

		const pageTitle = entry.title || "Untitled";
		// Changelog urlPath already includes baseUrl via buildUrlPath.
		const url = stripIndexHtml(entry.urlPath);
		records.push(...extractSections(entry.generatedHtml, pageTitle, url));
	}

	return records;
}

/**
 * Generate the search index JSON for the build when search is enabled. The
 * file is written to the output root and consumed by the client-side search.
 */
export async function buildSearchIndex(
	console: DoculaConsole,
	data: DoculaData,
): Promise<void> {
	if (!data.enableSearch) {
		return;
	}

	console.step("Building search index...");

	await fs.promises.mkdir(data.output, { recursive: true });
	const records = generateSearchRecords(data);
	const outputPath = `${data.output}/${SEARCH_INDEX_FILENAME}`;
	await fs.promises.writeFile(outputPath, JSON.stringify({ records }), "utf8");

	console.fileBuilt(SEARCH_INDEX_FILENAME);
}
