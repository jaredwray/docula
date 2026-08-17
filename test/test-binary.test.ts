import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	type CommandResult,
	combinedOutput,
	defaultBinaryName,
	main,
	type RunCommand,
	resolveBinaryPath,
	runBinaryCommand,
	runBinaryHarness,
	SMOKE_SITE_TITLE,
	stripAnsi,
	writeSmokeSite,
	writeTypescriptOnlySite,
} from "../scripts/test-binary.js";
import { makeTempDir } from "./test-helpers.js";

function success(stdout = "", stderr = ""): CommandResult {
	return { exitCode: 0, stdout, stderr };
}

function failure(stdout = "", stderr = "boom", exitCode = 1): CommandResult {
	return { exitCode, stdout, stderr };
}

function writeBuildOutput(outputDir: string, title = SMOKE_SITE_TITLE): void {
	fs.mkdirSync(outputDir, { recursive: true });
	fs.writeFileSync(
		path.join(outputDir, "index.html"),
		`<html><title>${title}</title></html>`,
	);
	fs.writeFileSync(path.join(outputDir, "robots.txt"), "User-agent: *\n");
	fs.writeFileSync(path.join(outputDir, "sitemap.xml"), "<urlset></urlset>\n");
}

function createFakeBinary(): string {
	const dir = makeTempDir("binary-harness");
	const binaryPath = path.join(dir, "docula");
	fs.writeFileSync(binaryPath, "#!/bin/sh\n");
	return binaryPath;
}

function runnerFor(
	handlers: Record<string, (args: string[]) => CommandResult | undefined>,
): RunCommand {
	return async (_binaryPath, args) => {
		const command = args[0] ?? "";
		const handler = handlers[command];
		if (!handler) {
			return failure("", `unexpected command: ${command}`);
		}
		return handler(args) ?? success();
	};
}

describe("binary harness helpers", () => {
	it("strips ANSI color codes", () => {
		expect(stripAnsi("\u001B[32m2.2.0\u001B[0m")).toBe("2.2.0");
	});

	it("joins stdout and stderr", () => {
		expect(combinedOutput({ exitCode: 1, stdout: "out", stderr: "err" })).toBe(
			"out\nerr",
		);
	});

	it("picks the platform-specific default binary name", () => {
		expect(defaultBinaryName("linux")).toBe("docula");
		expect(defaultBinaryName("darwin")).toBe("docula");
		expect(defaultBinaryName("win32")).toBe("docula.exe");
	});

	it("resolves the binary from argv, env, then the default dist path", () => {
		expect(resolveBinaryPath(["./custom"], {}, "linux", "/repo")).toBe(
			path.resolve("/repo", "./custom"),
		);
		expect(
			resolveBinaryPath([], { DOCULA_BINARY: "/abs/docula" }, "linux", "/repo"),
		).toBe("/abs/docula");
		expect(resolveBinaryPath([], {}, "linux", "/repo")).toBe(
			path.resolve("/repo", "dist/docula"),
		);
		expect(resolveBinaryPath([], {}, "win32", "/repo")).toBe(
			path.resolve("/repo", "dist/docula.exe"),
		);
	});

	it("ignores a bare -- argv token when resolving the binary", () => {
		expect(resolveBinaryPath(["--"], {}, "linux", "/repo")).toBe(
			path.resolve("/repo", "dist/docula"),
		);
	});

	it("writes the smoke and TypeScript-only sites", () => {
		const smokeDir = makeTempDir("smoke-site");
		writeSmokeSite(smokeDir);
		expect(
			JSON.parse(
				fs.readFileSync(path.join(smokeDir, "docula.config.json"), "utf8"),
			).siteTitle,
		).toBe(SMOKE_SITE_TITLE);
		expect(fs.existsSync(path.join(smokeDir, "README.md"))).toBe(true);

		const tsDir = makeTempDir("ts-site");
		writeTypescriptOnlySite(tsDir);
		expect(fs.existsSync(path.join(tsDir, "docula.config.ts"))).toBe(true);
		expect(fs.existsSync(path.join(tsDir, "docula.config.json"))).toBe(false);
	});
});

describe("runBinaryCommand", () => {
	it("captures stdout from a successful process", async () => {
		const result = await runBinaryCommand(process.execPath, [
			"-e",
			"console.log('ok')",
		]);
		expect(result.exitCode).toBe(0);
		expect(result.stdout).toContain("ok");
	});

	it("captures a non-zero exit code", async () => {
		const result = await runBinaryCommand(process.execPath, [
			"-e",
			"console.error('nope'); process.exit(2)",
		]);
		expect(result.exitCode).toBe(2);
		expect(result.stderr).toContain("nope");
	});

	it("rejects when the process cannot be spawned", async () => {
		await expect(
			runBinaryCommand(path.join(makeTempDir("missing"), "no-such-binary"), [
				"version",
			]),
		).rejects.toThrow();
	});

	it("rejects when the command times out", async () => {
		await expect(
			runBinaryCommand(
				process.execPath,
				["-e", "setTimeout(() => {}, 10_000)"],
				{ timeoutMs: 50 },
			),
		).rejects.toThrow(/Timed out/);
	});
});

describe("runBinaryHarness", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("fails when the binary is missing", async () => {
		const errors: string[] = [];
		const result = await runBinaryHarness({
			binaryPath: path.join(makeTempDir("missing"), "docula"),
			logger: {
				log: () => undefined,
				error: (message) => {
					errors.push(message);
				},
			},
		});

		expect(result.passed).toBe(false);
		expect(result.results[0]?.name).toBe("binary exists");
		expect(errors.some((message) => message.includes("Binary not found"))).toBe(
			true,
		);
	});

	it("makes a non-executable unix binary executable", async () => {
		const binaryPath = createFakeBinary();
		fs.chmodSync(binaryPath, 0o644);

		const result = await runBinaryHarness({
			binaryPath,
			expectedVersion: "9.9.9",
			platform: "linux",
			runCommand: runnerFor({
				version: () => success("9.9.9\n"),
				help: () => success("Usage:\n  build\n"),
				build: (args) => {
					const outputDir = args[args.indexOf("-o") + 1];
					writeBuildOutput(outputDir);
					return success();
				},
				download: (args) => {
					const siteDir = args[args.indexOf("-s") + 1];
					fs.writeFileSync(path.join(siteDir, "variables.css"), ":root {}\n");
					return success();
				},
				init: (args) => {
					const siteDir = args[args.indexOf("-s") + 1];
					fs.mkdirSync(siteDir, { recursive: true });
					fs.writeFileSync(
						path.join(siteDir, "docula.config.mjs"),
						"export {}\n",
					);
					fs.writeFileSync(path.join(siteDir, "logo.png"), "logo");
					fs.writeFileSync(path.join(siteDir, "favicon.ico"), "ico");
					return success();
				},
			}),
			logger: { log: () => undefined, error: () => undefined },
		});

		expect(result.passed).toBe(true);
		expect((fs.statSync(binaryPath).mode & 0o111) !== 0).toBe(true);
	});

	it("skips chmod on Windows", async () => {
		const binaryPath = createFakeBinary();
		const chmod = vi.spyOn(fs, "chmodSync");

		await runBinaryHarness({
			binaryPath,
			expectedVersion: "1.0.0",
			platform: "win32",
			runCommand: async () => failure("nope"),
			logger: { log: () => undefined, error: () => undefined },
		});

		expect(chmod).not.toHaveBeenCalled();
	});

	it("fails version when the process exits non-zero", async () => {
		const result = await runBinaryHarness({
			binaryPath: createFakeBinary(),
			runCommand: runnerFor({
				version: () => failure("", "bad version"),
			}),
			logger: { log: () => undefined, error: () => undefined },
		});

		expect(result.results.find((item) => item.name === "version")?.passed).toBe(
			false,
		);
	});

	it("fails version when the printed version does not match", async () => {
		const result = await runBinaryHarness({
			binaryPath: createFakeBinary(),
			expectedVersion: "2.2.0",
			runCommand: runnerFor({
				version: () => success("0.0.1\n"),
			}),
			logger: { log: () => undefined, error: () => undefined },
		});

		expect(
			result.results.find((item) => item.name === "version")?.detail,
		).toContain('expected "2.2.0"');
	});

	it("fails help when the process exits non-zero", async () => {
		const result = await runBinaryHarness({
			binaryPath: createFakeBinary(),
			expectedVersion: "1.0.0",
			runCommand: runnerFor({
				version: () => success("1.0.0\n"),
				help: () => failure("", "no help"),
			}),
			logger: { log: () => undefined, error: () => undefined },
		});

		expect(result.results.find((item) => item.name === "help")?.passed).toBe(
			false,
		);
	});

	it("fails help when usage text is missing", async () => {
		const result = await runBinaryHarness({
			binaryPath: createFakeBinary(),
			expectedVersion: "1.0.0",
			runCommand: runnerFor({
				version: () => success("1.0.0\n"),
				help: () => success("nothing useful"),
			}),
			logger: { log: () => undefined, error: () => undefined },
		});

		expect(
			result.results.find((item) => item.name === "help")?.detail,
		).toContain("Usage");
	});

	it("fails build when the process exits non-zero", async () => {
		const result = await runBinaryHarness({
			binaryPath: createFakeBinary(),
			expectedVersion: "1.0.0",
			runCommand: runnerFor({
				version: () => success("1.0.0\n"),
				help: () => success("Usage:\n  build\n"),
				build: () => failure("", "build exploded"),
			}),
			logger: { log: () => undefined, error: () => undefined },
		});

		expect(result.results.find((item) => item.name === "build")?.passed).toBe(
			false,
		);
	});

	it("fails build when index.html is missing", async () => {
		const result = await runBinaryHarness({
			binaryPath: createFakeBinary(),
			expectedVersion: "1.0.0",
			runCommand: runnerFor({
				version: () => success("1.0.0\n"),
				help: () => success("Usage:\n  build\n"),
				build: () => success(),
			}),
			logger: { log: () => undefined, error: () => undefined },
		});

		expect(
			result.results.find((item) => item.name === "build")?.detail,
		).toContain("missing");
	});

	it("fails build when the site title is missing from index.html", async () => {
		const result = await runBinaryHarness({
			binaryPath: createFakeBinary(),
			expectedVersion: "1.0.0",
			runCommand: runnerFor({
				version: () => success("1.0.0\n"),
				help: () => success("Usage:\n  build\n"),
				build: (args) => {
					const outputDir = args[args.indexOf("-o") + 1];
					writeBuildOutput(outputDir, "Wrong Title");
					return success();
				},
			}),
			logger: { log: () => undefined, error: () => undefined },
		});

		expect(
			result.results.find((item) => item.name === "build")?.detail,
		).toContain(SMOKE_SITE_TITLE);
	});

	it("fails build when generated SEO files are missing", async () => {
		const result = await runBinaryHarness({
			binaryPath: createFakeBinary(),
			expectedVersion: "1.0.0",
			runCommand: runnerFor({
				version: () => success("1.0.0\n"),
				help: () => success("Usage:\n  build\n"),
				build: (args) => {
					const outputDir = args[args.indexOf("-o") + 1];
					fs.mkdirSync(outputDir, { recursive: true });
					fs.writeFileSync(
						path.join(outputDir, "index.html"),
						`<html><title>${SMOKE_SITE_TITLE}</title></html>`,
					);
					return success();
				},
			}),
			logger: { log: () => undefined, error: () => undefined },
		});

		expect(
			result.results.find((item) => item.name === "build")?.detail,
		).toContain("robots.txt");
	});

	it("fails when a TypeScript-only config is accepted", async () => {
		const result = await runBinaryHarness({
			binaryPath: createFakeBinary(),
			expectedVersion: "1.0.0",
			runCommand: runnerFor({
				version: () => success("1.0.0\n"),
				help: () => success("Usage:\n  build\n"),
				build: (args) => {
					if (args.includes("ts-only-site")) {
						return success();
					}
					const outputDir = args[args.indexOf("-o") + 1];
					writeBuildOutput(outputDir);
					return success();
				},
			}),
			logger: { log: () => undefined, error: () => undefined },
		});

		expect(
			result.results.find((item) => item.name === "json-only config")?.passed,
		).toBe(false);
	});

	it("fails when the TypeScript-config error does not mention JSON", async () => {
		const result = await runBinaryHarness({
			binaryPath: createFakeBinary(),
			expectedVersion: "1.0.0",
			runCommand: runnerFor({
				version: () => success("1.0.0\n"),
				help: () => success("Usage:\n  build\n"),
				build: (args) => {
					if (args.includes("ts-only-site")) {
						return failure("", "something else went wrong");
					}
					const outputDir = args[args.indexOf("-o") + 1];
					writeBuildOutput(outputDir);
					return success();
				},
			}),
			logger: { log: () => undefined, error: () => undefined },
		});

		expect(
			result.results.find((item) => item.name === "json-only config")?.detail,
		).toContain("docula.config.json");
	});

	it("fails download variables when the process exits non-zero", async () => {
		const result = await runBinaryHarness({
			binaryPath: createFakeBinary(),
			expectedVersion: "1.0.0",
			runCommand: runnerFor({
				version: () => success("1.0.0\n"),
				help: () => success("Usage:\n  build\n"),
				build: (args) => {
					if (args.includes("ts-only-site")) {
						return failure("", "Only docula.config.json is supported");
					}
					const outputDir = args[args.indexOf("-o") + 1];
					writeBuildOutput(outputDir);
					return success();
				},
				download: () => failure("", "download failed"),
			}),
			logger: { log: () => undefined, error: () => undefined },
		});

		expect(
			result.results.find((item) => item.name === "download variables")?.passed,
		).toBe(false);
	});

	it("fails download variables when variables.css is missing", async () => {
		const result = await runBinaryHarness({
			binaryPath: createFakeBinary(),
			expectedVersion: "1.0.0",
			runCommand: runnerFor({
				version: () => success("1.0.0\n"),
				help: () => success("Usage:\n  build\n"),
				build: (args) => {
					if (args.includes("ts-only-site")) {
						return failure("", "Only docula.config.json is supported");
					}
					const outputDir = args[args.indexOf("-o") + 1];
					writeBuildOutput(outputDir);
					return success();
				},
				download: () => success(),
			}),
			logger: { log: () => undefined, error: () => undefined },
		});

		expect(
			result.results.find((item) => item.name === "download variables")?.detail,
		).toContain("variables.css");
	});

	it("fails init when the process exits non-zero", async () => {
		const result = await runBinaryHarness({
			binaryPath: createFakeBinary(),
			expectedVersion: "1.0.0",
			runCommand: runnerFor({
				version: () => success("1.0.0\n"),
				help: () => success("Usage:\n  build\n"),
				build: (args) => {
					if (args.includes("ts-only-site")) {
						return failure("", "Only docula.config.json is supported");
					}
					const outputDir = args[args.indexOf("-o") + 1];
					writeBuildOutput(outputDir);
					return success();
				},
				download: (args) => {
					const siteDir = args[args.indexOf("-s") + 1];
					fs.writeFileSync(path.join(siteDir, "variables.css"), ":root {}\n");
					return success();
				},
				init: () => failure("", "init failed"),
			}),
			logger: { log: () => undefined, error: () => undefined },
		});

		expect(result.results.find((item) => item.name === "init")?.passed).toBe(
			false,
		);
	});

	it("fails init when scaffold files are missing", async () => {
		const result = await runBinaryHarness({
			binaryPath: createFakeBinary(),
			expectedVersion: "1.0.0",
			runCommand: runnerFor({
				version: () => success("1.0.0\n"),
				help: () => success("Usage:\n  build\n"),
				build: (args) => {
					if (args.includes("ts-only-site")) {
						return failure("", "Only docula.config.json is supported");
					}
					const outputDir = args[args.indexOf("-o") + 1];
					writeBuildOutput(outputDir);
					return success();
				},
				download: (args) => {
					const siteDir = args[args.indexOf("-s") + 1];
					fs.writeFileSync(path.join(siteDir, "variables.css"), ":root {}\n");
					return success();
				},
				init: () => success(),
			}),
			logger: { log: () => undefined, error: () => undefined },
		});

		expect(
			result.results.find((item) => item.name === "init")?.detail,
		).toContain("docula.config.mjs");
	});

	it("passes every check when the binary behaves", async () => {
		const logs: string[] = [];
		const result = await runBinaryHarness({
			binaryPath: createFakeBinary(),
			expectedVersion: "2.2.0",
			runCommand: runnerFor({
				version: () => success("\u001B[32m2.2.0\u001B[0m\n"),
				help: () => success("Usage:\n    docula [command]\n    build\n"),
				build: (args) => {
					if (args.includes("ts-only-site")) {
						return failure(
							"",
							"Only docula.config.json is supported when running the standalone binary",
						);
					}
					const outputDir = args[args.indexOf("-o") + 1];
					writeBuildOutput(outputDir);
					return success();
				},
				download: (args) => {
					const siteDir = args[args.indexOf("-s") + 1];
					fs.writeFileSync(path.join(siteDir, "variables.css"), ":root {}\n");
					return success();
				},
				init: (args) => {
					const siteDir = args[args.indexOf("-s") + 1];
					fs.mkdirSync(siteDir, { recursive: true });
					fs.writeFileSync(
						path.join(siteDir, "docula.config.mjs"),
						"export {}\n",
					);
					fs.writeFileSync(path.join(siteDir, "logo.png"), "logo");
					fs.writeFileSync(path.join(siteDir, "favicon.ico"), "ico");
					return success();
				},
			}),
			logger: {
				log: (message) => {
					logs.push(message);
				},
				error: () => undefined,
			},
		});

		expect(result.passed).toBe(true);
		expect(result.results).toHaveLength(6);
		expect(logs.some((message) => message.includes("6 passed"))).toBe(true);
	});

	it("cleans up the work directory even when a check throws", async () => {
		const workDir = makeTempDir("harness-work");
		const rm = vi.fn();

		await expect(
			runBinaryHarness({
				binaryPath: createFakeBinary(),
				mkdtemp: () => workDir,
				rm,
				runCommand: async () => {
					throw new Error("runner exploded");
				},
				logger: { log: () => undefined, error: () => undefined },
			}),
		).rejects.toThrow("runner exploded");

		expect(rm).toHaveBeenCalledWith(workDir);
	});
});

describe("main", () => {
	it("prints harness usage and exits 0", async () => {
		const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
		await expect(main(["--help"])).resolves.toBe(0);
		await expect(main(["-h"])).resolves.toBe(0);
		expect(log).toHaveBeenCalled();
		log.mockRestore();
	});

	it("returns 0 when the harness passes", async () => {
		const harness = vi.fn(async () => ({
			passed: true,
			results: [{ name: "version", passed: true }],
		}));
		await expect(main(["./dist/docula"], {}, harness)).resolves.toBe(0);
		expect(harness).toHaveBeenCalledWith({
			binaryPath: path.resolve(process.cwd(), "./dist/docula"),
		});
	});

	it("returns 1 when the harness fails", async () => {
		const harness = vi.fn(async () => ({
			passed: false,
			results: [{ name: "version", passed: false }],
		}));
		await expect(
			main([], { DOCULA_BINARY: "/tmp/docula" }, harness),
		).resolves.toBe(1);
	});
});
