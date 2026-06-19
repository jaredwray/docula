import { afterEach } from "vitest";
import { cleanupTempDirs } from "./test-helpers.js";

/**
 * Global per-test cleanup. Registered for every test file via the Vitest
 * `setupFiles` option so that any temp directory created with `makeTempDir` or
 * `cloneFixture` is removed after each test — even if the test threw before its
 * own cleanup ran.
 */
afterEach(() => {
	cleanupTempDirs();
});
