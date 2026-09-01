import { expect, test } from "@playwright/test";

test.describe("live StockCal baseline", () => {
  test("renders the live-data shell without demo modules", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("h1").first()).toBeVisible();
    await expect(page.getByTestId("desktop-primary-nav")).toBeAttached();
    await expect(page.getByTestId("mobile-primary-nav")).toBeAttached();
    await expect(page.getByText("公司行为调整")).toHaveCount(0);
    await expect(page.getByText("演示数据")).toHaveCount(0);
  });

  test("does not create horizontal page overflow", async ({ page }) => {
    await page.goto("/");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    expect(overflow).toBe(false);
  });
});
