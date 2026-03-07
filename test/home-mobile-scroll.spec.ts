import { expect, test } from "@playwright/test";

const mobileViewport = { width: 375, height: 667 };

test.describe("Home page mobile scroll", () => {
	test("home page does not scroll vertically on mobile", async ({ page }) => {
		await page.setViewportSize(mobileViewport);
		await page.goto("/");
		await page.waitForLoadState("domcontentloaded");

		const scrollable = await page.evaluate(() => {
			return document.documentElement.scrollHeight > window.innerHeight;
		});

		expect(scrollable).toBe(false);
	});

	test("home page hero and actions are visible without scrolling on mobile", async ({
		page,
	}) => {
		await page.setViewportSize(mobileViewport);
		await page.goto("/");
		await page.waitForLoadState("domcontentloaded");

		const hero = page.locator(".home-hero");
		await expect(hero).toBeVisible();

		const actions = page.locator(".home-actions");
		await expect(actions).toBeVisible();

		// Verify the actions are within the viewport
		const box = await actions.boundingBox();
		expect(box).toBeTruthy();
		if (box) {
			expect(box.y + box.height).toBeLessThanOrEqual(mobileViewport.height);
		}
	});

	test("home page contributors section is hidden on mobile", async ({
		page,
	}) => {
		await page.setViewportSize(mobileViewport);
		await page.goto("/");
		await page.waitForLoadState("domcontentloaded");

		const homeContent = page.locator(".home-content");
		await expect(homeContent).toBeHidden();
	});
});
