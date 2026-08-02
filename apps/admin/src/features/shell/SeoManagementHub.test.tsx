import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SeoManagementHub } from "./SeoManagementHub";

const authFetch = vi.fn();
vi.mock("@/features/auth/auth-client", () => ({
  authFetch: (...args: unknown[]) => authFetch(...args),
}));

/** ISS-030. The "Allow search indexing" checkbox defaulted to checked for
 * every never-saved static page, including compare-countries -- whose
 * defaultRobotsIndex is false so it stays noindex until an admin explicitly
 * opts in. Saving unrelated fields (title/description) on such a page always
 * sent the checkbox's true default straight through, silently making the
 * comparison page indexable the first time anyone touched its SEO title. */
function jsonResponse(data: unknown) {
  return {
    ok: true,
    json: async () => ({ data, error: null }),
  } as Response;
}

describe("SeoManagementHub static page SEO editor", () => {
  it("defaults the indexing checkbox to the page's own default, not always checked", async () => {
    authFetch.mockResolvedValueOnce(
      jsonResponse([
        {
          key: "compare-countries",
          label: "Country comparison",
          defaultRobotsIndex: false,
          seo: null,
        },
      ]),
    );

    const user = userEvent.setup();
    render(<SeoManagementHub />);

    await waitFor(() => expect(screen.getByText("Country comparison")).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: "Edit SEO" }));

    const indexCheckbox = await screen.findByLabelText("Allow search indexing");
    expect(indexCheckbox).not.toBeChecked();
  });

  it("still defaults to checked for a page whose default is indexable", async () => {
    authFetch.mockResolvedValueOnce(
      jsonResponse([
        {
          key: "faq",
          label: "FAQ page",
          defaultRobotsIndex: true,
          seo: null,
        },
      ]),
    );

    const user = userEvent.setup();
    render(<SeoManagementHub />);

    await waitFor(() => expect(screen.getByText("FAQ page")).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: "Edit SEO" }));

    const indexCheckbox = await screen.findByLabelText("Allow search indexing");
    expect(indexCheckbox).toBeChecked();
  });

  it("honors an already-saved record's own robotsIndex over the page default", async () => {
    authFetch.mockResolvedValueOnce(
      jsonResponse([
        {
          key: "compare-countries",
          label: "Country comparison",
          defaultRobotsIndex: false,
          seo: {
            seoTitle: "Compare Study Abroad Destinations",
            metaDescription: "Compare countries side by side.",
            canonicalUrl: null,
            ogTitle: null,
            ogDescription: null,
            robotsIndex: true,
            robotsFollow: true,
          },
        },
      ]),
    );

    const user = userEvent.setup();
    render(<SeoManagementHub />);

    await waitFor(() => expect(screen.getByText("Country comparison")).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: "Edit SEO" }));

    const indexCheckbox = await screen.findByLabelText("Allow search indexing");
    expect(indexCheckbox).toBeChecked();
  });
});
