import { expect, test } from "@playwright/test";

test.describe("API Try It Now - Authorization", () => {
	test.beforeEach(async ({ page }) => {
		// Route all requests to the mock API server so tests don't hit the network
		await page.route("https://mockhttp.org/**", (route) =>
			route.fulfill({
				status: 200,
				body: '{"ok":true}',
				contentType: "application/json",
			}),
		);
		await page.goto("/api");
		// The first operation is auto-expanded by api.js on load
	});

	test("auth value input is hidden by default (None selected)", async ({
		page,
	}) => {
		const input = page.locator("#api-auth-value");
		await expect(input).toHaveClass(/api-auth__value--hidden/);
	});

	test("auth value input shown when API Key is selected", async ({ page }) => {
		await page.selectOption("#api-auth-type", "apikey");
		const input = page.locator("#api-auth-value");
		await expect(input).not.toHaveClass(/api-auth__value--hidden/);
		await expect(input).toHaveAttribute("placeholder", "Enter API key...");
	});

	test("auth value input shown when Bearer Token is selected", async ({
		page,
	}) => {
		await page.selectOption("#api-auth-type", "bearer");
		const input = page.locator("#api-auth-value");
		await expect(input).not.toHaveClass(/api-auth__value--hidden/);
		await expect(input).toHaveAttribute("placeholder", "Enter token...");
	});

	test("switching back to None hides and clears the auth input", async ({
		page,
	}) => {
		await page.selectOption("#api-auth-type", "apikey");
		await page.fill("#api-auth-value", "some-key");
		await page.selectOption("#api-auth-type", "none");
		const input = page.locator("#api-auth-value");
		await expect(input).toHaveClass(/api-auth__value--hidden/);
		await expect(input).toHaveValue("");
	});

	test("sends x-api-key header when API Key auth is set", async ({ page }) => {
		const requestPromise = page.waitForRequest("https://mockhttp.org/**");

		await page.selectOption("#api-auth-type", "apikey");
		await page.fill("#api-auth-value", "my-test-api-key");
		await page.click(".api-try-it [data-try-send]");

		const request = await requestPromise;
		expect(request.headers()["x-api-key"]).toBe("my-test-api-key");
	});

	test("sends Authorization Bearer header when Bearer Token is set", async ({
		page,
	}) => {
		const requestPromise = page.waitForRequest("https://mockhttp.org/**");

		await page.selectOption("#api-auth-type", "bearer");
		await page.fill("#api-auth-value", "my-test-token");
		await page.click(".api-try-it [data-try-send]");

		const request = await requestPromise;
		expect(request.headers().authorization).toBe("Bearer my-test-token");
	});

	test("does not send auth headers when None is selected", async ({ page }) => {
		const requestPromise = page.waitForRequest("https://mockhttp.org/**");

		// Leave auth type as None (default)
		await page.click(".api-try-it [data-try-send]");

		const request = await requestPromise;
		expect(request.headers()["x-api-key"]).toBeUndefined();
		expect(request.headers().authorization).toBeUndefined();
	});
});
