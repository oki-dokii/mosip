import { test, expect } from "@playwright/test";

test("directory and capacity report are navigable without a running experiment", async ({page}) => {
  await page.goto("/");
  await page.getByRole("link",{name:"Parties",exact:true}).click();
  await page.getByLabel("Role").selectOption("issuer");
  await expect(page.getByRole("heading",{name:"walt.id 1.2.0 issuer"})).toBeVisible();
  await expect(page.getByRole("heading",{name:"walt.id 1.2.0 wallet"})).toHaveCount(0);
  await page.getByRole("link",{name:"QR and capabilities"}).click();
  await expect(page.getByRole("table")).toBeVisible();
  await expect(page.getByRole("row").filter({hasText:"Version 39"})).toContainText("Too large");
});
