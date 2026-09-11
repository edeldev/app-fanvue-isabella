import { expect, test } from "@playwright/test";

const destinations = [
  ["Dashboard", "/"],
  ["Fans", "/fans"],
  ["Mensajes", "/messages"],
  ["Plantillas", "/templates"],
  ["Flujos", "/workflows"],
  ["Automatización", "/automation"],
  ["Analítica", "/analytics"],
  ["Configuración", "/settings"],
] as const;

test("las secciones principales cargan y señalan la ruta activa", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.includes("mobile"), "La navegación móvil se prueba por separado.");

  for (const [label, path] of destinations) {
    await page.goto(path);
    await expect(page.locator("main#main-content")).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Navegación principal" }).getByRole("link", { name: label, exact: true })).toHaveAttribute("aria-current", "page");
  }
});

test("el menú móvil navega y se puede cerrar con Escape", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes("mobile"), "Prueba exclusiva del layout móvil.");
  await page.goto("/");

  const opener = page.getByRole("button", { name: "Abrir navegación" });
  await opener.click();
  const dialog = page.getByRole("dialog", { name: "Fanvue CRM" });
  await expect(dialog).toBeVisible();
  await expect(page.getByRole("button", { name: "Cerrar menú" })).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();

  await opener.click();
  await dialog.getByRole("link", { name: "Mensajes", exact: true }).click();
  await expect(page).toHaveURL(/\/messages$/);
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("heading", { name: "Mensajes" })).toBeVisible();
});

test("el enlace de salto lleva el foco al contenido", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  const skipLink = page.getByRole("link", { name: "Saltar al contenido principal" });
  await expect(skipLink).toBeFocused();
  await skipLink.press("Enter");
  await expect(page.locator("main#main-content")).toBeFocused();
});

test("la búsqueda global responde al atajo y la navegación permanece fija", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.includes("mobile"), "El sidebar solo existe en escritorio.");
  await page.goto("/");

  const search = page.getByRole("textbox", { name: "Buscar en toda la aplicación" });
  await page.keyboard.press("Control+k");
  await expect(search).toBeFocused();

  const sidebar = page.getByRole("complementary");
  const header = page.getByRole("banner");
  await expect(sidebar).toHaveCSS("position", "sticky");
  await expect(header).toHaveCSS("position", "sticky");
});
