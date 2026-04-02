import {execFileSync} from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const isWindows = process.platform === "win32";
const isMacOS = process.platform === "darwin";

const distDir = path.resolve("dist");
const binaryName = isWindows ? "docula.exe" : "docula";
const binaryPath = path.join(distDir, binaryName);
const seaConfigPath = path.resolve("sea-config.json");
const blobPath = path.join(distDir, "sea-prep.blob");

function run(cmd: string, args: string[]) {
	console.log(`> ${cmd} ${args.join(" ")}`);
	execFileSync(cmd, args, {stdio: "inherit"});
}

// Generate the SEA blob from the bundled JS
run(process.execPath, ["--experimental-sea-config", seaConfigPath]);

// Copy the current Node.js binary
fs.copyFileSync(process.execPath, binaryPath);

// On macOS, remove the existing signature before injection
if (isMacOS) {
	run("codesign", ["--remove-signature", binaryPath]);
}

// Inject the blob using postject
const sentinelFuse = "NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2";
const postjectArgs = [
	binaryPath,
	"NODE_SEA_BLOB",
	blobPath,
	"--sentinel-fuse",
	sentinelFuse,
];

if (isMacOS) {
	postjectArgs.push("--macho-segment-name", "NODE_SEA");
}

run("npx", ["postject", ...postjectArgs]);

// On macOS, re-sign the binary with ad-hoc signature
if (isMacOS) {
	run("codesign", ["--sign", "-", binaryPath]);
}

// Clean up the blob file
fs.unlinkSync(blobPath);

console.log(`\nSEA binary created: ${binaryPath}`);
