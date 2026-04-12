import fs from "node:fs";
import path from "node:path";
import type { LanguageModel } from "ai";
import { white } from "colorette";
import type { Hashery } from "hashery";
import { Writr, type WritrMetadata, type WritrOptions } from "writr";
import type { DoculaConsole } from "./console.js";
import type { DoculaAIOptions } from "./options.js";
import type { DoculaChangelogEntry, DoculaDocument } from "./types.js";

const writrOptions: WritrOptions = {
	throwOnEmitError: false,
	throwOnEmptyListeners: false,
};

export type AIMetadataCache = Record<string, WritrMetadata>;

/**
 * Create an AI model from explicit configuration.
 * Returns a LanguageModel instance or undefined if the provider is not available.
 */
export async function createAIModel(
	ai: DoculaAIOptions,
): Promise<LanguageModel | undefined> {
	try {
		switch (ai.provider) {
			case "anthropic": {
				const { createAnthropic } = await import("@ai-sdk/anthropic");
				return createAnthropic({ apiKey: ai.apiKey })(
					ai.model ?? "claude-haiku-4-5",
				);
			}

			case "openai": {
				const { createOpenAI } = await import("@ai-sdk/openai");
				return createOpenAI({ apiKey: ai.apiKey })(
					ai.model ?? "gpt-4o-mini-latest",
				);
			}

			case "google": {
				const { createGoogleGenerativeAI } = await import("@ai-sdk/google");
				return createGoogleGenerativeAI({ apiKey: ai.apiKey })(
					ai.model ?? "gemini-2.5-flash-lite",
				);
			}

			default:
				return undefined;
		}
	} catch {
		return undefined;
	}
}

/**
 * Load the AI metadata cache from disk.
 */
export function loadAIMetadataCache(sitePath: string): AIMetadataCache {
	const cachePath = path.join(sitePath, ".cache", "ai", "metadata.json");
	if (!fs.existsSync(cachePath)) {
		return {};
	}

	try {
		return JSON.parse(fs.readFileSync(cachePath, "utf8")) as AIMetadataCache;
	} catch {
		return {};
	}
}

/**
 * Save the AI metadata cache to disk.
 */
export function saveAIMetadataCache(
	sitePath: string,
	cache: AIMetadataCache,
): void {
	const dir = path.join(sitePath, ".cache", "ai");
	fs.mkdirSync(dir, { recursive: true });
	fs.writeFileSync(
		path.join(dir, "metadata.json"),
		JSON.stringify(cache, null, 2),
	);
}

/**
 * Check if a document needs AI enrichment for OG/meta fields.
 */
export function needsDocumentEnrichment(doc: DoculaDocument): boolean {
	return (
		!doc.description ||
		doc.keywords.length === 0 ||
		!doc.ogTitle ||
		!doc.ogDescription
	);
}

/**
 * Check if a changelog entry needs AI enrichment.
 */
export function needsChangelogEnrichment(entry: DoculaChangelogEntry): boolean {
	return (
		!entry.preview ||
		!entry.description ||
		!entry.keywords?.length ||
		!entry.ogTitle ||
		!entry.ogDescription
	);
}

/**
 * Enrich documents with AI-generated metadata for OG/meta tags.
 * Only fills missing fields; existing values are preserved.
 */
export async function enrichDocuments(
	documents: DoculaDocument[] | undefined,
	model: LanguageModel,
	hash: Hashery,
	console: DoculaConsole,
	cache: AIMetadataCache,
): Promise<DoculaDocument[] | undefined> {
	if (!documents?.length) {
		return documents;
	}

	const enriched = [...documents];
	for (let i = 0; i < enriched.length; i++) {
		const doc = enriched[i];
		if (!needsDocumentEnrichment(doc)) {
			continue;
		}

		try {
			const bodyHash = hash.toHashSync(doc.content);
			const cached = cache[bodyHash];

			if (cached) {
				const applied = applyMetadataToDocument(doc, cached);
				if (!needsDocumentEnrichment(applied)) {
					enriched[i] = applied;
					logDocumentMetadata(
						console,
						doc.title || doc.documentPath,
						cached,
						true,
					);
					continue;
				}

				// Cached metadata is incomplete for current requirements; re-query
				delete cache[bodyHash];
			}

			// Skip documents with very little content
			if (doc.content.trim().length < 10) {
				continue;
			}

			/* v8 ignore start -- @preserve */
			const writr = new Writr(doc.content, {
				...writrOptions,
				ai: { model },
			});
			const metadata = await writr.ai?.getMetadata();
			if (!metadata) {
				continue;
			}

			cache[bodyHash] = metadata;
			enriched[i] = applyMetadataToDocument(doc, metadata);
			logDocumentMetadata(
				console,
				doc.title || doc.documentPath,
				metadata,
				false,
			);
			/* v8 ignore stop */
		} catch (error) {
			console.warn(
				`AI enrichment failed for ${doc.documentPath}: ${(error as Error).message}`,
			);
		}
	}

	return enriched;
}

/**
 * Enrich changelog entries with AI-generated metadata.
 */
export async function enrichChangelogEntries(
	entries: DoculaChangelogEntry[] | undefined,
	model: LanguageModel,
	hash: Hashery,
	console: DoculaConsole,
	cache: AIMetadataCache,
): Promise<DoculaChangelogEntry[] | undefined> {
	if (!entries?.length) {
		return entries;
	}

	const enriched = [...entries];
	for (let i = 0; i < enriched.length; i++) {
		const entry = enriched[i];
		/* v8 ignore next -- @preserve */
		if (!needsChangelogEnrichment(entry)) {
			continue;
		}

		try {
			const bodyHash = hash.toHashSync(entry.content);
			const cached = cache[bodyHash];

			if (cached) {
				const applied = applyMetadataToChangelog(entry, cached);
				if (!needsChangelogEnrichment(applied)) {
					enriched[i] = applied;
					logChangelogMetadata(
						console,
						entry.title || entry.slug,
						cached,
						true,
					);
					continue;
				}

				// Cached metadata is incomplete for current requirements; re-query
				delete cache[bodyHash];
			}

			// Skip entries with very little content
			if (entry.content.trim().length < 10) {
				continue;
			}

			/* v8 ignore start -- @preserve */
			const writr = new Writr(entry.content, {
				...writrOptions,
				ai: { model },
			});
			const metadata = await writr.ai?.getMetadata();
			if (!metadata) {
				continue;
			}

			cache[bodyHash] = metadata;
			enriched[i] = applyMetadataToChangelog(entry, metadata);
			logChangelogMetadata(console, entry.title || entry.slug, metadata, false);
			/* v8 ignore stop */
		} catch (error) {
			console.warn(
				`AI enrichment failed for changelog ${entry.slug}: ${(error as Error).message}`,
			);
		}
	}

	return enriched;
}

export type ReadmeMetadata = {
	description?: string;
	keywords?: string[];
	ogTitle?: string;
	ogDescription?: string;
};

/**
 * Enrich the site README with AI-generated metadata for OG/meta tags.
 * Accepts the README content directly (from doculaData.readmeContent or
 * by reading sitePath/README.md). Returns mapped metadata or undefined
 * if content is missing, too small, or enrichment fails.
 */
export async function enrichReadme(
	content: string | undefined,
	model: LanguageModel,
	hash: Hashery,
	console: DoculaConsole,
	cache: AIMetadataCache,
): Promise<ReadmeMetadata | undefined> {
	if (!content) {
		return undefined;
	}

	try {
		// Skip very small content
		if (content.trim().length < 10) {
			return undefined;
		}

		const bodyHash = hash.toHashSync(content);
		const cached = cache[bodyHash];

		if (cached) {
			logDocumentMetadata(console, "README", cached, true);
			return {
				description: cached.description,
				keywords: cached.keywords,
				ogTitle: cached.title,
				ogDescription: cached.description,
			};
		}

		/* v8 ignore start -- @preserve */
		const writr = new Writr(content, {
			...writrOptions,
			ai: { model },
		});
		const metadata = await writr.ai?.getMetadata();
		if (!metadata) {
			return undefined;
		}

		cache[bodyHash] = metadata;
		logDocumentMetadata(console, "README", metadata, false);
		return {
			description: metadata.description,
			keywords: metadata.keywords,
			ogTitle: metadata.title,
			ogDescription: metadata.description,
		};
		/* v8 ignore stop */
	} catch (error) {
		console.warn(
			`AI enrichment failed for README: ${(error as Error).message}`,
		);
		return undefined;
	}
}

/**
 * Log AI-generated metadata for a document.
 */
export function truncate(value: string, max = 60): string {
	return value.length > max ? `${value.slice(0, max)}...` : value;
}

export function logDocumentMetadata(
	console: DoculaConsole,
	name: string,
	metadata: WritrMetadata,
	fromCache: boolean,
): void {
	if (fromCache) {
		console.info(`AI enriched: ${name} - using cached version as no changes`);
		return;
	}

	console.info(`AI enriched: ${name}`);
	if (metadata.description) {
		console.log(white(`  description: ${truncate(metadata.description)}`));
	}

	if (metadata.keywords?.length) {
		console.log(white(`  keywords: ${truncate(metadata.keywords.join(", "))}`));
	}

	if (metadata.title) {
		console.log(white(`  ogTitle: ${truncate(metadata.title)}`));
	}
}

/**
 * Log AI-generated metadata for a changelog entry.
 */
export function logChangelogMetadata(
	console: DoculaConsole,
	name: string,
	metadata: WritrMetadata,
	fromCache: boolean,
): void {
	if (fromCache) {
		console.info(
			`AI enriched changelog: ${name} - using cached version as no changes`,
		);
		return;
	}

	console.info(`AI enriched changelog: ${name}`);

	if (metadata.preview || metadata.summary) {
		console.log(
			white(
				`  preview: ${truncate(metadata.preview || metadata.summary || "")}`,
			),
		);
	}

	if (metadata.description) {
		console.log(white(`  description: ${truncate(metadata.description)}`));
	}

	if (metadata.keywords?.length) {
		console.log(white(`  keywords: ${truncate(metadata.keywords.join(", "))}`));
	}
}

/**
 * Apply AI-generated metadata to a document, filling only missing fields.
 */
function applyMetadataToDocument(
	doc: DoculaDocument,
	metadata: WritrMetadata,
): DoculaDocument {
	return {
		...doc,
		description: doc.description || metadata.description || "",
		keywords:
			doc.keywords.length > 0 ? doc.keywords : (metadata.keywords ?? []),
		ogTitle: doc.ogTitle ?? metadata.title,
		ogDescription: doc.ogDescription ?? metadata.description,
	};
}

/**
 * Apply AI-generated metadata to a changelog entry, filling only missing fields.
 */
function applyMetadataToChangelog(
	entry: DoculaChangelogEntry,
	metadata: WritrMetadata,
): DoculaChangelogEntry {
	return {
		...entry,
		preview: entry.preview || metadata.preview || metadata.summary || "",
		description: entry.description || metadata.description || undefined,
		keywords: entry.keywords?.length
			? entry.keywords
			: (metadata.keywords ?? []),
		ogTitle: entry.ogTitle ?? (entry.title || metadata.title),
		ogDescription: entry.ogDescription ?? metadata.description,
	};
}
