import fs from "node:fs";
import path from "node:path";

/**
 * Returns the base directory for built-in templates.
 */
export function getBuiltInTemplatesDir(): string {
	return path.join(import.meta.url, "../../templates").replace("file:", "");
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
