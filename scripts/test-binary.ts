import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import doculaPkg from "../package.json" with { type: "json" };

export const SMOKE_SITE_TITLE = "Binary Smoke";
export const DEFAULT_COMMAND_TIMEOUT_MS = 60_000;

export type CommandResult = {
	exitCode: number;
	stdout: string;
	stderr: string;
};

export type RunCommand = (
	binaryPath: string,
	args: string[],
	options?: { timeoutMs?: number },
) => Promise<CommandResult>;

export type HarnessLogger = {
	log: (message: string) => void;
	error: (message: string) => void;
};

export type HarnessOptions = {
	binaryPath: string;
	expectedVersion?: string;
	runCommand?: RunCommand;
	logger?: HarnessLogger;
	platform?: string;
	mkdtemp?: (prefix: string) => string;
	rm?: (dir: string) => void;
};

export type CheckResult = {
	name: string;
	passed: boolean;
	detail?: string;
};

// biome-ignore lint/suspicious/noControlCharactersInRegex: needed to strip ANSI escape codes
const ansiRegex = /\u001B\[[0-9;]*m/g;

export function stripAnsi(value: string): string {
	return value.replace(ansiRegex, "");
}

export function defaultBinaryName(platform = process.platform): string {
	return platform === "win32" ? "docula.exe" : "docula";
}

export function resolveBinaryPath(
	argv: string[] = [],
	env: NodeJS.ProcessEnv = process.env,
	platform = process.platform,
	cwd = process.cwd(),
): string {
	const fromArgv = argv.find(
		(argument) => argument !== "--" && argument !== "",
	);
	const candidate =
		fromArgv ??
		env.DOCULA_BINARY ??
		path.join("dist", defaultBinaryName(platform));
	return path.isAbsolute(candidate) ? candidate : path.resolve(cwd, candidate);
}

export function combinedOutput(result: CommandResult): string {
	return `${result.stdout}\n${result.stderr}`;
}

export async function runBinaryCommand(
	binaryPath: string,
	args: string[],
	options: { timeoutMs?: number } = {},
): Promise<CommandResult> {
	const timeoutMs = options.timeoutMs ?? DEFAULT_COMMAND_TIMEOUT_MS;

	return new Promise((resolve, reject) => {
		const child = spawn(binaryPath, args, {
			stdio: ["ignore", "pipe", "pipe"],
		});

		let stdout = "";
		let stderr = "";
		let settled = false;

		const timer = setTimeout(() => {
			child.kill("SIGTERM");
			if (!settled) {
				settled = true;
				reject(
					new Error(
						`Timed out after ${timeoutMs}ms: ${binaryPath} ${args.join(" ")}`,
					),
				);
			}
		}, timeoutMs);

		child.stdout.on("data", (chunk: Buffer | string) => {
			stdout += chunk.toString();
		});
		child.stderr.on("data", (chunk: Buffer | string) => {
			stderr += chunk.toString();
		});
		child.on("error", (error) => {
			clearTimeout(timer);
			if (!settled) {
				settled = true;
				reject(error);
			}
		});
		child.on("close", (code) => {
			clearTimeout(timer);
			if (!settled) {
				settled = true;
				resolve({
					exitCode: code ?? 1,
					stdout,
					stderr,
				});
			}
		});
	});
}

export function writeSmokeSite(dir: string): void {
	fs.mkdirSync(dir, { recursive: true });
	fs.writeFileSync(
		path.join(dir, "docula.config.json"),
		`${JSON.stringify(
			{
				siteTitle: SMOKE_SITE_TITLE,
				siteDescription: "Standalone binary smoke test",
				siteUrl: "https://example.com",
			},
			null,
			"\t",
		)}\n`,
	);
	fs.writeFileSync(
		path.join(dir, "README.md"),
		"# Binary Smoke\n\nHello from the binary harness.\n",
	);
}

export function writeTypescriptOnlySite(dir: string): void {
	fs.mkdirSync(dir, { recursive: true });
	fs.writeFileSync(
		path.join(dir, "docula.config.ts"),
		'export const options = { siteTitle: "TypeScript Only" };\n',
	);
	fs.writeFileSync(path.join(dir, "README.md"), "# TypeScript Only\n");
}

function ensureExecutable(binaryPath: string, platform: string): void {
	if (platform === "win32") {
		return;
	}

	const stats = fs.statSync(binaryPath);
	const executable = (stats.mode & 0o111) !== 0;
	if (!executable) {
		fs.chmodSync(binaryPath, stats.mode | 0o111);
	}
}

async function checkVersion(
	binaryPath: string,
	expectedVersion: string,
	runCommand: RunCommand,
): Promise<CheckResult> {
	const result = await runCommand(binaryPath, ["version"]);
	const version = stripAnsi(result.stdout).trim();
	if (result.exitCode !== 0) {
		return {
			name: "version",
			passed: false,
			detail: `exited ${result.exitCode}: ${combinedOutput(result).trim()}`,
		};
	}

	if (version !== expectedVersion) {
		return {
			name: "version",
			passed: false,
			detail: `expected "${expectedVersion}", got "${version}"`,
		};
	}

	return { name: "version", passed: true, detail: version };
}

async function checkHelp(
	binaryPath: string,
	runCommand: RunCommand,
): Promise<CheckResult> {
	const result = await runCommand(binaryPath, ["help"]);
	const output = stripAnsi(combinedOutput(result));
	if (result.exitCode !== 0) {
		return {
			name: "help",
			passed: false,
			detail: `exited ${result.exitCode}: ${output.trim()}`,
		};
	}

	if (!output.includes("Usage:") || !output.includes("build")) {
		return {
			name: "help",
			passed: false,
			detail: "help output did not include Usage or build",
		};
	}

	return { name: "help", passed: true };
}

async function checkBuild(
	binaryPath: string,
	workDir: string,
	runCommand: RunCommand,
): Promise<CheckResult> {
	const siteDir = path.join(workDir, "smoke-site");
	const outputDir = path.join(workDir, "smoke-dist");
	writeSmokeSite(siteDir);

	const result = await runCommand(binaryPath, [
		"build",
		"-s",
		siteDir,
		"-o",
		outputDir,
	]);
	if (result.exitCode !== 0) {
		return {
			name: "build",
			passed: false,
			detail: `exited ${result.exitCode}: ${combinedOutput(result).trim()}`,
		};
	}

	const indexPath = path.join(outputDir, "index.html");
	if (!fs.existsSync(indexPath)) {
		return {
			name: "build",
			passed: false,
			detail: `missing ${indexPath}`,
		};
	}

	const html = fs.readFileSync(indexPath, "utf8");
	if (!html.includes(SMOKE_SITE_TITLE)) {
		return {
			name: "build",
			passed: false,
			detail: `index.html did not contain "${SMOKE_SITE_TITLE}"`,
		};
	}

	const requiredFiles = ["robots.txt", "sitemap.xml"];
	const missing = requiredFiles.filter(
		(fileName) => !fs.existsSync(path.join(outputDir, fileName)),
	);
	if (missing.length > 0) {
		return {
			name: "build",
			passed: false,
			detail: `missing generated files: ${missing.join(", ")}`,
		};
	}

	return { name: "build", passed: true, detail: outputDir };
}

async function checkTypescriptConfigRejected(
	binaryPath: string,
	workDir: string,
	runCommand: RunCommand,
): Promise<CheckResult> {
	const siteDir = path.join(workDir, "ts-only-site");
	const outputDir = path.join(workDir, "ts-only-dist");
	writeTypescriptOnlySite(siteDir);

	const result = await runCommand(binaryPath, [
		"build",
		"-s",
		siteDir,
		"-o",
		outputDir,
	]);
	const output = stripAnsi(combinedOutput(result));
	if (result.exitCode === 0) {
		return {
			name: "json-only config",
			passed: false,
			detail:
				"TypeScript config was accepted; standalone binaries must reject it",
		};
	}

	if (!output.includes("docula.config.json")) {
		return {
			name: "json-only config",
			passed: false,
			detail: `expected a docula.config.json error, got: ${output.trim()}`,
		};
	}

	return { name: "json-only config", passed: true };
}

async function checkDownloadVariables(
	binaryPath: string,
	workDir: string,
	runCommand: RunCommand,
): Promise<CheckResult> {
	const siteDir = path.join(workDir, "download-site");
	fs.mkdirSync(siteDir, { recursive: true });

	const result = await runCommand(binaryPath, [
		"download",
		"variables",
		"-s",
		siteDir,
	]);
	if (result.exitCode !== 0) {
		return {
			name: "download variables",
			passed: false,
			detail: `exited ${result.exitCode}: ${combinedOutput(result).trim()}`,
		};
	}

	const variablesPath = path.join(siteDir, "variables.css");
	if (!fs.existsSync(variablesPath)) {
		return {
			name: "download variables",
			passed: false,
			detail: `missing ${variablesPath}`,
		};
	}

	return { name: "download variables", passed: true };
}

async function checkInit(
	binaryPath: string,
	workDir: string,
	runCommand: RunCommand,
): Promise<CheckResult> {
	const siteDir = path.join(workDir, "init-site");

	const result = await runCommand(binaryPath, [
		"init",
		"--javascript",
		"-s",
		siteDir,
	]);
	if (result.exitCode !== 0) {
		return {
			name: "init",
			passed: false,
			detail: `exited ${result.exitCode}: ${combinedOutput(result).trim()}`,
		};
	}

	const requiredFiles = ["docula.config.mjs", "logo.png", "favicon.ico"];
	const missing = requiredFiles.filter(
		(fileName) => !fs.existsSync(path.join(siteDir, fileName)),
	);
	if (missing.length > 0) {
		return {
			name: "init",
			passed: false,
			detail: `missing init files: ${missing.join(", ")}`,
		};
	}

	return { name: "init", passed: true };
}

export async function runBinaryHarness(
	options: HarnessOptions,
): Promise<{ passed: boolean; results: CheckResult[] }> {
	const logger = options.logger ?? {
		log: (message) => {
			console.log(message);
		},
		error: (message) => {
			console.error(message);
		},
	};
	const runCommand = options.runCommand ?? runBinaryCommand;
	const expectedVersion = options.expectedVersion ?? doculaPkg.version;
	const platform = options.platform ?? process.platform;
	const mkdtemp =
		options.mkdtemp ??
		((prefix) => fs.mkdtempSync(path.join(os.tmpdir(), prefix)));
	const rm =
		options.rm ??
		((dir) => {
			fs.rmSync(dir, { recursive: true, force: true });
		});

	if (!fs.existsSync(options.binaryPath)) {
		logger.error(`Binary not found: ${options.binaryPath}`);
		logger.error("Build it first with: pnpm build:binary");
		return {
			passed: false,
			results: [
				{
					name: "binary exists",
					passed: false,
					detail: options.binaryPath,
				},
			],
		};
	}

	ensureExecutable(options.binaryPath, platform);

	logger.log(`Docula binary harness`);
	logger.log(`  binary: ${options.binaryPath}`);
	logger.log("");

	const workDir = mkdtemp("docula-binary-harness-");
	const results: CheckResult[] = [];

	try {
		const checks = [
			() => checkVersion(options.binaryPath, expectedVersion, runCommand),
			() => checkHelp(options.binaryPath, runCommand),
			() => checkBuild(options.binaryPath, workDir, runCommand),
			() =>
				checkTypescriptConfigRejected(options.binaryPath, workDir, runCommand),
			() => checkDownloadVariables(options.binaryPath, workDir, runCommand),
			() => checkInit(options.binaryPath, workDir, runCommand),
		];

		for (const check of checks) {
			const result = await check();
			results.push(result);
			if (result.passed) {
				logger.log(
					`  \u2713 ${result.name}${result.detail ? ` (${result.detail})` : ""}`,
				);
			} else {
				logger.error(`  \u2717 ${result.name}`);
				if (result.detail) {
					logger.error(`    ${result.detail}`);
				}
			}
		}
	} finally {
		rm(workDir);
	}

	const failed = results.filter((result) => !result.passed).length;
	const passed = results.length - failed;
	logger.log("");
	if (failed === 0) {
		logger.log(`${passed} passed`);
	} else {
		logger.error(`${passed} passed, ${failed} failed`);
	}

	return { passed: failed === 0, results };
}

export async function main(
	argv: string[] = process.argv.slice(2),
	env: NodeJS.ProcessEnv = process.env,
	harness = runBinaryHarness,
): Promise<number> {
	if (argv.includes("--help") || argv.includes("-h")) {
		console.log("Usage: pnpm test:binary [-- /path/to/docula]");
		console.log("   or: DOCULA_BINARY=/path/to/docula pnpm test:binary");
		return 0;
	}

	const binaryPath = resolveBinaryPath(argv, env);
	const { passed } = await harness({ binaryPath });
	return passed ? 0 : 1;
}

const isDirectRun =
	process.argv[1] !== undefined &&
	import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

/* v8 ignore next 5 -- @preserve */
if (isDirectRun) {
	main()
		.then((code) => {
			process.exit(code);
		})
		.catch((error: unknown) => {
			console.error(error);
			process.exit(1);
		});
}
