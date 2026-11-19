import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import sea from "node:sea";

type ExtractedTemplates = {
	dir: string;
	dev: bigint;
	ino: bigint;
	uid: bigint;
};

let embeddedTemplates: Record<string, string> | undefined;
let extractedTemplates: ExtractedTemplates | undefined;
let cleanupRegistered = false;

/**
 * Registers embedded template data for use in SEA builds.
 * Must be called before any template resolution occurs.
 * Pass `undefined` to clear the registry (used by tests).
 */
export function setEmbeddedTemplates(
	templates: Record<string, string> | undefined,
): void {
	embeddedTemplates = templates;
}

/**
 * Returns true when running as a standalone binary.
 *
 * Node's `sea.isSea()` is the official signal, but tsdown's `exe` wrapper
 * does not always report SEA. `sea-entry` always registers embedded
 * templates, so a populated registry is treated as the same mode.
 */
export function isSEA(): boolean {
	return sea.isSea() || embeddedTemplates !== undefined;
}

/**
 * Returns true if the path is still the directory that this process created.
 * A temp file cleanup can remove the directory while the process runs. A
 * different user can then create the same path.
 *
 * The device ID and the file ID identify the directory on all platforms.
 * Some file systems use a file ID again, thus the owner must also agree.
 * Windows always reports 0 for the owner.
 */
function isExtractedTemplatesDir(extracted: ExtractedTemplates): boolean {
	const stat = fs.lstatSync(extracted.dir, {
		bigint: true,
		throwIfNoEntry: false,
	});
	return (
		stat?.isDirectory() === true &&
		stat.dev === extracted.dev &&
		stat.ino === extracted.ino &&
		stat.uid === extracted.uid
	);
}

/**
 * Removes the temp directory that this process extracted the templates to.
 * This function does not remove a directory that this process did not create.
 */
export function cleanupExtractedTemplates(): void {
	const extracted = extractedTemplates;
	if (!extracted) {
		return;
	}

	extractedTemplates = undefined;
	try {
		if (isExtractedTemplatesDir(extracted)) {
			fs.rmSync(extracted.dir, { recursive: true, force: true });
		}
	} catch {
		// Best effort cleanup
	}
}

/**
 * Extracts embedded templates to a temporary directory and returns the path.
 * The first call creates the directory. Each later call returns the same path.
 * If the directory is gone, the function extracts the templates again.
 */
export function getExtractedTemplatesDir(): string {
	if (extractedTemplates && isExtractedTemplatesDir(extractedTemplates)) {
		return extractedTemplates.dir;
	}

	extractedTemplates = undefined;

	if (!embeddedTemplates) {
		throw new Error(
			"Embedded templates not registered. Call setEmbeddedTemplates() before resolving templates in SEA mode.",
		);
	}

	// Other users can write to the system temp directory. `mkdtempSync` always
	// creates a new directory, and its name is not predictable. Thus Docula
	// never uses a directory that a different user made as the template root.
	const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "docula-templates-"));
	const { dev, ino, uid } = fs.lstatSync(tmpDir, { bigint: true });

	for (const [relativePath, base64Content] of Object.entries(
		embeddedTemplates,
	)) {
		const fullPath = path.join(tmpDir, relativePath);
		fs.mkdirSync(path.dirname(fullPath), { recursive: true });
		fs.writeFileSync(fullPath, Buffer.from(base64Content, "base64"));
	}

	extractedTemplates = { dir: tmpDir, dev, ino, uid };

	// Clean up on exit and common termination signals
	if (!cleanupRegistered) {
		cleanupRegistered = true;
		process.on("exit", cleanupExtractedTemplates);
		/* v8 ignore start -- @preserve */
		process.on("SIGINT", () => {
			cleanupExtractedTemplates();
			process.exit(130);
		});
		process.on("SIGTERM", () => {
			cleanupExtractedTemplates();
			process.exit(143);
		});
		/* v8 ignore stop */
	}

	return tmpDir;
}

/**
 * Returns the base directory for built-in templates.
 */
export function getBuiltInTemplatesDir(): string {
	const normalDir = path
		.join(import.meta.url, "../../templates")
		.replace("file:", "");

	if (fs.existsSync(normalDir)) {
		return normalDir;
	}

	// When running as SEA or when templates dir is missing, use embedded templates
	if (isSEA()) {
		return getExtractedTemplatesDir();
	}

	return normalDir;
}

/**
 * Lists all available built-in template names by reading the templates directory.
 */
export function listBuiltInTemplates(): string[] {
	const templatesDir = getBuiltInTemplatesDir();
	/* v8 ignore next -- @preserve */
	if (!fs.existsSync(templatesDir)) {
		return [];
	}

	return fs
		.readdirSync(templatesDir)
		.filter((entry) =>
			fs.statSync(path.join(templatesDir, entry)).isDirectory(),
		);
}

/**
 * Resolves the template path based on the provided options.
 *
 * Resolution priority:
 * 1. Explicit `templatePath` (custom path) — highest priority, backward compatible
 * 2. Built-in template name via `templateName` (e.g., "modern", "classic")
 * 3. Falls back to "modern"
 */
export function resolveTemplatePath(
	templatePath: string,
	templateName: string,
): string {
	// If an explicit templatePath is provided, use it as-is
	if (templatePath) {
		return templatePath;
	}

	// Resolve to a built-in template
	const resolvedPath = path.join(getBuiltInTemplatesDir(), templateName);

	if (!fs.existsSync(resolvedPath)) {
		const available = listBuiltInTemplates();
		throw new Error(
			`Built-in template "${templateName}" not found. Available templates: ${available.join(", ")}`,
		);
	}

	return resolvedPath;
}
