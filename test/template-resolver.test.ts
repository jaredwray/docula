import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import sea from "node:sea";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	cleanupExtractedTemplates,
	getBuiltInTemplatesDir,
	getExtractedTemplatesDir,
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
			// Simulate the templates dir being absent without mutating the real
			// on-disk directory (which other parallel test files read from).
			const existsSpy = vi.spyOn(fs, "existsSync").mockReturnValue(false);
			try {
				const dir = getBuiltInTemplatesDir();
				// Should still return the normalDir path even though it doesn't exist
				expect(dir).toContain("templates");
				expect(dir).toBe(normalDir);
			} finally {
				existsSpy.mockRestore();
			}
		});

		it("should return extracted templates dir when in SEA mode and templates dir is missing", () => {
			setEmbeddedTemplates({
				"modern/home.hbs": Buffer.from("<h1>SEA</h1>").toString("base64"),
			});
			// Force the "templates dir missing" path without renaming the real
			// directory; extraction (mkdtemp/writeFile) still happens for real.
			const existsSpy = vi.spyOn(fs, "existsSync").mockReturnValue(false);
			const isSeaSpy = vi.spyOn(sea, "isSea").mockReturnValue(true);
			try {
				const dir = getBuiltInTemplatesDir();
				expect(fs.readFileSync(path.join(dir, "modern/home.hbs"), "utf8")).toBe(
					"<h1>SEA</h1>",
				);
			} finally {
				existsSpy.mockRestore();
				isSeaSpy.mockRestore();
				cleanupExtractedTemplates();
				setEmbeddedTemplates(undefined);
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
			setEmbeddedTemplates(undefined);
		});

		it("should accept a templates record", () => {
			expect(() =>
				setEmbeddedTemplates({ "test/file.hbs": "dGVzdA==" }),
			).not.toThrow();
		});
	});

	describe("isSEA", () => {
		afterEach(() => {
			vi.restoreAllMocks();
		});

		it("should return false when not in SEA mode", () => {
			expect(isSEA()).toBe(false);
		});

		it("should return true when sea.isSea() reports true", () => {
			vi.spyOn(sea, "isSea").mockReturnValue(true);
			expect(isSEA()).toBe(true);
		});

		it("should return true when embedded templates are registered", () => {
			setEmbeddedTemplates({ "modern/home.hbs": "dGVzdA==" });
			try {
				expect(isSEA()).toBe(true);
			} finally {
				setEmbeddedTemplates(undefined);
			}
		});
	});

	describe("cleanupExtractedTemplates", () => {
		afterEach(() => {
			cleanupExtractedTemplates();
			setEmbeddedTemplates(undefined);
		});

		it("should remove the extracted templates directory", () => {
			setEmbeddedTemplates({
				"modern/home.hbs": Buffer.from("test").toString("base64"),
			});
			const tmpDir = getExtractedTemplatesDir();
			expect(fs.existsSync(path.join(tmpDir, "modern/home.hbs"))).toBe(true);

			cleanupExtractedTemplates();

			expect(fs.existsSync(tmpDir)).toBe(false);
		});

		// The SIGINT and SIGTERM handlers clean up and then exit, and the exit
		// handler cleans up again.
		it("should not throw when it is called a second time", () => {
			setEmbeddedTemplates({
				"modern/home.hbs": Buffer.from("test").toString("base64"),
			});
			getExtractedTemplatesDir();
			cleanupExtractedTemplates();

			expect(() => cleanupExtractedTemplates()).not.toThrow();
		});

		it("should not remove a path that replaced its directory", () => {
			setEmbeddedTemplates({
				"modern/home.hbs": Buffer.from("test").toString("base64"),
			});
			const firstDir = getExtractedTemplatesDir();
			fs.rmSync(firstDir, { recursive: true, force: true });
			const plantedDir = fs.mkdtempSync(path.join(os.tmpdir(), "planted-"));
			fs.symlinkSync(plantedDir, firstDir);

			try {
				cleanupExtractedTemplates();

				expect(fs.lstatSync(firstDir).isSymbolicLink()).toBe(true);
			} finally {
				fs.rmSync(firstDir, { force: true });
				fs.rmSync(plantedDir, { recursive: true, force: true });
			}
		});
	});

	describe("getExtractedTemplatesDir", () => {
		afterEach(() => {
			cleanupExtractedTemplates();
			setEmbeddedTemplates(undefined);
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

			expect(fs.existsSync(path.join(dir, "modern/home.hbs"))).toBe(true);
			expect(fs.existsSync(path.join(dir, "modern/docs.hbs"))).toBe(true);
			expect(fs.existsSync(path.join(dir, "classic/home.hbs"))).toBe(true);

			const content = fs.readFileSync(
				path.join(dir, "modern/home.hbs"),
				"utf-8",
			);
			expect(content).toBe("<h1>Test Home</h1>");
		});

		it("should return the same directory on repeated calls", () => {
			setEmbeddedTemplates({
				"modern/home.hbs": Buffer.from("test").toString("base64"),
			});

			const dir = getExtractedTemplatesDir();

			expect(getExtractedTemplatesDir()).toBe(dir);
		});

		it("should not use or remove a directory that it did not create", () => {
			// A different local user can create this path before Docula starts.
			// Earlier versions used it as the template root when it existed.
			const plantedDir = path.join(
				os.tmpdir(),
				`docula-templates-${process.pid}`,
			);
			const plantedFile = path.join(plantedDir, "modern/home.ejs");
			fs.mkdirSync(path.dirname(plantedFile), { recursive: true });
			fs.writeFileSync(plantedFile, "planted");

			try {
				setEmbeddedTemplates({
					"modern/home.hbs":
						Buffer.from("<h1>Embedded</h1>").toString("base64"),
				});

				const dir = getExtractedTemplatesDir();

				expect(dir).not.toBe(plantedDir);
				expect(fs.readdirSync(path.join(dir, "modern"))).toEqual(["home.hbs"]);
				expect(fs.readFileSync(path.join(dir, "modern/home.hbs"), "utf8")).toBe(
					"<h1>Embedded</h1>",
				);

				cleanupExtractedTemplates();

				expect(fs.existsSync(dir)).toBe(false);
				expect(fs.readFileSync(plantedFile, "utf8")).toBe("planted");
			} finally {
				fs.rmSync(plantedDir, { recursive: true, force: true });
			}
		});

		// A temp file cleanup can remove the directory while a `dev` or `serve`
		// process runs.
		it("should extract the templates again when the directory is gone", () => {
			setEmbeddedTemplates({
				"modern/home.hbs": Buffer.from("<h1>Embedded</h1>").toString("base64"),
			});
			const firstDir = getExtractedTemplatesDir();
			const exitListeners = process.listenerCount("exit");
			fs.rmSync(firstDir, { recursive: true, force: true });

			const dir = getExtractedTemplatesDir();

			expect(fs.readFileSync(path.join(dir, "modern/home.hbs"), "utf8")).toBe(
				"<h1>Embedded</h1>",
			);
			// The process must not get a new set of cleanup handlers each time.
			expect(process.listenerCount("exit")).toBe(exitListeners);
		});

		it("should not use a symbolic link that replaced its directory", () => {
			setEmbeddedTemplates({
				"modern/home.hbs": Buffer.from("<h1>Embedded</h1>").toString("base64"),
			});
			const firstDir = getExtractedTemplatesDir();
			fs.rmSync(firstDir, { recursive: true, force: true });
			const plantedDir = fs.mkdtempSync(path.join(os.tmpdir(), "planted-"));
			fs.mkdirSync(path.join(plantedDir, "modern"));
			fs.writeFileSync(path.join(plantedDir, "modern/home.ejs"), "planted");
			fs.symlinkSync(plantedDir, firstDir);

			try {
				const dir = getExtractedTemplatesDir();

				expect(dir).not.toBe(firstDir);
				expect(fs.readdirSync(path.join(dir, "modern"))).toEqual(["home.hbs"]);
			} finally {
				fs.rmSync(firstDir, { force: true });
				fs.rmSync(plantedDir, { recursive: true, force: true });
			}
		});

		// Windows reports no owner. There, only the file ID shows that the path
		// is a different directory.
		it("should not use a different directory at the same path", () => {
			setEmbeddedTemplates({
				"modern/home.hbs": Buffer.from("<h1>Embedded</h1>").toString("base64"),
			});
			const firstDir = getExtractedTemplatesDir();
			// The rename keeps the file ID of the first directory in use. Thus the
			// file system cannot give the same file ID to the planted directory.
			const movedDir = `${firstDir}-moved`;
			fs.renameSync(firstDir, movedDir);
			fs.mkdirSync(path.join(firstDir, "modern"), { recursive: true });
			fs.writeFileSync(path.join(firstDir, "modern/home.ejs"), "planted");

			try {
				const dir = getExtractedTemplatesDir();

				expect(dir).not.toBe(firstDir);
				expect(fs.readdirSync(path.join(dir, "modern"))).toEqual(["home.hbs"]);
			} finally {
				fs.rmSync(firstDir, { recursive: true, force: true });
				fs.rmSync(movedDir, { recursive: true, force: true });
			}
		});

		// A file system can give the file ID of a removed directory to a new
		// directory. The owner then shows that the directory is different.
		it("should not use a directory with a different owner", () => {
			setEmbeddedTemplates({
				"modern/home.hbs": Buffer.from("<h1>Embedded</h1>").toString("base64"),
			});
			const firstDir = getExtractedTemplatesDir();
			// The test cannot create a directory that a different user owns. Thus
			// `lstatSync` reports a different owner for the first directory.
			const lstatSync = fs.lstatSync;
			const lstatSpy = vi.spyOn(fs, "lstatSync").mockImplementation(((
				target: fs.PathLike,
			) => {
				const stat = lstatSync(target, { bigint: true });
				if (target === firstDir) {
					stat.uid += 1n;
				}

				return stat;
			}) as typeof fs.lstatSync);

			try {
				const dir = getExtractedTemplatesDir();

				expect(dir).not.toBe(firstDir);
				expect(fs.readdirSync(path.join(dir, "modern"))).toEqual(["home.hbs"]);
			} finally {
				lstatSpy.mockRestore();
				fs.rmSync(firstDir, { recursive: true, force: true });
			}
		});

		it("should create nested directories for template files", () => {
			const testTemplates = {
				"modern/includes/partials/header.hbs":
					Buffer.from("<header/>").toString("base64"),
			};

			setEmbeddedTemplates(testTemplates);

			const dir = getExtractedTemplatesDir();

			expect(
				fs.existsSync(path.join(dir, "modern/includes/partials/header.hbs")),
			).toBe(true);
		});
	});
});
