import { expect, test } from "@playwright/test";

test("las páginas principales no generan desbordamiento horizontal", async ({ page }) => {
  for (const path of ["/", "/messages", "/workflows", "/analytics", "/settings"]) {
    await page.goto(path);
    await expect(page.locator("main#main-content")).toBeVisible();
    const overflows = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(overflows, `${path} no debe desbordarse horizontalmente`).toBe(false);
  }
});

test("sin sesión se ofrece una conexión segura con Fanvue", async ({ page }) => {
  await page.context().clearCookies();
  await page.goto("/");
  const connect = page.getByRole("link", { name: /Conectar/ }).first();
  await expect(connect).toBeVisible();
  await expect(connect).toHaveAttribute("href", "/api/auth/fanvue");
});
