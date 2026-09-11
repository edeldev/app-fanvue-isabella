import { expect, test } from "@playwright/test";

test("muestra y limpia las notificaciones provenientes de una redirección", async ({ page }) => {
  await page.goto("/?fanvue=signed_out");
  await expect(page.getByText("Sesión cerrada correctamente.")).toBeVisible();
  await expect(page).toHaveURL(/\/$/);
  await page.getByRole("button", { name: "Cerrar notificación" }).click();
  await expect(page.getByText("Sesión cerrada correctamente.")).toBeHidden();
});

test("traduce los errores de mensajes a una notificación útil", async ({ page }) => {
  await page.goto("/messages?error=invalid_price");
  await expect(page.getByText("El PPV necesita archivos y un precio mínimo de $3.00.")).toBeVisible();
  await expect(page).toHaveURL(/\/messages$/);
});
