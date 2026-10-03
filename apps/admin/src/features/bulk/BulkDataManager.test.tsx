import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BulkDataManager } from "./BulkDataManager";

const authFetch = vi.fn();

/* Both arguments forwarded: a test that cares what was sent, rather than
   only where, has no other way to see the body. */
vi.mock("@/features/auth/auth-client", () => ({
  authFetch: (input: RequestInfo | URL, init?: RequestInit) =>
    authFetch(input, init),
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

/** Three countries, so "all" means something a selection does not. */
function threeCountries() {
  authFetch.mockImplementation((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith("/resources"))
      return Promise.resolve(
        jsonResponse([
          {
            key: "countries",
            label: "Countries",
            columns: ["Name"],
            requiredColumns: ["Name"],
            updatableColumns: ["name"],
            fields: [{ key: "name", label: "Name", required: true }],
          },
        ]),
      );
    if (url.endsWith("/countries/records"))
      return Promise.resolve(
        jsonResponse([
          { id: "c-1", name: "Alpha" },
          { id: "c-2", name: "Beta" },
          { id: "c-3", name: "Gamma" },
        ]),
      );
    return Promise.reject(new Error(`Unexpected request: ${url}`));
  });
}

describe("selecting records in bulk", () => {
  it("ticks and clears every row from the header box", async () => {
    threeCountries();
    const user = userEvent.setup();
    render(<BulkDataManager />);
    await screen.findByText("Alpha");

    await user.click(screen.getByRole("checkbox", { name: "Select all 3" }));
    expect(screen.getByRole("button", { name: /Archive selected \(3\)/ })).toBeVisible();

    await user.click(screen.getByRole("checkbox", { name: "Clear selection" }));
    expect(screen.getByRole("button", { name: /Archive selected \(0\)/ })).toBeVisible();
  });

  it("will not archive everything until the resource is typed", async () => {
    threeCountries();
    const user = userEvent.setup();
    render(<BulkDataManager />);
    await screen.findByText("Alpha");

    const archiveAll = screen.getByRole("button", { name: "Archive all 3" });
    expect(archiveAll).toBeDisabled();

    await user.type(screen.getByLabelText(/Archive every countries record/), "countrie");
    expect(archiveAll).toBeDisabled();

    await user.type(screen.getByLabelText(/Archive every countries record/), "s");
    expect(archiveAll).toBeEnabled();
  });

  it("archives nothing when there is nothing to archive", async () => {
    authFetch.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/resources"))
        return Promise.resolve(
          jsonResponse([
            {
              key: "countries",
              label: "Countries",
              columns: ["Name"],
              requiredColumns: ["Name"],
              updatableColumns: ["name"],
              fields: [{ key: "name", label: "Name", required: true }],
            },
          ]),
        );
      if (url.endsWith("/countries/records")) return Promise.resolve(jsonResponse([]));
      return Promise.reject(new Error(`Unexpected request: ${url}`));
    });
    render(<BulkDataManager />);
    expect(await screen.findByText("No records yet.")).toBeVisible();
    // The confirmation panel is not offered at all, so it cannot be armed.
    expect(screen.queryByRole("button", { name: /Archive all/ })).toBeNull();
  });
});

describe("deleting rather than archiving", () => {
  it("keeps all three delete controls locked until the phrase is typed", async () => {
    threeCountries();
    const user = userEvent.setup();
    render(<BulkDataManager />);
    await screen.findByText("Alpha");

    const deleteAll = screen.getByRole("button", { name: "Delete all 3" });
    const emptyArchive = screen.getByRole("button", { name: "Empty archive" });
    expect(deleteAll).toBeDisabled();
    expect(emptyArchive).toBeDisabled();

    // The archive confirmation is not the delete confirmation.
    await user.type(screen.getByLabelText(/Archive every countries record/), "countries");
    expect(deleteAll).toBeDisabled();

    await user.type(screen.getByLabelText("Delete permanently"), "delete countries");
    expect(deleteAll).toBeEnabled();
    expect(emptyArchive).toBeEnabled();
  });

  it("sends emptyArchive rather than a list of ids", async () => {
    threeCountries();
    const user = userEvent.setup();
    render(<BulkDataManager />);
    await screen.findByText("Alpha");
    await user.type(screen.getByLabelText("Delete permanently"), "delete countries");

    const calls: string[] = [];
    authFetch.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/countries/bulk-delete")) {
        calls.push(String(init?.body ?? ""));
        return Promise.resolve(jsonResponse({ deleted: 2, blocked: [] }));
      }
      if (url.endsWith("/countries/records")) return Promise.resolve(jsonResponse([]));
      return Promise.reject(new Error(`Unexpected request: ${url}`));
    });

    await user.click(screen.getByRole("button", { name: "Empty archive" }));
    await screen.findByText(/Deleted 2 archived record\(s\)\./);
    expect(JSON.parse(calls[0])).toEqual({ emptyArchive: true });
  });

  it("reports what the database would not let go", async () => {
    threeCountries();
    const user = userEvent.setup();
    render(<BulkDataManager />);
    await screen.findByText("Alpha");
    await user.type(screen.getByLabelText("Delete permanently"), "delete countries");

    authFetch.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/countries/bulk-delete"))
        return Promise.resolve(
          jsonResponse({
            deleted: 1,
            blocked: [
              { id: "c-2", reason: "Still referenced by universities_country_id_fkey" },
            ],
          }),
        );
      if (url.endsWith("/countries/records")) return Promise.resolve(jsonResponse([]));
      return Promise.reject(new Error(`Unexpected request: ${url}`));
    });

    await user.click(screen.getByRole("button", { name: "Delete all 3" }));
    expect(
      await screen.findByText(/1 could not go \(Still referenced by universities_country_id_fkey\)/),
    ).toBeVisible();
  });
});

describe("switching to a different entity", () => {
  /** Two resources, so the screen can be moved between them. */
  function twoResources() {
    authFetch.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/resources"))
        return Promise.resolve(
          jsonResponse([
            {
              key: "countries",
              label: "Countries",
              columns: ["Name"],
              requiredColumns: ["Name"],
              updatableColumns: ["name"],
              fields: [{ key: "name", label: "Name", required: true }],
            },
            {
              key: "subjects",
              label: "Subjects",
              columns: ["Name"],
              requiredColumns: ["Name"],
              updatableColumns: ["name"],
              fields: [{ key: "name", label: "Name", required: true }],
            },
          ]),
        );
      if (url.endsWith("/countries/records"))
        return Promise.resolve(jsonResponse([{ id: "c-1", name: "Alpha" }]));
      if (url.endsWith("/subjects/records"))
        return Promise.resolve(jsonResponse([{ id: "s-1", name: "Engineering" }]));
      return Promise.reject(new Error(`Unexpected request: ${url}`));
    });
  }

  it("drops the selection and both confirmations", async () => {
    // The ticked ids belong to the table being left, and the phrases were
    // typed about it. Carrying either across is how the wrong rows go.
    twoResources();
    const user = userEvent.setup();
    render(<BulkDataManager />);
    await screen.findByText("Alpha");

    await user.click(screen.getByRole("checkbox", { name: "Select all 1" }));
    await user.type(screen.getByLabelText("Delete permanently"), "delete countries");
    await user.type(screen.getByLabelText(/Archive every countries record/), "countries");
    expect(screen.getByRole("button", { name: "Delete all 1" })).toBeEnabled();

    await user.selectOptions(screen.getByLabelText("Resource"), "subjects");
    await screen.findByText("Engineering");

    expect(screen.getByRole("button", { name: /Delete selected \(0\)/ })).toBeVisible();
    expect(screen.getByLabelText("Delete permanently")).toHaveValue("");
    expect(screen.getByLabelText(/Archive every subjects record/)).toHaveValue("");
    expect(screen.getByRole("button", { name: "Delete all 1" })).toBeDisabled();
  });

  it("offers no Delete all when the resource has nothing live", async () => {
    authFetch.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/resources"))
        return Promise.resolve(
          jsonResponse([
            {
              key: "countries",
              label: "Countries",
              columns: ["Name"],
              requiredColumns: ["Name"],
              updatableColumns: ["name"],
              fields: [{ key: "name", label: "Name", required: true }],
            },
          ]),
        );
      if (url.endsWith("/countries/records")) return Promise.resolve(jsonResponse([]));
      return Promise.reject(new Error(`Unexpected request: ${url}`));
    });
    render(<BulkDataManager />);
    await screen.findByText("No records yet.");
    expect(screen.queryByRole("button", { name: /^Delete all/ })).toBeNull();
    // Emptying the archive is still the thing you would want here.
    expect(screen.getByRole("button", { name: "Empty archive" })).toBeVisible();
  });
});

describe("the confirmation boxes", () => {
  /** A box whose placeholder is the phrase looks already filled in, and the
   * button beside it looks broken rather than locked. */
  it("prompt in the box, phrase in the instruction", async () => {
    threeCountries();
    render(<BulkDataManager />);
    await screen.findByText("Alpha");

    const archive = screen.getByLabelText(/Archive every countries record/);
    const del = screen.getByLabelText("Delete permanently");

    expect(archive).toHaveAttribute("placeholder", "Type to confirm");
    expect(del).toHaveAttribute("placeholder", "Type to confirm");
    expect(archive).toHaveValue("");
    expect(del).toHaveValue("");

    // The phrase is still said, where it reads as an instruction.
    expect(screen.getByText(/to confirm\. They are/)).toBeVisible();
    expect(screen.getByText(/to confirm\. Anything still referenced/)).toBeVisible();
    expect(screen.getAllByText("delete countries").length).toBeGreaterThan(0);
  });
});
