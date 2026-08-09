import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BulkDataManager } from "./BulkDataManager";

const authFetch = vi.fn();

vi.mock("@/features/auth/auth-client", () => ({
  authFetch: (input: RequestInfo | URL) => authFetch(input),
}));

function jsonResponse(data: unknown) {
  return {
    ok: true,
    json: async () => ({ data, error: null }),
  } as Response;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("BulkDataManager existing records", () => {
  it("uses field keys to render human-readable headers and relation values", async () => {
    authFetch.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/resources")) {
        return Promise.resolve(
          jsonResponse([
            {
              key: "countries",
              label: "Countries",
              columns: ["Name", "Continent", "Page heading", "Short description"],
              requiredColumns: ["Name", "Continent"],
              updatableColumns: ["name"],
              fields: [
                { key: "name", label: "Name", required: true },
                { key: "continentSlug", label: "Continent", required: true },
                { key: "pageHeading", label: "Page heading", required: true },
                { key: "shortDescription", label: "Short description", required: true },
              ],
            },
          ]),
        );
      }
      if (url.endsWith("/countries/records")) {
        return Promise.resolve(
          jsonResponse([
            {
              id: "country-1",
              name: "Demo Country",
              continentSlug: "europe",
              pageHeading: "Study in Demo Country",
              shortDescription: "Fictional catalog content.",
            },
          ]),
        );
      }
      return Promise.reject(new Error(`Unexpected request: ${url}`));
    });

    render(<BulkDataManager />);

    expect(await screen.findByText("Demo Country")).toBeVisible();
    expect(screen.getByRole("columnheader", { name: "Name" })).toBeVisible();
    expect(screen.getByRole("columnheader", { name: "Continent" })).toBeVisible();
    expect(screen.getByText("Europe")).toBeVisible();
    expect(screen.getByText("Study in Demo Country")).toBeVisible();
  });
});
