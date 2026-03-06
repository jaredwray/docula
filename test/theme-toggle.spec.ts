import { expect, test } from "@playwright/test";

test.describe("Theme Toggle - Default State", () => {
	test("defaults to auto mode when localStorage is empty", async ({ page }) => {
		await page.emulateMedia({ colorScheme: "dark" });
		await page.goto("/docs/");

		const toggle = page.locator("#theme-toggle");
		await expect(toggle).toHaveAttribute(
			"aria-label",
			"Theme: auto (following system)",
		);
		await expect(page.locator(".theme-button__icon--auto")).not.toHaveClass(
			/theme-button__icon--hidden/,
		);
		await expect(page.locator(".theme-button__icon--sun")).toHaveClass(
			/theme-button__icon--hidden/,
		);
		await expect(page.locator(".theme-button__icon--moon")).toHaveClass(
			/theme-button__icon--hidden/,
		);

		const stored = await page.evaluate(() => localStorage.getItem("theme"));
		expect(stored).toBeNull();
	});

	test("auto mode follows system dark preference", async ({ page }) => {
		await page.emulateMedia({ colorScheme: "dark" });
		await page.goto("/docs/");

		const dataTheme = await page.evaluate(() =>
			document.documentElement.getAttribute("data-theme"),
		);
		expect(dataTheme).toBeNull();
	});

	test("auto mode follows system light preference", async ({ page }) => {
		await page.emulateMedia({ colorScheme: "light" });
		await page.goto("/docs/");

		const dataTheme = await page.evaluate(() =>
			document.documentElement.getAttribute("data-theme"),
		);
		expect(dataTheme).toBe("light");
	});
});

test.describe("Theme Toggle - Click Cycle", () => {
	test("cycles auto -> light -> dark -> auto", async ({ page }) => {
		await page.emulateMedia({ colorScheme: "dark" });
		await page.goto("/docs/");

		const toggle = page.locator("#theme-toggle");

		// Click 1: auto -> light
		await toggle.click();
		await expect(toggle).toHaveAttribute("aria-label", "Theme: light");
		await expect(page.locator(".theme-button__icon--sun")).not.toHaveClass(
			/theme-button__icon--hidden/,
		);
		await expect(page.locator(".theme-button__icon--auto")).toHaveClass(
			/theme-button__icon--hidden/,
		);
		await expect(page.locator(".theme-button__icon--moon")).toHaveClass(
			/theme-button__icon--hidden/,
		);
		expect(
			await page.evaluate(() =>
				document.documentElement.getAttribute("data-theme"),
			),
		).toBe("light");
		expect(await page.evaluate(() => localStorage.getItem("theme"))).toBe(
			"light",
		);

		// Click 2: light -> dark
		await toggle.click();
		await expect(toggle).toHaveAttribute("aria-label", "Theme: dark");
		await expect(page.locator(".theme-button__icon--moon")).not.toHaveClass(
			/theme-button__icon--hidden/,
		);
		await expect(page.locator(".theme-button__icon--auto")).toHaveClass(
			/theme-button__icon--hidden/,
		);
		await expect(page.locator(".theme-button__icon--sun")).toHaveClass(
			/theme-button__icon--hidden/,
		);
		expect(
			await page.evaluate(() =>
				document.documentElement.getAttribute("data-theme"),
			),
		).toBeNull();
		expect(await page.evaluate(() => localStorage.getItem("theme"))).toBe(
			"dark",
		);

		// Click 3: dark -> auto
		await toggle.click();
		await expect(toggle).toHaveAttribute(
			"aria-label",
			"Theme: auto (following system)",
		);
		await expect(page.locator(".theme-button__icon--auto")).not.toHaveClass(
			/theme-button__icon--hidden/,
		);
		await expect(page.locator(".theme-button__icon--sun")).toHaveClass(
			/theme-button__icon--hidden/,
		);
		await expect(page.locator(".theme-button__icon--moon")).toHaveClass(
			/theme-button__icon--hidden/,
		);
		expect(await page.evaluate(() => localStorage.getItem("theme"))).toBeNull();
	});
});

test.describe("Theme Toggle - Persistence", () => {
	test("persists light mode across reload", async ({ page }) => {
		await page.emulateMedia({ colorScheme: "dark" });
		await page.goto("/docs/");
		await page.locator("#theme-toggle").click(); // auto -> light

		await page.reload();

		const toggle = page.locator("#theme-toggle");
		await expect(toggle).toHaveAttribute("aria-label", "Theme: light");
		await expect(page.locator(".theme-button__icon--sun")).not.toHaveClass(
			/theme-button__icon--hidden/,
		);
		expect(
			await page.evaluate(() =>
				document.documentElement.getAttribute("data-theme"),
			),
		).toBe("light");
	});

	test("persists dark mode across reload", async ({ page }) => {
		await page.emulateMedia({ colorScheme: "light" });
		await page.goto("/docs/");
		const toggle = page.locator("#theme-toggle");
		await toggle.click(); // auto -> light
		await toggle.click(); // light -> dark

		await page.reload();

		await expect(toggle).toHaveAttribute("aria-label", "Theme: dark");
		await expect(page.locator(".theme-button__icon--moon")).not.toHaveClass(
			/theme-button__icon--hidden/,
		);
		expect(
			await page.evaluate(() =>
				document.documentElement.getAttribute("data-theme"),
			),
		).toBeNull();
	});

	test("auto mode clears localStorage and follows system after reload", async ({
		page,
	}) => {
		await page.emulateMedia({ colorScheme: "light" });
		await page.goto("/docs/");
		const toggle = page.locator("#theme-toggle");
		await toggle.click(); // auto -> light
		await toggle.click(); // light -> dark
		await toggle.click(); // dark -> auto

		await page.reload();

		expect(await page.evaluate(() => localStorage.getItem("theme"))).toBeNull();
		await expect(toggle).toHaveAttribute(
			"aria-label",
			"Theme: auto (following system)",
		);
		expect(
			await page.evaluate(() =>
				document.documentElement.getAttribute("data-theme"),
			),
		).toBe("light");
	});
});

test.describe("Theme Toggle - System Preference Reactivity", () => {
	test("responds to system color scheme change in auto mode", async ({
		page,
	}) => {
		await page.emulateMedia({ colorScheme: "dark" });
		await page.goto("/docs/");

		expect(
			await page.evaluate(() =>
				document.documentElement.getAttribute("data-theme"),
			),
		).toBeNull();

		await page.emulateMedia({ colorScheme: "light" });
		await page.waitForFunction(
			() => document.documentElement.getAttribute("data-theme") === "light",
			null,
			{ timeout: 3000 },
		);
		expect(
			await page.evaluate(() =>
				document.documentElement.getAttribute("data-theme"),
			),
		).toBe("light");
	});

	test("ignores system color scheme change in explicit mode", async ({
		page,
	}) => {
		await page.emulateMedia({ colorScheme: "dark" });
		await page.goto("/docs/");
		await page.locator("#theme-toggle").click(); // auto -> light

		expect(
			await page.evaluate(() =>
				document.documentElement.getAttribute("data-theme"),
			),
		).toBe("light");

		await page.emulateMedia({ colorScheme: "dark" });
		expect(
			await page.evaluate(() =>
				document.documentElement.getAttribute("data-theme"),
			),
		).toBe("light");
	});
});

test.describe("Theme Toggle - Pre-set localStorage", () => {
	test("loads with light theme from localStorage", async ({ page }) => {
		await page.addInitScript(() => localStorage.setItem("theme", "light"));
		await page.emulateMedia({ colorScheme: "dark" });
		await page.goto("/docs/");

		await expect(page.locator("#theme-toggle")).toHaveAttribute(
			"aria-label",
			"Theme: light",
		);
		await expect(page.locator(".theme-button__icon--sun")).not.toHaveClass(
			/theme-button__icon--hidden/,
		);
		expect(
			await page.evaluate(() =>
				document.documentElement.getAttribute("data-theme"),
			),
		).toBe("light");
	});

	test("loads with dark theme from localStorage", async ({ page }) => {
		await page.addInitScript(() => localStorage.setItem("theme", "dark"));
		await page.emulateMedia({ colorScheme: "light" });
		await page.goto("/docs/");

		await expect(page.locator("#theme-toggle")).toHaveAttribute(
			"aria-label",
			"Theme: dark",
		);
		await expect(page.locator(".theme-button__icon--moon")).not.toHaveClass(
			/theme-button__icon--hidden/,
		);
		expect(
			await page.evaluate(() =>
				document.documentElement.getAttribute("data-theme"),
			),
		).toBeNull();
	});
});
