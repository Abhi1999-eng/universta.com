import { expect, test } from "@playwright/test";
import { loginAsAdmin } from "./helpers/admin-auth";
import { adminBaseUrl, apiBaseUrl } from "./helpers/e2e-urls";

type ResolvedPill = {
  items: Array<{ label: string; value: number }>;
} | null;

test("statistics pill draft, preview, publish, hide and restore lifecycle", async ({
  page,
  request,
}) => {
  await loginAsAdmin(page);
  await page.goto(`${adminBaseUrl}/website`);
  const home = page.getByRole("row").filter({ hasText: /^Home/ }).first();
  await home.getByRole("link", { name: "Open in Builder" }).click();
  const editor = page.getByTestId("stats-pill-editor");
  await expect(editor).toBeVisible();

  const publicPill = async (): Promise<ResolvedPill> => {
    const response = await request.get(
      `${apiBaseUrl}/api/v1/phase1/stats-pills/home`,
    );
    expect(response.ok()).toBe(true);
    return (await response.json()).data as ResolvedPill;
  };

  const baseline = await publicPill();
  expect(baseline?.items).toHaveLength(2);
  const originalLabel = await editor.getByLabel("Label").first().inputValue();
  const testLabel = `preview destinations ${Date.now()}`;

  const saveAndPublish = async () => {
    await editor.getByRole("button", { name: "Save Draft" }).click();
    await expect(editor).toContainText("Public pages are unchanged");
    await editor.getByRole("button", { name: "Publish" }).click();
    await expect(editor).toContainText("Published.");
  };

  try {
    await editor.getByLabel("Source mode").first().selectOption("MANUAL");
    await editor.getByLabel("Manual value").first().fill("37");
    await editor.getByLabel("Label").first().fill(testLabel);
    await editor.getByRole("button", { name: "Save Draft" }).click();
    await expect(editor).toContainText("Public pages are unchanged");
    expect(await publicPill()).toEqual(baseline);

    await editor.getByRole("button", { name: "Preview saved draft" }).click();
    const dialog = page.getByRole("dialog", { name: /Preview of/ });
    await expect(dialog).toBeVisible();
    await expect(
      dialog.frameLocator("iframe").getByText(testLabel),
    ).toBeVisible();
    await dialog.getByRole("button", { name: "Close" }).click();

    await editor.getByRole("button", { name: "Publish" }).click();
    await expect(editor).toContainText("Published.");
    expect((await publicPill())?.items[0]).toMatchObject({
      label: testLabel,
      value: 37,
    });

    await editor.getByLabel("Show statistic").nth(1).uncheck();
    await saveAndPublish();
    expect((await publicPill())?.items).toHaveLength(1);

    await editor.getByLabel("Show complete pill").uncheck();
    await saveAndPublish();
    expect(await publicPill()).toBeNull();
  } finally {
    await editor.getByLabel("Show complete pill").check();
    await editor.getByLabel("Show statistic").nth(1).check();
    await editor.getByLabel("Label").first().fill(originalLabel);
    await editor.getByLabel("Source mode").first().selectOption("AUTOMATIC");
    await saveAndPublish();
    expect(await publicPill()).toEqual(baseline);
  }
});
