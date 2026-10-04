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

    await user.type(screen.getByLabelText("Type countries"), "countrie");
    expect(archiveAll).toBeDisabled();

    await user.type(screen.getByLabelText("Type countries"), "s");
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
    await user.type(screen.getByLabelText("Type countries"), "countries");
    expect(deleteAll).toBeDisabled();

    await user.type(screen.getByLabelText("Type delete countries"), "delete countries");
    expect(deleteAll).toBeEnabled();
    expect(emptyArchive).toBeEnabled();
  });

  it("sends emptyArchive rather than a list of ids", async () => {
    threeCountries();
    const user = userEvent.setup();
    render(<BulkDataManager />);
    await screen.findByText("Alpha");
    await user.type(screen.getByLabelText("Type delete countries"), "delete countries");

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
    await screen.findByText("2 archived records deleted.");
    expect(JSON.parse(calls[0])).toEqual({ emptyArchive: true });
  });

  /* What actually happened on production: two countries ticked, the phrase
     typed, Delete pressed -- and the ticks cleared and nothing else. Both
     countries still had universities, and the sentence saying so was in the
     notice at the top of the screen, a page and a half above the button,
     in green. */
  it("says under the button which rows were refused and why, and leaves them ticked", async () => {
    threeCountries();
    const user = userEvent.setup();
    render(<BulkDataManager />);
    await screen.findByText("Alpha");
    await user.click(screen.getByRole("checkbox", { name: "Select all 3" }));
    await user.type(screen.getByLabelText("Type delete countries"), "delete countries");

    const sent: string[] = [];
    authFetch.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/countries/bulk-delete")) {
        sent.push(String(init?.body ?? ""));
        return Promise.resolve(
          jsonResponse({
            deleted: 0,
            blocked: [
              { id: "c-1", label: "Alpha", reason: "40 universities still point to it" },
              { id: "c-2", label: "Beta", reason: "16 universities still point to it" },
              { id: "c-3", label: "Gamma", reason: "1 university still points to it" },
            ],
          }),
        );
      }
      /* Nothing went, so the list comes back as it was. */
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

    await user.click(screen.getByRole("button", { name: "Delete selected (3)" }));

    const note = await screen.findByRole("alert");
    expect(note).toHaveTextContent("Nothing was deleted.");
    expect(note).toHaveTextContent("Alpha — 40 universities still point to it");
    expect(note).toHaveTextContent("Beta — 16 universities still point to it");
    expect(note).toHaveTextContent("They are still ticked below.");
    /* Not the green of a thing that worked. */
    expect(screen.queryByRole("status")).toBeNull();

    /* Where the operator is looking: after the delete buttons, before the
       table -- not above the whole panel. */
    const button = screen.getByRole("button", { name: /Delete selected/ });
    const table = screen.getByRole("table");
    expect(button.compareDocumentPosition(note) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(note.compareDocumentPosition(table) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    /* Still ticked, so it is plain which rows were meant; and locked again,
       so a second press is a second decision. */
    expect(screen.getByRole("button", { name: "Delete selected (3)" })).toBeDisabled();
    expect(screen.getByLabelText("Type delete countries")).toHaveValue("");
    expect(JSON.parse(sent[0]).ids).toHaveLength(3);
  });

  it("counts what went and names what did not", async () => {
    threeCountries();
    const user = userEvent.setup();
    render(<BulkDataManager />);
    await screen.findByText("Alpha");
    await user.type(screen.getByLabelText("Type delete countries"), "delete countries");

    authFetch.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/countries/bulk-delete"))
        return Promise.resolve(
          jsonResponse({
            deleted: 2,
            /* No label: an older server. The list supplies the name. */
            blocked: [{ id: "c-2", reason: "16 universities still point to it" }],
          }),
        );
      if (url.endsWith("/countries/records"))
        return Promise.resolve(jsonResponse([{ id: "c-2", name: "Beta" }]));
      return Promise.reject(new Error(`Unexpected request: ${url}`));
    });

    await user.click(screen.getByRole("button", { name: "Delete all 3" }));

    const note = await screen.findByRole("alert");
    expect(note).toHaveTextContent("2 deleted, 1 not.");
    expect(note).toHaveTextContent("Beta — 16 universities still point to it");
    expect(note).toHaveTextContent("It is still ticked below.");
    expect(screen.getByRole("button", { name: /Delete selected \(1\)/ })).toBeVisible();
  });

  it("says so in the same place when everything went", async () => {
    threeCountries();
    const user = userEvent.setup();
    render(<BulkDataManager />);
    await screen.findByText("Alpha");
    await user.type(screen.getByLabelText("Type delete countries"), "delete countries");

    authFetch.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/countries/bulk-delete"))
        return Promise.resolve(jsonResponse({ deleted: 3, blocked: [] }));
      if (url.endsWith("/countries/records")) return Promise.resolve(jsonResponse([]));
      return Promise.reject(new Error(`Unexpected request: ${url}`));
    });

    await user.click(screen.getByRole("button", { name: "Delete all 3" }));
    expect(await screen.findByRole("status")).toHaveTextContent("3 records deleted.");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("reports a request that failed outright there too", async () => {
    threeCountries();
    const user = userEvent.setup();
    render(<BulkDataManager />);
    await screen.findByText("Alpha");
    await user.type(screen.getByLabelText("Type delete countries"), "delete countries");

    authFetch.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/countries/bulk-delete"))
        return Promise.resolve({
          ok: false,
          json: async () => ({ data: null, error: { message: "The server said no" } }),
        } as Response);
      return Promise.reject(new Error(`Unexpected request: ${url}`));
    });

    await user.click(screen.getByRole("button", { name: "Delete all 3" }));
    const note = await screen.findByTestId("bulk-outcome");
    expect(note).toHaveTextContent("Nothing was deleted.");
    expect(note).toHaveTextContent("The server said no");
  });
});

describe("archiving, reported where it was asked for", () => {
  it("names the rows it would not archive", async () => {
    threeCountries();
    const user = userEvent.setup();
    render(<BulkDataManager />);
    await screen.findByText("Alpha");
    await user.click(screen.getByRole("checkbox", { name: "Select all 3" }));

    authFetch.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/countries/bulk-archive"))
        return Promise.resolve(
          jsonResponse({
            archived: 2,
            blocked: [{ id: "c-3", reason: "4 cities still reference this state" }],
          }),
        );
      if (url.endsWith("/countries/records"))
        return Promise.resolve(jsonResponse([{ id: "c-3", name: "Gamma" }]));
      return Promise.reject(new Error(`Unexpected request: ${url}`));
    });

    await user.click(screen.getByRole("button", { name: "Archive selected (3)" }));

    const note = await screen.findByRole("alert");
    expect(note).toHaveTextContent("2 archived, 1 not.");
    /* The server sends ids for an archive. The name comes from the list as
       it stood before the reload. */
    expect(note).toHaveTextContent("Gamma — 4 cities still reference this state");
    expect(screen.getByRole("button", { name: "Archive selected (1)" })).toBeVisible();
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
    await user.type(screen.getByLabelText("Type delete countries"), "delete countries");
    await user.type(screen.getByLabelText("Type countries"), "countries");
    expect(screen.getByRole("button", { name: "Delete all 1" })).toBeEnabled();

    await user.selectOptions(screen.getByLabelText("Resource"), "subjects");
    await screen.findByText("Engineering");

    expect(screen.getByRole("button", { name: /Delete selected \(0\)/ })).toBeVisible();
    // The labels follow the resource, and both boxes come up empty under them.
    expect(screen.getByLabelText("Type delete subjects")).toHaveValue("");
    expect(screen.getByLabelText("Type subjects")).toHaveValue("");
    expect(screen.queryByLabelText("Type delete countries")).toBeNull();
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

    const archive = screen.getByLabelText("Type countries");
    const del = screen.getByLabelText("Type delete countries");

    expect(archive).toHaveAttribute("placeholder", "Type to confirm");
    expect(del).toHaveAttribute("placeholder", "Type to confirm");
    expect(archive).toHaveValue("");
    expect(del).toHaveValue("");

    // The phrase is on the field's own label, and the lock says so.
    expect(screen.getAllByText("delete countries").length).toBeGreaterThan(0);
    expect(
      screen.getByText(/Locked until the box reads .delete countries./),
    ).toBeVisible();
    expect(
      screen.getByText(/Locked until the box reads .countries./),
    ).toBeVisible();
  });
});
