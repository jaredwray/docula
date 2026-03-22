import fs from "node:fs";
import path from "node:path";
import type { Hashery } from "hashery";
import {
	ensureCacheInGitignore,
	hashFile,
	listFilesRecursive,
} from "./builder-cache.js";
import { isPathWithinBasePath } from "./builder-utils.js";
import type { DoculaConsole } from "./console.js";
import type { DoculaOptions } from "./options.js";
import type { DoculaData } from "./types.js";

export function copyDirectory(source: string, target: string): void {
	const files = fs.readdirSync(source);

	for (const file of files) {
		/* v8 ignore next -- @preserve */
		if (file.startsWith(".")) {
			continue;
		}

		const sourcePath = `${source}/${file}`;
		const targetPath = `${target}/${file}`;

		const stat = fs.lstatSync(sourcePath);

		// Skip symbolic links to prevent copying sensitive files
		/* v8 ignore next 3 -- @preserve */
		if (stat.isSymbolicLink()) {
			continue;
		}

		if (stat.isDirectory()) {
			fs.mkdirSync(targetPath, { recursive: true });
			copyDirectory(sourcePath, targetPath);
		} else {
			fs.mkdirSync(target, { recursive: true });
			fs.copyFileSync(sourcePath, targetPath);
		}
	}
}

export function copyPublicFolder(
	console: DoculaConsole,
	hash: Hashery,
	sitePath: string,
	output: string,
	previousAssets: Record<string, string>,
	currentAssets: Record<string, string>,
): void {
	const publicPath = `${sitePath}/public`;

	if (!fs.existsSync(publicPath)) {
		return;
	}

	console.step("Copying public folder...");

	const resolvedOutput = path.resolve(output);
	copyPublicDirectory(
		console,
		hash,
		publicPath,
		output,
		publicPath,
		resolvedOutput,
		previousAssets,
		currentAssets,
	);
}

export function copyPublicDirectory(
	console: DoculaConsole,
	hash: Hashery,
	source: string,
	target: string,
	basePath: string,
	output: string,
	previousAssets: Record<string, string>,
	currentAssets: Record<string, string>,
): void {
	const files = fs.readdirSync(source);

	for (const file of files) {
		const sourcePath = `${source}/${file}`;
		const targetPath = `${target}/${file}`;
		const relativePath = sourcePath.replace(`${basePath}/`, "");

		// Skip if source path is inside or equals the output path to prevent recursive copying
		const resolvedSourcePath = path.resolve(sourcePath);
		if (
			resolvedSourcePath === output ||
			resolvedSourcePath.startsWith(`${output}${path.sep}`)
		) {
			continue;
		}

		const stat = fs.lstatSync(sourcePath);

		// Skip symbolic links to prevent copying sensitive files
		/* v8 ignore next 3 -- @preserve */
		if (stat.isSymbolicLink()) {
			continue;
		}

		if (stat.isDirectory()) {
			fs.mkdirSync(targetPath, { recursive: true });
			copyPublicDirectory(
				console,
				hash,
				sourcePath,
				targetPath,
				basePath,
				output,
				previousAssets,
				currentAssets,
			);
		} else {
			const assetKey = `public/${relativePath}`;
			const fileHash = hashFile(hash, sourcePath);
			currentAssets[assetKey] = fileHash;

			// Skip copy if file hasn't changed
			if (previousAssets[assetKey] === fileHash && fs.existsSync(targetPath)) {
				continue;
			}

			fs.mkdirSync(target, { recursive: true });
			fs.copyFileSync(sourcePath, targetPath);
			console.fileCopied(relativePath);
		}
	}
}

export function copyDocumentSiblingAssets(
	options: DoculaOptions,
	data: DoculaData,
): void {
	/* v8 ignore next 4 -- @preserve */
	if (!data.documents) {
		return;
	}

	for (const document of data.documents) {
		const sourceDir = path.dirname(document.documentPath);
		const outputDir = `${data.output}${path.dirname(document.urlPath)}`;
		const availableAssets = listContentAssets(options, sourceDir);

		for (const assetRelPath of availableAssets) {
			if (document.markdown.includes(assetRelPath)) {
				const source = path.join(sourceDir, assetRelPath);
				// Skip symbolic links to prevent copying sensitive files
				/* v8 ignore next 3 -- @preserve */
				if (fs.lstatSync(source).isSymbolicLink()) {
					continue;
				}

				const target = path.join(outputDir, assetRelPath);
				fs.mkdirSync(path.dirname(target), { recursive: true });
				fs.copyFileSync(source, target);
			}
		}
	}
}

export function listContentAssets(
	options: DoculaOptions,
	sourcePath: string,
	basePath?: string,
): string[] {
	const root = basePath ?? sourcePath;
	const results: string[] = [];

	/* v8 ignore start -- @preserve */
	if (!fs.existsSync(sourcePath)) {
		return results;
	}

	const files = fs.readdirSync(sourcePath);

	for (const file of files) {
		if (file.startsWith(".")) {
			continue;
		}
		/* v8 ignore stop */

		const fullPath = `${sourcePath}/${file}`;
		const stat = fs.lstatSync(fullPath);

		// Skip symbolic links to prevent exposing sensitive files
		/* v8 ignore next 3 -- @preserve */
		if (stat.isSymbolicLink()) {
			continue;
		}

		if (stat.isDirectory()) {
			results.push(...listContentAssets(options, fullPath, root));
		} else {
			const ext = path.extname(file).toLowerCase();
			if (options.allowedAssets.includes(ext)) {
				results.push(path.relative(root, fullPath));
			}
		}
	}

	return results;
}

export function copyDirectoryWithHashing(
	hash: Hashery,
	source: string,
	target: string,
	prefix: string,
	previousAssets: Record<string, string>,
	currentAssets: Record<string, string>,
): void {
	/* v8 ignore next 3 -- @preserve */
	if (!fs.existsSync(source)) {
		return;
	}

	const files = fs.readdirSync(source);
	for (const file of files) {
		/* v8 ignore next -- @preserve */
		if (file.startsWith(".")) {
			continue;
		}

		const sourcePath = `${source}/${file}`;
		const targetPath = `${target}/${file}`;
		/* v8 ignore next -- @preserve */
		const assetKey = prefix ? `${prefix}/${file}` : file;
		const stat = fs.lstatSync(sourcePath);

		/* v8 ignore next 3 -- @preserve */
		if (stat.isSymbolicLink()) {
			continue;
		}

		if (stat.isDirectory()) {
			copyDirectoryWithHashing(
				hash,
				sourcePath,
				targetPath,
				assetKey,
				previousAssets,
				currentAssets,
			);
		} else {
			const fileHash = hashFile(hash, sourcePath);
			currentAssets[assetKey] = fileHash;
			if (previousAssets[assetKey] === fileHash && fs.existsSync(targetPath)) {
				continue;
			}

			fs.mkdirSync(target, { recursive: true });
			fs.copyFileSync(sourcePath, targetPath);
		}
	}
}

export function copyContentAssets(
	options: DoculaOptions,
	sourcePath: string,
	targetPath: string,
): void {
	if (!fs.existsSync(sourcePath)) {
		return;
	}

	const files = fs.readdirSync(sourcePath);

	for (const file of files) {
		/* v8 ignore next -- @preserve */
		if (file.startsWith(".")) {
			continue;
		}

		const source = `${sourcePath}/${file}`;
		const target = `${targetPath}/${file}`;
		const stat = fs.lstatSync(source);

		// Skip symbolic links to prevent copying sensitive files
		/* v8 ignore next 3 -- @preserve */
		if (stat.isSymbolicLink()) {
			continue;
		}

		if (stat.isDirectory()) {
			copyContentAssets(options, source, target);
		} else {
			const ext = path.extname(file).toLowerCase();
			if (options.allowedAssets.includes(ext)) {
				fs.mkdirSync(targetPath, { recursive: true });
				fs.copyFileSync(source, target);
			}
		}
	}
}

export function mergeTemplateOverrides(
	options: DoculaOptions,
	console: DoculaConsole,
	hash: Hashery,
	resolvedTemplatePath: string,
	sitePath: string,
	templateName: string,
): string {
	// Only apply overrides for built-in templates (not custom templatePath)
	if (options.templatePath) {
		return resolvedTemplatePath;
	}

	const overrideDir = path.join(sitePath, "templates", templateName);
	const cacheDir = path.join(sitePath, ".cache", "templates", templateName);

	// Validate that resolved paths stay within sitePath to prevent path traversal
	if (
		!isPathWithinBasePath(overrideDir, sitePath) ||
		!isPathWithinBasePath(cacheDir, sitePath)
	) {
		return resolvedTemplatePath;
	}

	if (!fs.existsSync(overrideDir)) {
		return resolvedTemplatePath;
	}

	const overrideFiles = listFilesRecursive(overrideDir);

	// Check if we can reuse or incrementally update the existing cache
	if (fs.existsSync(cacheDir)) {
		const diff = getChangedOverrides(
			hash,
			overrideDir,
			cacheDir,
			overrideFiles,
		);

		if (diff) {
			const hasChanges =
				diff.added.length > 0 ||
				diff.changed.length > 0 ||
				diff.removed.length > 0;

			if (!hasChanges) {
				console.step("Using cached template overrides...");
				return cacheDir;
			}

			// Apply incremental updates
			console.step("Updating template overrides...");

			for (const file of diff.added) {
				console.info(`Template override added: ${file}`);
				const targetFilePath = path.join(cacheDir, file);
				fs.mkdirSync(path.dirname(targetFilePath), { recursive: true });
				fs.copyFileSync(path.join(overrideDir, file), targetFilePath);
			}

			for (const file of diff.changed) {
				console.info(`Template override changed: ${file}`);
				const targetFilePath = path.join(cacheDir, file);
				fs.mkdirSync(path.dirname(targetFilePath), { recursive: true });
				fs.copyFileSync(path.join(overrideDir, file), targetFilePath);
			}

			for (const file of diff.removed) {
				console.info(`Template override removed: ${file}`);
				const cachedPath = path.join(cacheDir, file);
				// Restore original template file if it exists
				const originalPath = path.join(resolvedTemplatePath, file);
				/* v8 ignore next 4 -- @preserve */
				if (fs.existsSync(originalPath)) {
					fs.copyFileSync(originalPath, cachedPath);
				} else if (fs.existsSync(cachedPath)) {
					fs.unlinkSync(cachedPath);
				}
			}

			// Update manifest with current hashes
			const manifestPath = path.join(cacheDir, ".manifest.json");
			fs.writeFileSync(manifestPath, JSON.stringify(diff.currentHashes));

			return cacheDir;
		}
	}

	// Full rebuild: no cache or corrupt manifest
	/* v8 ignore next 5 -- @preserve */
	if (overrideFiles.length > 0) {
		console.step("Applying template overrides...");
		for (const file of overrideFiles) {
			console.info(`Template override: ${file}`);
		}
	}

	// Ensure .cache is in .gitignore before first creation
	ensureCacheInGitignore(options, console, sitePath);

	// Create cache directory and merge templates
	if (fs.existsSync(cacheDir)) {
		fs.rmSync(cacheDir, { recursive: true, force: true });
	}

	fs.mkdirSync(cacheDir, { recursive: true });

	// Copy built-in template first
	copyDirectory(resolvedTemplatePath, cacheDir);

	// Overlay user overrides on top
	copyDirectory(overrideDir, cacheDir);

	// Write manifest with content hashes
	const currentHashes: Record<string, string> = {};
	for (const file of overrideFiles) {
		currentHashes[file] = hashFile(hash, path.join(overrideDir, file));
	}

	const manifestPath = path.join(cacheDir, ".manifest.json");
	fs.writeFileSync(manifestPath, JSON.stringify(currentHashes));

	return cacheDir;
}

export function getChangedOverrides(
	hash: Hashery,
	overrideDir: string,
	cacheDir: string,
	overrideFiles: string[],
):
	| {
			added: string[];
			changed: string[];
			removed: string[];
			currentHashes: Record<string, string>;
	  }
	| undefined {
	const manifestPath = path.join(cacheDir, ".manifest.json");
	if (!fs.existsSync(manifestPath)) {
		return undefined;
	}

	let previousHashes: Record<string, string>;
	try {
		previousHashes = JSON.parse(
			fs.readFileSync(manifestPath, "utf8"),
		) as Record<string, string>;
	} catch {
		return undefined;
	}

	// Compute current hashes
	const currentHashes: Record<string, string> = {};
	for (const file of overrideFiles) {
		currentHashes[file] = hashFile(hash, path.join(overrideDir, file));
	}

	const added: string[] = [];
	const changed: string[] = [];
	const removed: string[] = [];

	// Find added and changed files
	for (const file of overrideFiles) {
		if (!(file in previousHashes)) {
			added.push(file);
		} else if (currentHashes[file] !== previousHashes[file]) {
			changed.push(file);
		}
	}

	// Find removed files
	for (const file of Object.keys(previousHashes)) {
		if (!overrideFiles.includes(file)) {
			removed.push(file);
		}
	}

	return { added, changed, removed, currentHashes };
}
