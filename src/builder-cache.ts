import fs from "node:fs";
import path from "node:path";
import type { Hashery } from "hashery";
import type { DoculaConsole } from "./console.js";
import type { DoculaOptions } from "./options.js";
import type {
	BuildManifest,
	DoculaChangelogEntry,
	DoculaDocument,
} from "./types.js";

export function loadBuildManifest(sitePath: string): BuildManifest | undefined {
	const manifestPath = path.join(sitePath, ".cache", "build", "manifest.json");
	if (!fs.existsSync(manifestPath)) {
		return undefined;
	}

	try {
		const data = JSON.parse(
			fs.readFileSync(manifestPath, "utf8"),
		) as BuildManifest;
		if (data.version !== 1) {
			return undefined;
		}

		return data;
	} catch {
		return undefined;
	}
}

export function saveBuildManifest(
	sitePath: string,
	manifest: BuildManifest,
): void {
	const dir = path.join(sitePath, ".cache", "build");
	fs.mkdirSync(dir, { recursive: true });
	fs.writeFileSync(path.join(dir, "manifest.json"), JSON.stringify(manifest));
}

export function hashFile(hash: Hashery, filePath: string): string {
	const content = fs.readFileSync(filePath);
	return hash.toHashSync(content);
}

export function hashOptions(hash: Hashery, options: DoculaOptions): string {
	const relevant = {
		siteUrl: options.siteUrl,
		siteTitle: options.siteTitle,
		siteDescription: options.siteDescription,
		githubPath: options.githubPath,
		template: options.template,
		templatePath: options.templatePath,
		enableLlmsTxt: options.enableLlmsTxt,
		changelogPerPage: options.changelogPerPage,
		enableReleaseChangelog: options.enableReleaseChangelog,
		sections: options.sections,
		openApiUrl: options.openApiUrl,
		themeMode: options.themeMode,
		cookieAuth: options.cookieAuth,
		headerLinks: options.headerLinks,
		editPageUrl: options.editPageUrl,
		openGraph: options.openGraph,
		autoReadme: options.autoReadme,
		baseUrl: options.baseUrl,
		docsPath: options.docsPath,
		apiPath: options.apiPath,
		changelogPath: options.changelogPath,
	};
	return hash.toHashSync(JSON.stringify(relevant));
}

export function hashTemplateDirectory(
	hash: Hashery,
	templatePath: string,
): string {
	/* v8 ignore next 3 -- @preserve */
	if (!fs.existsSync(templatePath)) {
		return "";
	}

	const files = listFilesRecursive(templatePath);
	const hashes = files.map((f) => hashFile(hash, path.join(templatePath, f)));
	return hash.toHashSync(hashes.join(""));
}

export function hashSourceFiles(
	hash: Hashery,
	dir: string,
): Record<string, string> {
	const hashes: Record<string, string> = {};
	if (!fs.existsSync(dir)) {
		return hashes;
	}

	const files = listFilesRecursive(dir);
	for (const file of files) {
		const fullPath = path.join(dir, file);
		hashes[file] = hashFile(hash, fullPath);
	}

	return hashes;
}

export function recordsEqual(
	a: Record<string, string>,
	b: Record<string, string>,
): boolean {
	const keysA = Object.keys(a);
	const keysB = Object.keys(b);
	if (keysA.length !== keysB.length) {
		return false;
	}

	for (const key of keysA) {
		if (a[key] !== b[key]) {
			return false;
		}
	}

	return true;
}

export function hasAssetsChanged(
	hash: Hashery,
	sitePath: string,
	previousAssets: Record<string, string>,
): boolean {
	const assetFiles = [
		"favicon.ico",
		"logo.svg",
		"logo_horizontal.png",
		"variables.css",
		"api/swagger.json",
		"README.md",
	];
	for (const file of assetFiles) {
		const filePath = path.join(sitePath, file);
		if (fs.existsSync(filePath)) {
			const fileHash = hashFile(hash, filePath);
			if (previousAssets[file] !== fileHash) {
				return true;
			}
		} else if (previousAssets[file]) {
			return true;
		}
	}

	// Check public folder
	const publicPath = path.join(sitePath, "public");
	if (fs.existsSync(publicPath)) {
		const publicHashes = hashSourceFiles(hash, publicPath);
		for (const [file, fileHash] of Object.entries(publicHashes)) {
			if (previousAssets[`public/${file}`] !== fileHash) {
				return true;
			}
		}
	}

	return false;
}

export function hashAssetAndCheckSkip(
	hash: Hashery,
	sourcePath: string,
	targetPath: string,
	assetKey: string,
	previousAssets: Record<string, string>,
	currentAssets: Record<string, string>,
): boolean {
	if (!fs.existsSync(sourcePath)) {
		return true;
	}

	const fileHash = hashFile(hash, sourcePath);
	currentAssets[assetKey] = fileHash;

	if (previousAssets[assetKey] === fileHash && fs.existsSync(targetPath)) {
		return true;
	}

	return false;
}

export function loadCachedDocuments(
	sitePath: string,
): Map<string, DoculaDocument> {
	const cachePath = path.join(sitePath, ".cache", "build", "documents.json");
	/* v8 ignore next 3 -- @preserve */
	if (!fs.existsSync(cachePath)) {
		return new Map();
	}

	try {
		const data = JSON.parse(fs.readFileSync(cachePath, "utf8")) as Record<
			string,
			DoculaDocument
		>;
		return new Map(Object.entries(data));
	} catch {
		/* v8 ignore next -- @preserve */
		return new Map();
	}
}

export function saveCachedDocuments(
	sitePath: string,
	documents: DoculaDocument[],
): void {
	const dir = path.join(sitePath, ".cache", "build");
	fs.mkdirSync(dir, { recursive: true });
	const docsRoot = path.join(sitePath, "docs");
	const map: Record<string, DoculaDocument> = {};
	for (const doc of documents) {
		const relativeKey = path.relative(docsRoot, doc.documentPath);
		map[relativeKey] = doc;
	}

	fs.writeFileSync(path.join(dir, "documents.json"), JSON.stringify(map));
}

export function loadCachedChangelog(
	sitePath: string,
): Map<string, DoculaChangelogEntry> {
	const cachePath = path.join(sitePath, ".cache", "build", "changelog.json");
	/* v8 ignore next 3 -- @preserve */
	if (!fs.existsSync(cachePath)) {
		return new Map();
	}

	try {
		const data = JSON.parse(fs.readFileSync(cachePath, "utf8")) as Record<
			string,
			DoculaChangelogEntry
		>;
		return new Map(Object.entries(data));
	} catch {
		return new Map();
	}
}

export function saveCachedChangelog(
	sitePath: string,
	entries: DoculaChangelogEntry[],
): void {
	const dir = path.join(sitePath, ".cache", "build");
	fs.mkdirSync(dir, { recursive: true });
	const map: Record<string, DoculaChangelogEntry> = {};
	for (const entry of entries) {
		map[entry.slug] = entry;
	}

	fs.writeFileSync(path.join(dir, "changelog.json"), JSON.stringify(map));
}

export function ensureCacheInGitignore(
	options: DoculaOptions,
	console: DoculaConsole,
	sitePath: string,
): void {
	if (!options.autoUpdateIgnores) {
		return;
	}

	// Only act when .cache doesn't exist yet (first creation)
	const cacheDir = path.join(sitePath, ".cache");
	if (fs.existsSync(cacheDir)) {
		return;
	}

	const gitignorePath = path.join(sitePath, ".gitignore");
	const entry = ".cache";

	if (fs.existsSync(gitignorePath)) {
		const content = fs.readFileSync(gitignorePath, "utf8");
		if (!content.split("\n").some((line) => line.trim() === entry)) {
			fs.appendFileSync(gitignorePath, `\n${entry}\n`);
			console.info(`Added ${entry} to .gitignore`);
		}
	} else {
		fs.writeFileSync(gitignorePath, `${entry}\n`);
		console.info("Created .gitignore with .cache");
	}
}

export function listFilesRecursive(dir: string, prefix = ""): string[] {
	const results: string[] = [];
	const entries = fs.readdirSync(dir);
	for (const entry of entries) {
		/* v8 ignore next -- @preserve */
		if (entry.startsWith(".")) {
			continue;
		}

		const fullPath = path.join(dir, entry);
		const relativePath = prefix ? `${prefix}/${entry}` : entry;
		const stat = fs.lstatSync(fullPath);
		/* v8 ignore next 3 -- @preserve */
		if (stat.isSymbolicLink()) {
			continue;
		}

		if (stat.isDirectory()) {
			results.push(...listFilesRecursive(fullPath, relativePath));
		} else {
			results.push(relativePath);
		}
	}

	return results;
}
