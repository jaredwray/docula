#!/usr/bin/env node

/**
 * Build a standalone docula binary using Node.js Single Executable Application (SEA).
 *
 * Prerequisites: Node.js >= 20
 *
 * Steps:
 * 1. Generate embedded templates
 * 2. Bundle everything into a single CJS file using tsup
 * 3. Generate the SEA blob
 * 4. Copy the node binary and inject the blob
 */

import { execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const platform = os.platform();
const binaryName = platform === "win32" ? "docula.exe" : "docula";
const binaryPath = path.join("dist", binaryName);

function run(cmd, options = {}) {
	console.log(`> ${cmd}`);
	execSync(cmd, { stdio: "inherit", ...options });
}

function main() {
	console.log("=== Building docula standalone binary ===\n");

	// Step 1: Generate embedded templates
	console.log("Step 1: Generating embedded templates...");
	run("npx tsx scripts/generate-embedded-templates.ts");

	// Step 2: Generate init file
	console.log("\nStep 2: Generating init file...");
	run("npx tsx scripts/generate-init-file.ts");

	// Step 3: Bundle into a single CJS file with all dependencies
	console.log("\nStep 3: Bundling into single CJS file...");
	run(
		"npx tsup src/docula.ts src/embedded-templates.ts --format cjs --out-dir dist/sea-build --no-splitting --bundle --target node20",
	);

	// Create the CJS entry point that imports the bundle
	const seaEntry = `
const { default: Docula } = require("./sea-build/docula.cjs");

async function main() {
	const docula = new Docula();
	await docula.execute(process);
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
`;
	fs.writeFileSync("dist/docula-sea.cjs", seaEntry);

	// Step 4: Generate the SEA blob
	console.log("\nStep 4: Generating SEA blob...");
	run("node --experimental-sea-config sea-config.json");

	// Step 5: Copy the node binary
	console.log(`\nStep 5: Creating binary at ${binaryPath}...`);
	const nodePath = process.execPath;
	fs.copyFileSync(nodePath, binaryPath);

	if (platform !== "win32") {
		fs.chmodSync(binaryPath, 0o755);
	}

	// On macOS, remove the code signature before injecting
	if (platform === "darwin") {
		console.log("Removing macOS code signature...");
		try {
			run(`codesign --remove-signature ${binaryPath}`);
		} catch {
			console.log("codesign not available, skipping signature removal");
		}
	}

	// Step 6: Inject the blob using postject
	console.log("\nStep 6: Injecting SEA blob into binary...");
	const sentinelFuse = "NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2";
	const postjectArgs = [
		binaryPath,
		"NODE_SEA_BLOB",
		"dist/sea-prep.blob",
		"--sentinel-fuse",
		sentinelFuse,
	];

	if (platform === "darwin") {
		postjectArgs.push("--macho-segment-name", "NODE_SEA");
	}

	run(`npx postject ${postjectArgs.join(" ")}`);

	// On macOS, re-sign the binary
	if (platform === "darwin") {
		console.log("Re-signing macOS binary...");
		try {
			run(`codesign --sign - ${binaryPath}`);
		} catch {
			console.log("codesign not available, skipping re-signing");
		}
	}

	const stats = fs.statSync(binaryPath);
	const sizeMB = (stats.size / (1024 * 1024)).toFixed(1);
	console.log(`\n=== Binary built successfully! ===`);
	console.log(`  Path: ${binaryPath}`);
	console.log(`  Size: ${sizeMB} MB`);
	console.log(`\nRun it with: ./${binaryPath} help`);
}

main();
