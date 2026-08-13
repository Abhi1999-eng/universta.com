import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BulkSeoManager } from "./BulkSeoManager";

const authFetch = vi.fn();
vi.mock("@/features/auth/auth-client", () => ({
  authFetch: (...args: unknown[]) => authFetch(...args),
}));

function response(data: unknown) {
  return { ok: true, json: async () => ({ data, error: null }) } as Response;
}
const template = {
  seoTitleTemplate: "{universityName}",
  metaDescriptionTemplate: "About {universityName}",
  ogTitleTemplate: null,
  ogDescriptionTemplate: null,
  canonicalTemplate: null,
  robotsIndex: null,
  robotsFollow: null,
};

describe("BulkSeoManager", () => {
  beforeEach(() => authFetch.mockReset());

  it("shows only the selected entity's allowlisted variables and previews before saving", async () => {
    authFetch.mockResolvedValueOnce(
      response([
        {
          key: "university",
          label: "Universities",
          variables: [{ key: "universityName", label: "University name" }],
          template,
        },
      ]),
    );
    authFetch.mockResolvedValueOnce(
      response({
        record: { id: "university-1", label: "Demo University" },
        resolved: {
          seoTitle: "Demo University",
          metaDescription: "About Demo University",
          canonicalUrl: "/universities/demo-university",
          source: { title: "bulk", description: "bulk" },
        },
        message: null,
      }),
    );
    const user = userEvent.setup();
    render(<BulkSeoManager />);
    expect(await screen.findByText("Available variables")).toBeInTheDocument();
    expect(
      screen.getByText("{universityName} — University name"),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Preview" }));
    expect(
      await screen.findByRole("region", { name: "Bulk SEO preview" }),
    ).toHaveTextContent("Demo University");
  });

  it("saves the selected template through the focused SEO endpoint", async () => {
    authFetch.mockResolvedValueOnce(
      response([
        { key: "university", label: "Universities", variables: [], template },
      ]),
    );
    authFetch.mockResolvedValueOnce(response(template));
    authFetch.mockResolvedValueOnce(
      response({
        record: null,
        resolved: null,
        message: "No published record is available for a live preview yet.",
      }),
    );
    const user = userEvent.setup();
    render(<BulkSeoManager />);
    await screen.findByDisplayValue("{universityName}");
    await user.click(screen.getByRole("button", { name: "Save bulk SEO" }));
    await waitFor(() =>
      expect(authFetch).toHaveBeenCalledWith(
        "/api/v1/admin/seo-management/templates/university",
        expect.objectContaining({ method: "PUT" }),
      ),
    );
  });
});
