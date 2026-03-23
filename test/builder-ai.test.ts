import fs from "node:fs";
import path from "node:path";
import type { LanguageModel } from "ai";
import { Hashery } from "hashery";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Writr } from "writr";
import {
	type AIMetadataCache,
	createAIModel,
	enrichChangelogEntries,
	enrichDocuments,
	loadAIMetadataCache,
	needsChangelogEnrichment,
	needsDocumentEnrichment,
	saveAIMetadataCache,
} from "../src/builder-ai.js";
import { DoculaConsole } from "../src/console.js";
import type { DoculaChangelogEntry, DoculaDocument } from "../src/types.js";

vi.mock("@cacheable/net");

const testHash = new Hashery();
const mockModel = {
	specificationVersion: "v3",
	provider: "test",
	modelId: "test-model",
} as unknown as LanguageModel;

function makeDocument(overrides: Partial<DoculaDocument> = {}): DoculaDocument {
	return {
		title: "Test Doc",
		navTitle: "Test Doc",
		description: "",
		keywords: [],
		content:
			"---\ntitle: Test Doc\n---\n\n# Test Doc\n\nSome content here for testing purposes.",
		markdown: "# Test Doc\n\nSome content here for testing purposes.",
		generatedHtml:
			"<h1>Test Doc</h1><p>Some content here for testing purposes.</p>",
		documentPath: "/docs/test.md",
		urlPath: "/docs/test/index.html",
		isRoot: false,
		lastModified: "2026-01-01",
		...overrides,
	};
}

function makeChangelogEntry(
	overrides: Partial<DoculaChangelogEntry> = {},
): DoculaChangelogEntry {
	return {
		title: "",
		date: "2026-01-01",
		formattedDate: "January 1, 2026",
		slug: "test-entry",
		content: "# Release v1.0\n\nNew features and improvements in this release.",
		generatedHtml: "<h1>Release v1.0</h1>",
		preview: "",
		urlPath: "/changelog/test-entry/index.html",
		lastModified: "2026-01-01",
		...overrides,
	};
}

const tempDir = "test/temp/ai-test";

describe("builder-ai", () => {
	beforeEach(() => {
		fs.mkdirSync(tempDir, { recursive: true });
	});

	afterEach(() => {
		vi.resetAllMocks();
		if (fs.existsSync(tempDir)) {
			fs.rmSync(tempDir, { recursive: true, force: true });
		}
	});

	describe("createAIModel", () => {
		it("should create an Anthropic model", async () => {
			const result = await createAIModel({
				provider: "anthropic",
				apiKey: "test-key",
			});
			expect(result).toBeDefined();
		});

		it("should create an OpenAI model", async () => {
			const result = await createAIModel({
				provider: "openai",
				apiKey: "test-key",
			});
			expect(result).toBeDefined();
		});

		it("should create a Google model", async () => {
			const result = await createAIModel({
				provider: "google",
				apiKey: "test-key",
			});
			expect(result).toBeDefined();
		});

		it("should use custom model when provided", async () => {
			const result = await createAIModel({
				provider: "anthropic",
				apiKey: "test-key",
				model: "claude-sonnet-4-20250514",
			});
			expect(result).toBeDefined();
		});

		it("should return undefined for unknown provider", async () => {
			const result = await createAIModel({
				provider: "unknown",
				apiKey: "test-key",
			});
			expect(result).toBeUndefined();
		});

		it("should return undefined when provider import throws", async () => {
			vi.doMock("@ai-sdk/anthropic", () => {
				throw new Error("Module not found");
			});

			const { createAIModel: createMocked } = await import(
				"../src/builder-ai.js"
			);
			const result = await createMocked({
				provider: "anthropic",
				apiKey: "test-key",
			});
			expect(result).toBeUndefined();

			vi.doUnmock("@ai-sdk/anthropic");
		});
	});

	describe("needsDocumentEnrichment", () => {
		it("should return true when description is empty", () => {
			const doc = makeDocument({ description: "" });
			expect(needsDocumentEnrichment(doc)).toBe(true);
		});

		it("should return true when keywords is empty", () => {
			const doc = makeDocument({
				description: "has desc",
				keywords: [],
				ogTitle: "title",
				ogDescription: "desc",
			});
			expect(needsDocumentEnrichment(doc)).toBe(true);
		});

		it("should return true when ogTitle is missing", () => {
			const doc = makeDocument({
				description: "has desc",
				keywords: ["k1"],
				ogTitle: undefined,
				ogDescription: "desc",
			});
			expect(needsDocumentEnrichment(doc)).toBe(true);
		});

		it("should return true when ogDescription is missing", () => {
			const doc = makeDocument({
				description: "has desc",
				keywords: ["k1"],
				ogTitle: "title",
				ogDescription: undefined,
			});
			expect(needsDocumentEnrichment(doc)).toBe(true);
		});

		it("should return false when all fields are present", () => {
			const doc = makeDocument({
				description: "has desc",
				keywords: ["k1"],
				ogTitle: "title",
				ogDescription: "desc",
			});
			expect(needsDocumentEnrichment(doc)).toBe(false);
		});
	});

	describe("needsChangelogEnrichment", () => {
		it("should return true when title is empty", () => {
			const entry = makeChangelogEntry({ title: "" });
			expect(needsChangelogEnrichment(entry)).toBe(true);
		});

		it("should return true when preview is empty", () => {
			const entry = makeChangelogEntry({ title: "Title", preview: "" });
			expect(needsChangelogEnrichment(entry)).toBe(true);
		});

		it("should return false when title and preview are present", () => {
			const entry = makeChangelogEntry({
				title: "Title",
				preview: "Preview text",
			});
			expect(needsChangelogEnrichment(entry)).toBe(false);
		});
	});

	describe("loadAIMetadataCache", () => {
		it("should return empty object when cache file does not exist", () => {
			const cache = loadAIMetadataCache(tempDir);
			expect(cache).toEqual({});
		});

		it("should return empty object when cache file is invalid JSON", () => {
			const cacheDir = path.join(tempDir, ".cache", "ai");
			fs.mkdirSync(cacheDir, { recursive: true });
			fs.writeFileSync(path.join(cacheDir, "metadata.json"), "not valid json");
			const cache = loadAIMetadataCache(tempDir);
			expect(cache).toEqual({});
		});

		it("should load valid cache data", () => {
			const cacheDir = path.join(tempDir, ".cache", "ai");
			fs.mkdirSync(cacheDir, { recursive: true });
			const testData: AIMetadataCache = {
				abc123: {
					title: "Test",
					description: "Test desc",
					keywords: ["a", "b"],
				},
			};
			fs.writeFileSync(
				path.join(cacheDir, "metadata.json"),
				JSON.stringify(testData),
			);
			const cache = loadAIMetadataCache(tempDir);
			expect(cache).toEqual(testData);
		});
	});

	describe("saveAIMetadataCache", () => {
		it("should create cache directory and write file", () => {
			const testData: AIMetadataCache = {
				hash1: { title: "Title", description: "Desc" },
			};
			saveAIMetadataCache(tempDir, testData);
			const cachePath = path.join(tempDir, ".cache", "ai", "metadata.json");
			expect(fs.existsSync(cachePath)).toBe(true);
			const content = JSON.parse(fs.readFileSync(cachePath, "utf8"));
			expect(content).toEqual(testData);
		});

		it("should round-trip with loadAIMetadataCache", () => {
			const testData: AIMetadataCache = {
				hash1: {
					title: "Title",
					description: "Desc",
					keywords: ["k1", "k2"],
				},
				hash2: { title: "Another", summary: "Sum" },
			};
			saveAIMetadataCache(tempDir, testData);
			const loaded = loadAIMetadataCache(tempDir);
			expect(loaded).toEqual(testData);
		});
	});

	describe("enrichDocuments", () => {
		it("should return undefined for undefined documents", async () => {
			const doculaConsole = new DoculaConsole();
			const cache: AIMetadataCache = {};

			const result = await enrichDocuments(
				undefined,
				mockModel,
				testHash,
				doculaConsole,
				cache,
			);
			expect(result).toBeUndefined();
		});

		it("should return empty array for empty documents", async () => {
			const doculaConsole = new DoculaConsole();
			const cache: AIMetadataCache = {};

			const result = await enrichDocuments(
				[],
				mockModel,
				testHash,
				doculaConsole,
				cache,
			);
			expect(result).toEqual([]);
		});

		it("should skip documents that do not need enrichment", async () => {
			const doculaConsole = new DoculaConsole();
			const cache: AIMetadataCache = {};

			const doc = makeDocument({
				description: "Full desc",
				keywords: ["k1"],
				ogTitle: "OG Title",
				ogDescription: "OG Desc",
			});
			const result = await enrichDocuments(
				[doc],
				mockModel,
				testHash,
				doculaConsole,
				cache,
			);
			expect(result).toEqual([doc]);
		});

		it("should use cached metadata when available", async () => {
			const doculaConsole = new DoculaConsole();
			const doc = makeDocument();
			const bodyHash = testHash.toHashSync(doc.content);
			const cache: AIMetadataCache = {
				[bodyHash]: {
					title: "Cached Title",
					description: "Cached description",
					keywords: ["cached", "keywords"],
				},
			};

			const result = await enrichDocuments(
				[doc],
				mockModel,
				testHash,
				doculaConsole,
				cache,
			);
			expect(result?.[0].description).toBe("Cached description");
			expect(result?.[0].keywords).toEqual(["cached", "keywords"]);
			expect(result?.[0].ogTitle).toBe("Cached Title");
			expect(result?.[0].ogDescription).toBe("Cached description");
		});

		it("should skip documents with very short content", async () => {
			const doculaConsole = new DoculaConsole();
			const cache: AIMetadataCache = {};

			const doc = makeDocument({ markdown: "hi", content: "hi" });
			const result = await enrichDocuments(
				[doc],
				mockModel,
				testHash,
				doculaConsole,
				cache,
			);
			expect(result?.[0].description).toBe("");
		});

		it("should handle AI errors gracefully", async () => {
			const doculaConsole = new DoculaConsole();
			const warnSpy = vi.spyOn(doculaConsole, "warn");
			const cache: AIMetadataCache = {};

			vi.doMock("writr", async (importOriginal) => {
				const original = await importOriginal<typeof import("writr")>();
				return {
					...original,
					Writr: class extends original.Writr {
						get ai() {
							return {
								getMetadata: () => {
									throw new Error("AI API error");
								},
							} as unknown as Writr["ai"];
						}
					},
				};
			});

			const { enrichDocuments: enrichDocsMocked } = await import(
				"../src/builder-ai.js"
			);

			const doc = makeDocument();
			const result = await enrichDocsMocked(
				[doc],
				mockModel,
				testHash,
				doculaConsole,
				cache,
			);

			expect(result?.[0].description).toBe("");
			expect(warnSpy).toHaveBeenCalled();

			vi.doUnmock("writr");
		});

		it("should preserve existing doc fields when enriching", async () => {
			const doculaConsole = new DoculaConsole();
			const doc = makeDocument({
				description: "Existing desc",
				keywords: [],
			});
			const bodyHash = testHash.toHashSync(doc.content);
			const cache: AIMetadataCache = {
				[bodyHash]: {
					title: "AI Title",
					description: "AI description",
					keywords: ["ai", "generated"],
				},
			};

			const result = await enrichDocuments(
				[doc],
				mockModel,
				testHash,
				doculaConsole,
				cache,
			);
			expect(result?.[0].description).toBe("Existing desc");
			expect(result?.[0].keywords).toEqual(["ai", "generated"]);
		});
	});

	describe("enrichChangelogEntries", () => {
		it("should return undefined for undefined entries", async () => {
			const doculaConsole = new DoculaConsole();
			const cache: AIMetadataCache = {};

			const result = await enrichChangelogEntries(
				undefined,
				mockModel,
				testHash,
				doculaConsole,
				cache,
			);
			expect(result).toBeUndefined();
		});

		it("should skip entries that do not need enrichment", async () => {
			const doculaConsole = new DoculaConsole();
			const cache: AIMetadataCache = {};

			const entry = makeChangelogEntry({
				title: "Has title",
				preview: "Has preview",
			});
			const result = await enrichChangelogEntries(
				[entry],
				mockModel,
				testHash,
				doculaConsole,
				cache,
			);
			expect(result).toEqual([entry]);
		});

		it("should use cached metadata for changelog entries", async () => {
			const doculaConsole = new DoculaConsole();
			const entry = makeChangelogEntry({ title: "", preview: "" });
			const bodyHash = testHash.toHashSync(entry.content);
			const cache: AIMetadataCache = {
				[bodyHash]: {
					title: "Cached Changelog Title",
					preview: "Cached preview text",
					summary: "Cached summary",
				},
			};

			const result = await enrichChangelogEntries(
				[entry],
				mockModel,
				testHash,
				doculaConsole,
				cache,
			);
			expect(result?.[0].title).toBe("Cached Changelog Title");
			expect(result?.[0].preview).toBe("Cached preview text");
		});

		it("should skip changelog entries with very short content", async () => {
			const doculaConsole = new DoculaConsole();
			const cache: AIMetadataCache = {};

			const entry = makeChangelogEntry({
				title: "",
				preview: "",
				content: "hi",
			});
			const result = await enrichChangelogEntries(
				[entry],
				mockModel,
				testHash,
				doculaConsole,
				cache,
			);
			expect(result?.[0].title).toBe("");
		});

		it("should handle AI errors gracefully for changelog", async () => {
			const doculaConsole = new DoculaConsole();
			const warnSpy = vi.spyOn(doculaConsole, "warn");
			const cache: AIMetadataCache = {};

			vi.doMock("writr", async (importOriginal) => {
				const original = await importOriginal<typeof import("writr")>();
				return {
					...original,
					Writr: class extends original.Writr {
						get ai() {
							return {
								getMetadata: () => {
									throw new Error("AI API error");
								},
							} as unknown as Writr["ai"];
						}
					},
				};
			});

			const { enrichChangelogEntries: enrichChangelogMocked } = await import(
				"../src/builder-ai.js"
			);

			const entry = makeChangelogEntry({ title: "", preview: "" });
			const result = await enrichChangelogMocked(
				[entry],
				mockModel,
				testHash,
				doculaConsole,
				cache,
			);

			expect(result?.[0].title).toBe("");
			expect(warnSpy).toHaveBeenCalled();

			vi.doUnmock("writr");
		});

		it("should use summary as fallback for preview", async () => {
			const doculaConsole = new DoculaConsole();
			const entry = makeChangelogEntry({ title: "Title", preview: "" });
			const bodyHash = testHash.toHashSync(entry.content);
			const cache: AIMetadataCache = {
				[bodyHash]: {
					title: "AI Title",
					summary: "Summary as fallback preview",
				},
			};

			const result = await enrichChangelogEntries(
				[entry],
				mockModel,
				testHash,
				doculaConsole,
				cache,
			);
			expect(result?.[0].preview).toBe("Summary as fallback preview");
		});
	});
});
