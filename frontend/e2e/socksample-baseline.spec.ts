import { expect, test } from "@playwright/test";

test.describe("socksample Sites baseline", () => {
  test("renders the dashboard landmarks", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "组合总览" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "AI策略分析中心" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "主导航" })).toBeAttached();
    await expect(page.getByRole("navigation", { name: "移动端导航" })).toBeAttached();
  });

  test("keeps the earning mode interaction stateful", async ({ page }) => {
    await page.goto("/");
    const swingMode = page.getByRole("tab", { name: "攀升" });
    await swingMode.click();
    await expect(swingMode).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("heading", { name: "攀升" })).toBeVisible();
  });

  test("does not create horizontal page overflow", async ({ page }) => {
    await page.goto("/");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    expect(overflow).toBe(false);
  });
});
