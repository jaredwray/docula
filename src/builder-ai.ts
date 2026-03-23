import fs from "node:fs";
import path from "node:path";
import type { LanguageModel } from "ai";
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
					ai.model ?? "gemini-2.5-flash-lite-latest",
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
	return !entry.title || !entry.preview;
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
				enriched[i] = applyMetadataToDocument(doc, cached);
				continue;
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
			console.info(`AI enriched: ${doc.title || doc.documentPath}`);
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
		if (!needsChangelogEnrichment(entry)) {
			continue;
		}

		try {
			const bodyHash = hash.toHashSync(entry.content);
			const cached = cache[bodyHash];

			if (cached) {
				enriched[i] = applyMetadataToChangelog(entry, cached);
				continue;
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
			console.info(`AI enriched changelog: ${entry.title || entry.slug}`);
			/* v8 ignore stop */
		} catch (error) {
			console.warn(
				`AI enrichment failed for changelog ${entry.slug}: ${(error as Error).message}`,
			);
		}
	}

	return enriched;
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
		title: entry.title || metadata.title || entry.title,
		preview: entry.preview || metadata.preview || metadata.summary || "",
	};
}
