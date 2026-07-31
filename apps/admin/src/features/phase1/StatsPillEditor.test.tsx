import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { StatsPillEditor } from "./StatsPillEditor";

const authFetch = vi.fn();
vi.mock("@/features/auth/auth-client", () => ({
  authFetch: (...args: unknown[]) => authFetch(...args),
}));
vi.mock("@/features/website/DevicePreview", () => ({
  DevicePreview: () => <div>Secure preview</div>,
}));

const payload = {
  page: { title: "Home", slug: "home" },
  section: { id: "section-1", displayOrder: 0, status: "ACTIVE" },
  draft: {
    visible: true,
    variant: "pill",
    icon: { visible: true, name: "dot" },
    items: [
      {
        id: "destinations",
        visible: true,
        label: "destinations",
        singularLabel: "destination",
        sourceMode: "AUTOMATIC",
        automaticSource: "PUBLISHED_COUNTRIES",
        manualValue: null,
        displayOrder: 0,
      },
      {
        id: "universities",
        visible: true,
        label: "universities",
        singularLabel: "university",
        sourceMode: "AUTOMATIC",
        automaticSource: "PUBLISHED_UNIVERSITIES",
        manualValue: null,
        displayOrder: 1,
      },
    ],
  },
  published: {},
  sources: [
    { value: "PUBLISHED_COUNTRIES", label: "Published countries", count: 13 },
    {
      value: "PUBLISHED_UNIVERSITIES",
      label: "Published universities",
      count: 942,
    },
  ],
};

function response(data: unknown, status = 200) {
  return Promise.resolve({
    ok: status < 400,
    json: async () => ({ data, error: null }),
  });
}

describe("StatsPillEditor", () => {
  beforeEach(() => authFetch.mockReset());

  it("loads the selected page configuration and shows resolved automatic counts", async () => {
    authFetch.mockImplementationOnce(() => response(payload));
    render(
      <StatsPillEditor
        pageId="page-home"
        index={0}
        total={2}
        onMove={vi.fn()}
      />,
    );
    expect(await screen.findByTestId("stats-pill-editor")).toBeVisible();
    expect(screen.getByText("Current resolved count: 13")).toBeVisible();
    expect(screen.getByText("Current resolved count: 942")).toBeVisible();
    expect(authFetch).toHaveBeenCalledWith(
      "/api/v1/admin/stats-pills/page-home",
      expect.any(Object),
    );
  });

  it("edits Manual mode and saves only a draft with double-submit protection", async () => {
    authFetch.mockImplementationOnce(() => response(payload));
    authFetch.mockImplementationOnce(() =>
      response({ sectionId: "section-1" }),
    );
    render(
      <StatsPillEditor
        pageId="page-home"
        index={0}
        total={1}
        onMove={vi.fn()}
      />,
    );
    await screen.findByTestId("stats-pill-editor");
    fireEvent.change(screen.getAllByLabelText("Source mode")[0], {
      target: { value: "MANUAL" },
    });
    fireEvent.change(screen.getAllByLabelText("Manual value")[0], {
      target: { value: "25" },
    });
    fireEvent.change(screen.getByDisplayValue("destinations"), {
      target: { value: "places" },
    });
    const save = screen.getByRole("button", { name: "Save Draft" });
    fireEvent.click(save);
    fireEvent.click(save);
    await waitFor(() => expect(authFetch).toHaveBeenCalledTimes(2));
    const [, init] = authFetch.mock.calls[1];
    const submitted = JSON.parse((init as RequestInit).body as string);
    expect(submitted.config.items[0]).toMatchObject({
      label: "places",
      sourceMode: "MANUAL",
      manualValue: 25,
    });
    expect(await screen.findByText(/Public pages are unchanged/)).toBeVisible();
  });

  it("blocks Preview while local changes are unsaved", async () => {
    authFetch.mockImplementationOnce(() => response(payload));
    render(
      <StatsPillEditor
        pageId="page-home"
        index={0}
        total={1}
        onMove={vi.fn()}
      />,
    );
    await screen.findByTestId("stats-pill-editor");
    fireEvent.change(screen.getByDisplayValue("destinations"), {
      target: { value: "places" },
    });
    expect(
      screen.getByRole("button", { name: "Preview saved draft" }),
    ).toBeDisabled();
  });

  it("reloads by exact Page id without retaining the previous page form", async () => {
    const countries = {
      ...payload,
      page: { title: "Countries", slug: "countries" },
      draft: {
        ...payload.draft,
        items: payload.draft.items.map((item) => ({
          ...item,
          label: item.id === "destinations" ? "country destinations" : item.label,
        })),
      },
    };
    authFetch.mockImplementationOnce(() => response(payload));
    authFetch.mockImplementationOnce(() => response(countries));
    const view = render(
      <StatsPillEditor
        pageId="page-home"
        index={0}
        total={1}
        onMove={vi.fn()}
      />,
    );
    await screen.findByDisplayValue("destinations");
    view.rerender(
      <StatsPillEditor
        pageId="page-countries"
        index={0}
        total={1}
        onMove={vi.fn()}
      />,
    );
    expect(await screen.findByDisplayValue("country destinations")).toBeVisible();
    expect(authFetch).toHaveBeenLastCalledWith(
      "/api/v1/admin/stats-pills/page-countries",
      expect.any(Object),
    );
  });
});
