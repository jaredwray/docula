import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const tempDir = path.join(process.cwd(), "test", "temp");

export function setup(): void {
	fs.rmSync(tempDir, { recursive: true, force: true });
	fs.mkdirSync(tempDir, { recursive: true });
}

export function teardown(): void {
	fs.rmSync(tempDir, { recursive: true, force: true });
}
