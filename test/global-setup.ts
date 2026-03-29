import fs from "node:fs";

const TEMP_DIR = "test/temp";

/**
 * Vitest global setup: ensure test/temp/ is clean before the suite starts
 * and removed after all tests complete.
 */
export function setup(): void {
	if (fs.existsSync(TEMP_DIR)) {
		fs.rmSync(TEMP_DIR, { recursive: true, force: true });
	}

	fs.mkdirSync(TEMP_DIR, { recursive: true });
}

export function teardown(): void {
	if (fs.existsSync(TEMP_DIR)) {
		fs.rmSync(TEMP_DIR, { recursive: true, force: true });
	}
}
