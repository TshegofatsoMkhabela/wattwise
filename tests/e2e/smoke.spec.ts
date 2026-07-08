import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: /sign in to gateway/i }).click();
  await expect(page.getByText("My Energy Dashboard")).toBeVisible();
});

test("consumer dashboard keeps the WattWise demo controls visible", async ({ page }) => {
  await expect(page.getByText("My Energy Dashboard")).toBeVisible();
  await expect(page.getByText("Demo Simulator")).toBeVisible();
  await expect(page.getByRole("button", { name: /high/i })).toBeVisible();
  await expect(page.getByText("Ask AI")).toBeVisible();
});

test("assistant route is available for orchestrator chat", async ({ page }) => {
  await page.goto("/assistant");

  await expect(page.getByText(/assistant/i).first()).toBeVisible();
});
