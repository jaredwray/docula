import { expect, test } from "@playwright/test";

test.describe("Search Modal - Open / Close", () => {
	test("opens via the search button and focuses the input", async ({
		page,
	}) => {
		await page.goto("/docs/");

		const modal = page.locator("#search-modal");
		await expect(modal).toBeHidden();

		await page.locator("#search-button").click();
		await expect(modal).toBeVisible();
		await expect(page.locator("#search-input")).toBeFocused();
	});

	test("opens with the keyboard shortcut and toggles closed", async ({
		page,
	}) => {
		await page.goto("/docs/");

		await page.keyboard.press("ControlOrMeta+k");
		await expect(page.locator("#search-modal")).toBeVisible();

		await page.keyboard.press("ControlOrMeta+k");
		await expect(page.locator("#search-modal")).toBeHidden();
	});

	test("closes with Escape", async ({ page }) => {
		await page.goto("/docs/");

		await page.locator("#search-button").click();
		await expect(page.locator("#search-modal")).toBeVisible();

		await page.keyboard.press("Escape");
		await expect(page.locator("#search-modal")).toBeHidden();
	});

	test("closes when clicking the backdrop", async ({ page }) => {
		await page.goto("/docs/");

		await page.locator("#search-button").click();
		await expect(page.locator("#search-modal")).toBeVisible();

		await page.locator(".search-modal__backdrop").click();
		await expect(page.locator("#search-modal")).toBeHidden();
	});
});

test.describe("Search Modal - Results", () => {
	test("shows ranked results and navigates with the keyboard", async ({
		page,
	}) => {
		await page.goto("/docs/");
		await page.locator("#search-button").click();

		await page.locator("#search-input").fill("install");

		const results = page.locator("#search-results .search-result");
		await expect(results.first()).toBeVisible();
		await expect(results.first()).toHaveAttribute("aria-selected", "true");

		await page.keyboard.press("ArrowDown");
		await expect(results.nth(1)).toHaveAttribute("aria-selected", "true");

		await page.keyboard.press("Enter");
		await expect(page.locator("#search-modal")).toBeHidden();
	});

	test("shows an empty state when nothing matches", async ({ page }) => {
		await page.goto("/docs/");
		await page.locator("#search-button").click();

		await page.locator("#search-input").fill("zzzzzznotarealterm");
		await expect(page.locator("#search-empty")).toBeVisible();
		await expect(page.locator("#search-results .search-result")).toHaveCount(0);
	});

	test("the clear button resets the query", async ({ page }) => {
		await page.goto("/docs/");
		await page.locator("#search-button").click();

		const input = page.locator("#search-input");
		await input.fill("install");
		await expect(
			page.locator("#search-results .search-result").first(),
		).toBeVisible();

		await page.locator("#search-clear").click();
		await expect(input).toHaveValue("");
		await expect(page.locator("#search-initial")).toBeVisible();
	});
});
