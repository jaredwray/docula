import fs from "node:fs";
import path from "node:path";
import type { Hashery } from "hashery";
import { Writr, type WritrOptions } from "writr";
import { hashFile } from "./builder-cache.js";
import type {
	DoculaData,
	DoculaDocument,
	DoculaSection,
} from "./types.js";
import type { DoculaOptions } from "./options.js";

const writrOptions: WritrOptions = {
	throwOnEmitError: false,
	throwOnEmptyListeners: false,
};

export function parseDocumentData(
	documentPath: string,
	options: DoculaOptions,
): DoculaDocument {
	const documentContent = fs.readFileSync(documentPath, "utf8");
	const writr = new Writr(documentContent, writrOptions);
	const matterData = writr.frontMatter;
	let markdownContent = writr.body;
	markdownContent = markdownContent.replace(/^# .*\n/, "");

	// Detect file extension to determine if it's MDX or MD
	/* v8 ignore next -- @preserve */
	const isMdx = documentPath.endsWith(".mdx");
	/* v8 ignore next -- @preserve */
	const fileExtension = isMdx ? ".mdx" : ".md";

	const documentsFolderIndex = documentPath.lastIndexOf("/docs/");
	// Build urlPath relative to the source docs/ folder, then prefix with configured docsPath
	const relativePath = documentPath.slice(documentsFolderIndex + 6); // strip "/docs/"
	const docsPrefix = options.docsPath ? `/${options.docsPath}` : "";
	let urlPath = `${docsPrefix}/${relativePath}`.replace(
		fileExtension,
		"/index.html",
	);
	const isRoot = !relativePath.includes("/");
	if (isRoot) {
		if (relativePath === "index.md" || relativePath === "index.mdx") {
			urlPath = `${docsPrefix}/${relativePath}`.replace(fileExtension, ".html");
		}
	}

	// Only insert a TOC heading when the page has multiple sections.
	// Place it just before the first ## heading so intro content is preserved.
	if (!hasTableOfContents(markdownContent)) {
		const h2Matches = markdownContent.match(/^## /gm);
		if (h2Matches && h2Matches.length >= 2) {
			const firstH2 = markdownContent.search(/^## /m);
			markdownContent = `${markdownContent.slice(0, firstH2)}## Table of Contents\n\n${markdownContent.slice(firstH2)}`;
		}
	}

	return {
		title: matterData.title,

		navTitle: matterData.navTitle ?? matterData.title,

		description: matterData.description ?? "",

		order: matterData.order ?? undefined,

		section: matterData.section ?? undefined,

		keywords: matterData.keywords ?? [],
		ogTitle: matterData.ogTitle ?? undefined,
		ogDescription: matterData.ogDescription ?? undefined,
		ogImage: matterData.ogImage ?? undefined,
		content: documentContent,
		markdown: markdownContent,
		generatedHtml: new Writr(markdownContent, writrOptions).renderSync({
			toc: true,
			mdx: isMdx,
		}),
		documentPath,
		urlPath,
		isRoot,
		lastModified: fs.statSync(documentPath).mtime.toISOString().split("T")[0],
	};
}

export function getDocuments(
	sitePath: string,
	doculaData: DoculaData,
	options: DoculaOptions,
	hash: Hashery,
	cachedDocs?: Map<string, DoculaDocument>,
	previousDocHashes?: Record<string, string>,
	currentDocHashes?: Record<string, string>,
): DoculaDocument[] {
	let documents: DoculaDocument[] = [];
	if (fs.existsSync(sitePath)) {
		// Get top level documents
		documents = getDocumentInDirectory(
			sitePath,
			sitePath,
			options,
			hash,
			cachedDocs,
			previousDocHashes,
			currentDocHashes,
		);

		// Get all sections and parse them
		doculaData.sections = getSections(sitePath, options);

		// Get all documents in each section
		for (const section of doculaData.sections) {
			const sectionPath = `${sitePath}/${section.path}`;
			const sectionDocuments = getDocumentInDirectory(
				sectionPath,
				sitePath,
				options,
				hash,
				cachedDocs,
				previousDocHashes,
				currentDocHashes,
			);
			documents = [...documents, ...sectionDocuments];
		}
	}

	return documents;
}

export function getDocumentInDirectory(
	sitePath: string,
	docsRootPath: string,
	options: DoculaOptions,
	hash: Hashery,
	cachedDocs?: Map<string, DoculaDocument>,
	previousDocHashes?: Record<string, string>,
	currentDocHashes?: Record<string, string>,
): DoculaDocument[] {
	const documents: DoculaDocument[] = [];
	const documentList = fs.readdirSync(sitePath);
	/* v8 ignore next -- @preserve */
	if (documentList.length > 0) {
		for (const document of documentList) {
			const documentPath = `${sitePath}/${document}`;
			const relativeKey = path.relative(docsRootPath, documentPath);
			const stats = fs.statSync(documentPath);
			if (
				stats.isFile() &&
				(document.endsWith(".md") || document.endsWith(".mdx"))
			) {
				// Check if we can use cached parsed document
				if (cachedDocs && previousDocHashes && currentDocHashes) {
					const docHash =
						currentDocHashes[relativeKey] ?? hashFile(hash, documentPath);
					const prevHash = previousDocHashes[relativeKey];
					const cached = cachedDocs.get(relativeKey);
					if (cached && prevHash === docHash) {
						documents.push(cached);
						continue;
					}
				}

				const documentData = parseDocumentData(documentPath, options);
				documents.push(documentData);
			}
		}
	}

	// Sort the documents by order
	documents.sort(
		(a, b) => (a.order ?? documents.length) - (b.order ?? documents.length),
	);

	return documents;
}

export function getSections(
	sitePath: string,
	doculaOptions: DoculaOptions,
): DoculaSection[] {
	const sections: DoculaSection[] = [];
	if (fs.existsSync(sitePath)) {
		const documentList = fs.readdirSync(sitePath);
		/* v8 ignore next -- @preserve */
		if (documentList.length > 0) {
			for (const document of documentList) {
				const documentPath = `${sitePath}/${document}`;
				const stats = fs.statSync(documentPath);
				if (stats.isDirectory() && directoryContainsMarkdown(documentPath)) {
					const section: DoculaSection = {
						name: document
							.replaceAll("-", " ")
							.replaceAll(/\b\w/g, (l) => l.toUpperCase()),
						path: document,
					};

					mergeSectionWithOptions(section, doculaOptions);

					sections.push(section);
				}
			}
		}

		// Sort the sections by order
		sections.sort(
			(a, b) => (a.order ?? sections.length) - (b.order ?? sections.length),
		);
	}

	return sections;
}

export function mergeSectionWithOptions(
	section: DoculaSection,
	options: DoculaOptions,
): DoculaSection {
	if (options.sections) {
		const sectionOptions = options.sections.find(
			(sectionOption) => sectionOption.path === section.path,
		);

		if (sectionOptions) {
			section.name = sectionOptions.name;
			section.order = sectionOptions.order;
			section.path = sectionOptions.path;
		}
	}

	return section;
}

export function generateSidebarItems(data: DoculaData): DoculaSection[] {
	let sidebarItems: DoculaSection[] = (data.sections ?? []).map((section) => ({
		...section,
		children: section.children ? [...section.children] : undefined,
	}));

	for (const document of data.documents ?? []) {
		if (document.isRoot) {
			sidebarItems.unshift({
				path: `${data.baseUrl}${document.urlPath.replace("index.html", "")}`,
				name: document.navTitle,
				order: document.order,
			});
		} else {
			const relativeFilePath = document.documentPath.replace(
				`${data.sitePath}/docs/`,
				"",
			);
			const sectionPath = relativeFilePath.slice(
				0,
				Math.max(0, relativeFilePath.lastIndexOf("/")),
			);
			const documentSection = document.section ?? sectionPath;

			const sectionIndex = sidebarItems.findIndex(
				(section) => section.path === documentSection,
			);

			if (sectionIndex === -1) {
				continue;
			}

			sidebarItems[sectionIndex].children ??= [];

			sidebarItems[sectionIndex].children.push({
				path: `${data.baseUrl}${document.urlPath.replace("index.html", "")}`,
				name: document.navTitle,
				order: document.order,
			});
		}
	}

	// Sort the sidebarItems children
	sidebarItems = sidebarItems.map((section) => {
		if (section.children) {
			section.children.sort(
				(a, b) =>
					// biome-ignore lint/style/noNonNullAssertion: need to fix
					(a.order ?? section.children!.length) -
					// biome-ignore lint/style/noNonNullAssertion: need to fix
					(b.order ?? section.children!.length),
			);
		}

		return section;
	});

	// Sort the sidebarItems
	sidebarItems.sort(
		(a, b) =>
			(a.order ?? sidebarItems.length) - (b.order ?? sidebarItems.length),
	);

	return sidebarItems;
}

export function hasTableOfContents(markdown: string): boolean {
	const normalized = markdown.replace(/\r\n/g, "\n");
	const atxHeading = /^#{1,6}\s*(table of contents|toc)\s*$/im;
	const setextHeading = /^(table of contents|toc)\s*\n[-=]{2,}\s*$/im;
	const htmlHeading = /<h[1-6][^>]*>\s*(table of contents|toc)\s*<\/h[1-6]>/i;

	return (
		atxHeading.test(normalized) ||
		setextHeading.test(normalized) ||
		htmlHeading.test(normalized)
	);
}

export function directoryContainsMarkdown(dirPath: string): boolean {
	const entries = fs.readdirSync(dirPath);
	for (const entry of entries) {
		const fullPath = `${dirPath}/${entry}`;
		const stat = fs.statSync(fullPath);
		if (stat.isFile() && (entry.endsWith(".md") || entry.endsWith(".mdx"))) {
			return true;
		}
	}

	return false;
}
