import { expect, test } from "@playwright/test";
import { NAV_GROUPS } from "../src/features/shell/nav-config";
import { loginAsAdmin } from "./helpers/admin-auth";

test.describe("Admin sidebar route ownership", () => {
  test("all leaves open one unique module and select exactly one owner", async ({
    page,
  }) => {
    await loginAsAdmin(page);
    const leaves = NAV_GROUPS.flatMap((group) => group.items);
    expect(new Set(leaves.map((item) => item.href)).size).toBe(leaves.length);

    for (const item of leaves) {
      await page.goto(item.href);
      await expect(page, `${item.label} redirected to login`).not.toHaveURL(
        /\/login/,
      );
      const active = page.locator('a[aria-current="page"]');
      await expect(
        active,
        `${item.label} must have one active leaf`,
      ).toHaveCount(1);
      await expect(active).toHaveAttribute("href", item.href);
      await expect(
        page.getByRole("heading", { name: item.label, exact: true }).first(),
        `${item.label} must identify the opened module`,
      ).toBeVisible();
    }
  });

  test("query-scoped shared screens survive Back and Forward", async ({
    page,
  }) => {
    await loginAsAdmin(page);
    await page.goto("/locations?tab=states");
    await expect(page.locator('a[aria-current="page"]')).toHaveAttribute(
      "href",
      "/locations?tab=states",
    );
    await page.goto("/locations?tab=cities");
    await expect(page.locator('a[aria-current="page"]')).toHaveAttribute(
      "href",
      "/locations?tab=cities",
    );
    await page.goBack();
    await expect(page).toHaveURL(/\/locations\?tab=states$/);
    await expect(page.locator('a[aria-current="page"]')).toHaveAttribute(
      "href",
      "/locations?tab=states",
    );
    await page.goForward();
    await expect(page).toHaveURL(/\/locations\?tab=cities$/);
    await expect(page.locator('a[aria-current="page"]')).toHaveAttribute(
      "href",
      "/locations?tab=cities",
    );
  });
});
