import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	cleanupExtractedTemplates,
	getBuiltInTemplatesDir,
	getExtractedTemplatesDir,
	getExtractedTemplatesPath,
	isSEA,
	listBuiltInTemplates,
	resolveTemplatePath,
	setEmbeddedTemplates,
} from "../src/template-resolver.js";

describe("template-resolver", () => {
	describe("getBuiltInTemplatesDir", () => {
		it("should return a path containing 'templates'", () => {
			const dir = getBuiltInTemplatesDir();
			expect(dir).toContain("templates");
		});

		it("should fall through to normalDir when not in SEA mode and templates dir is missing", () => {
			const normalDir = getBuiltInTemplatesDir();
			const backupDir = `${normalDir}.__test_backup__`;
			fs.renameSync(normalDir, backupDir);
			try {
				const dir = getBuiltInTemplatesDir();
				// Should still return the normalDir path even though it doesn't exist
				expect(dir).toContain("templates");
				expect(dir).toBe(normalDir);
			} finally {
				fs.renameSync(backupDir, normalDir);
			}
		});

		it("should return extracted templates dir when in SEA mode and templates dir is missing", () => {
			const normalDir = getBuiltInTemplatesDir();
			const backupDir = `${normalDir}.__test_backup__`;
			const tmpDir = getExtractedTemplatesPath();

			setEmbeddedTemplates({
				"modern/home.hbs": Buffer.from("<h1>SEA</h1>").toString("base64"),
			});
			// @ts-expect-error -- only exists in SEA builds
			process.sea = true;
			fs.renameSync(normalDir, backupDir);
			try {
				const dir = getBuiltInTemplatesDir();
				expect(dir).toBe(tmpDir);
			} finally {
				fs.renameSync(backupDir, normalDir);
				fs.rmSync(tmpDir, { recursive: true, force: true });
				// @ts-expect-error -- test cleanup
				delete process.sea;
				setEmbeddedTemplates(undefined as unknown as Record<string, string>);
			}
		});
	});

	describe("listBuiltInTemplates", () => {
		it("should return an array containing 'classic' and 'modern'", () => {
			const templates = listBuiltInTemplates();
			expect(templates).toContain("classic");
			expect(templates).toContain("modern");
		});
	});

	describe("resolveTemplatePath", () => {
		it("should return the explicit templatePath when provided", () => {
			const result = resolveTemplatePath("/custom/path", "classic");
			expect(result).toBe("/custom/path");
		});

		it("should resolve to the built-in classic template when templatePath is empty", () => {
			const result = resolveTemplatePath("", "classic");
			expect(result).toContain("templates/classic");
		});

		it("should resolve to the built-in modern template", () => {
			const result = resolveTemplatePath("", "modern");
			expect(result).toContain("templates/modern");
		});

		it("should throw an error for unknown template name", () => {
			expect(() => resolveTemplatePath("", "nonexistent")).toThrow(
				'Built-in template "nonexistent" not found',
			);
		});

		it("should list available templates in the error message", () => {
			expect(() => resolveTemplatePath("", "nonexistent")).toThrow("classic");
		});
	});

	describe("setEmbeddedTemplates", () => {
		afterEach(() => {
			setEmbeddedTemplates(undefined as unknown as Record<string, string>);
		});

		it("should accept a templates record", () => {
			expect(() =>
				setEmbeddedTemplates({ "test/file.hbs": "dGVzdA==" }),
			).not.toThrow();
		});
	});

	describe("isSEA", () => {
		afterEach(() => {
			// @ts-expect-error -- test cleanup
			delete process.sea;
		});

		it("should return false when not in SEA mode", () => {
			expect(isSEA()).toBe(false);
		});

		it("should return true when process.sea is set", () => {
			// @ts-expect-error -- only exists in SEA builds
			process.sea = true;
			expect(isSEA()).toBe(true);
		});
	});

	describe("getExtractedTemplatesPath", () => {
		it("should return a deterministic path based on process.pid", () => {
			const result = getExtractedTemplatesPath();
			expect(result).toContain(`docula-templates-${process.pid}`);
		});

		it("should return the same path on repeated calls", () => {
			expect(getExtractedTemplatesPath()).toBe(getExtractedTemplatesPath());
		});
	});

	describe("cleanupExtractedTemplates", () => {
		it("should remove the extracted templates directory", () => {
			const tmpDir = getExtractedTemplatesPath();
			fs.mkdirSync(tmpDir, { recursive: true });
			fs.writeFileSync(path.join(tmpDir, "test.txt"), "hello");
			expect(fs.existsSync(tmpDir)).toBe(true);

			cleanupExtractedTemplates();

			expect(fs.existsSync(tmpDir)).toBe(false);
		});

		it("should not throw if the directory does not exist", () => {
			const tmpDir = getExtractedTemplatesPath();
			fs.rmSync(tmpDir, { recursive: true, force: true });

			expect(() => cleanupExtractedTemplates()).not.toThrow();
		});
	});

	describe("getExtractedTemplatesDir", () => {
		const tmpDir = getExtractedTemplatesPath();

		beforeEach(() => {
			fs.rmSync(tmpDir, { recursive: true, force: true });
		});

		afterEach(() => {
			fs.rmSync(tmpDir, { recursive: true, force: true });
			setEmbeddedTemplates(undefined as unknown as Record<string, string>);
		});

		it("should throw when embedded templates are not registered", () => {
			expect(() => getExtractedTemplatesDir()).toThrow(
				"Embedded templates not registered",
			);
		});

		it("should extract templates to the temp directory", () => {
			const testTemplates = {
				"modern/home.hbs": Buffer.from("<h1>Test Home</h1>").toString("base64"),
				"modern/docs.hbs": Buffer.from("<h1>Test Docs</h1>").toString("base64"),
				"classic/home.hbs": Buffer.from("<h1>Classic Home</h1>").toString(
					"base64",
				),
			};

			setEmbeddedTemplates(testTemplates);

			const dir = getExtractedTemplatesDir();

			expect(dir).toBe(tmpDir);
			expect(fs.existsSync(path.join(tmpDir, "modern/home.hbs"))).toBe(true);
			expect(fs.existsSync(path.join(tmpDir, "modern/docs.hbs"))).toBe(true);
			expect(fs.existsSync(path.join(tmpDir, "classic/home.hbs"))).toBe(true);

			const content = fs.readFileSync(
				path.join(tmpDir, "modern/home.hbs"),
				"utf-8",
			);
			expect(content).toBe("<h1>Test Home</h1>");
		});

		it("should return the existing temp dir without re-extracting", () => {
			setEmbeddedTemplates({
				"modern/home.hbs": Buffer.from("test").toString("base64"),
			});

			// Pre-create the temp dir (empty) to simulate prior extraction
			fs.mkdirSync(tmpDir, { recursive: true });

			const dir = getExtractedTemplatesDir();

			expect(dir).toBe(tmpDir);
			// The file should NOT exist since extraction was skipped
			expect(fs.existsSync(path.join(tmpDir, "modern/home.hbs"))).toBe(false);
		});

		it("should create nested directories for template files", () => {
			const testTemplates = {
				"modern/includes/partials/header.hbs":
					Buffer.from("<header/>").toString("base64"),
			};

			setEmbeddedTemplates(testTemplates);

			const dir = getExtractedTemplatesDir();

			expect(dir).toBe(tmpDir);
			expect(
				fs.existsSync(path.join(tmpDir, "modern/includes/partials/header.hbs")),
			).toBe(true);
		});
	});
});
