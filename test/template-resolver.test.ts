import { describe, expect, it } from "vitest";
import {
	getBuiltInTemplatesDir,
	listBuiltInTemplates,
	resolveTemplatePath,
} from "../src/template-resolver.js";

describe("template-resolver", () => {
	describe("getBuiltInTemplatesDir", () => {
		it("should return a path containing 'templates'", () => {
			const dir = getBuiltInTemplatesDir();
			expect(dir).toContain("templates");
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
});
