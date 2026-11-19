import { expect, test } from "@playwright/test";

test.describe("variables.css", () => {
	test("variables.css is served and accessible", async ({ request }) => {
		const response = await request.get("/css/variables.css");
		expect(response.status()).toBe(200);
		const text = await response.text();
		expect(text).toContain("--bg");
	});

	test("user variables.css overrides are applied", async ({ page }) => {
		await page.goto("/docs/", { waitUntil: "networkidle" });

		const bgValue = await page.evaluate(() =>
			getComputedStyle(document.documentElement)
				.getPropertyValue("--bg")
				.trim(),
		);

		expect(bgValue).toBe("#0a0a0a");
	});
});
