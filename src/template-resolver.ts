import fs from "node:fs";
import os from "node:os";
import path from "node:path";

let embeddedTemplates: Record<string, string> | undefined;

/**
 * Registers embedded template data for use in SEA builds.
 * Must be called before any template resolution occurs.
 */
export function setEmbeddedTemplates(templates: Record<string, string>): void {
	embeddedTemplates = templates;
}

/**
 * Returns true when running as a single-executable application (SEA).
 */
function isSEA(): boolean {
	try {
		// Node.js SEA sets this flag at compile time
		// @ts-expect-error -- only exists in SEA builds
		return Boolean(process.sea);
	} catch {
		return false;
	}
}

/**
 * Returns the deterministic temp directory path for extracted templates.
 */
function getExtractedTemplatesPath(): string {
	return path.join(os.tmpdir(), `docula-templates-${process.pid}`);
}

/**
 * Cleans up extracted template files from the temp directory.
 */
function cleanupExtractedTemplates(): void {
	try {
		const tmpDir = getExtractedTemplatesPath();
		fs.rmSync(tmpDir, { recursive: true, force: true });
	} catch {
		// Best effort cleanup
	}
}

/**
 * Extracts embedded templates to a temporary directory and returns the path.
 * Uses a deterministic path based on process.pid, so repeated calls
 * return the same directory without module-level state.
 */
function getExtractedTemplatesDir(): string {
	const tmpDir = getExtractedTemplatesPath();

	// Already extracted in a previous call
	if (fs.existsSync(tmpDir)) {
		return tmpDir;
	}

	if (!embeddedTemplates) {
		throw new Error(
			"Embedded templates not registered. Call setEmbeddedTemplates() before resolving templates in SEA mode.",
		);
	}

	fs.mkdirSync(tmpDir, { recursive: true });

	for (const [relativePath, base64Content] of Object.entries(
		embeddedTemplates,
	)) {
		const fullPath = path.join(tmpDir, relativePath);
		fs.mkdirSync(path.dirname(fullPath), { recursive: true });
		fs.writeFileSync(fullPath, Buffer.from(base64Content, "base64"));
	}

	// Clean up on exit and common termination signals
	process.on("exit", cleanupExtractedTemplates);
	process.on("SIGINT", () => {
		cleanupExtractedTemplates();
		process.exit(130);
	});
	process.on("SIGTERM", () => {
		cleanupExtractedTemplates();
		process.exit(143);
	});

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
