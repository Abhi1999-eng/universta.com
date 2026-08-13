import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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

const courseTemplate = {
  seoTitleTemplate: "",
  metaDescriptionTemplate: "",
  ogTitleTemplate: null,
  ogDescriptionTemplate: null,
  canonicalTemplate: null,
  robotsIndex: null,
  robotsFollow: null,
};
const definitions = [
  {
    key: "course",
    label: "Generic Courses",
    variables: [
      { key: "courseName", label: "Course name" },
      { key: "courseSlug", label: "Course slug" },
      { key: "subjectName", label: "Subject name" },
      { key: "degreeLevel", label: "Degree level" },
    ],
    template: courseTemplate,
  },
  {
    key: "university",
    label: "Universities",
    variables: [{ key: "universityName", label: "University name" }],
    template: courseTemplate,
  },
];

function mockApi() {
  authFetch.mockImplementation((path: string, init?: RequestInit) => {
    if (path.endsWith("/templates"))
      return Promise.resolve(response(definitions));
    if (path.includes("/preview")) {
      return Promise.resolve(
        response({
          record: { id: "course-1", label: "MSc Computer Science" },
          resolved: {
            seoTitle: "MSc Computer Science | Universta",
            metaDescription: "Explore MSc Computer Science on Universta.",
            canonicalUrl: "/courses/computer-science",
            source: { title: "bulk", description: "bulk" },
          },
          message: null,
        }),
      );
    }
    if (init?.method === "PUT")
      return Promise.resolve(response(courseTemplate));
    throw new Error(`Unexpected request: ${path}`);
  });
}

describe("BulkSeoManager", () => {
  beforeEach(() => {
    authFetch.mockReset();
    mockApi();
  });

  it("keeps Advanced SEO collapsed while loading existing templates and inherited settings", async () => {
    render(<BulkSeoManager />);
    expect(await screen.findByLabelText("SEO title template")).toHaveValue("");
    expect(screen.getByText("View available variables")).toBeInTheDocument();
    const advanced = screen
      .getByText("Advanced SEO settings")
      .closest("details");
    expect(advanced).not.toHaveAttribute("open");
    expect(screen.getByLabelText("Indexing behaviour")).toHaveValue("inherit");
    expect(screen.getByLabelText("Link following behaviour")).toHaveValue(
      "inherit",
    );
  });

  it("opens contextual autocomplete from { and % and inserts canonical variables with keyboard selection", async () => {
    const user = userEvent.setup();
    render(<BulkSeoManager />);
    const title = await screen.findByLabelText("SEO title template");

    title.focus();
    fireEvent.change(title, { target: { value: "{cou", selectionStart: 4 } });
    expect(await screen.findByRole("listbox")).toHaveTextContent("Course name");
    expect(screen.getByRole("listbox")).toHaveTextContent("Course slug");
    expect(screen.getByRole("listbox")).not.toHaveTextContent(
      "University name",
    );
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    await user.clear(title);
    fireEvent.change(title, { target: { value: "{cou", selectionStart: 4 } });
    await screen.findByRole("listbox");
    await user.keyboard("{ArrowDown}{Enter}");
    expect(title).toHaveValue("{courseSlug}");

    await user.clear(title);
    fireEvent.change(title, { target: { value: "%", selectionStart: 1 } });
    await user.keyboard("{Enter}");
    expect(title).toHaveValue("{courseName}");
  });

  it("uses the shared Insert variable control and rejects unsupported variables inline", async () => {
    const user = userEvent.setup();
    render(<BulkSeoManager />);
    const title = await screen.findByLabelText("SEO title template");

    await user.click(
      screen.getAllByRole("button", { name: "+ Insert variable" })[0],
    );
    await user.click(
      await screen.findByRole("option", { name: /Course name/ }),
    );
    expect(title).toHaveValue("{courseName}");

    await user.clear(title);
    fireEvent.change(title, {
      target: { value: "{universityName}", selectionStart: 16 },
    });
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "University Name is not available for Generic Courses.",
    );
    await user.click(screen.getByRole("button", { name: "Save Bulk SEO" }));
    expect(authFetch).not.toHaveBeenCalledWith(
      expect.stringContaining("/templates/course"),
      expect.objectContaining({ method: "PUT" }),
    );
  });

  it("guards unsaved entity changes and refreshes entity-specific placeholders after discard", async () => {
    const user = userEvent.setup();
    render(<BulkSeoManager />);
    const title = await screen.findByLabelText("SEO title template");
    await user.type(title, "Draft title");
    await user.selectOptions(
      screen.getByLabelText("Configure SEO for"),
      "university",
    );
    expect(screen.getByRole("alert")).toHaveTextContent("unsaved changes");
    expect(screen.getByLabelText("Configure SEO for")).toHaveValue("course");
    await user.click(
      screen.getByRole("button", { name: "Discard changes and switch" }),
    );
    expect(screen.getByLabelText("Configure SEO for")).toHaveValue(
      "university",
    );
    expect(screen.getByLabelText("SEO title template")).toHaveAttribute(
      "placeholder",
      "{universityName} | Universta",
    );
  });

  it("updates the live preview, applies a recommended safe template, and saves through the focused endpoint", async () => {
    const user = userEvent.setup();
    render(<BulkSeoManager />);
    await waitFor(() =>
      expect(
        screen.getByRole("region", { name: "Bulk SEO preview" }),
      ).toHaveTextContent("Previewing: MSc Computer Science"),
    );

    await user.click(
      screen.getByRole("button", { name: "Use recommended template" }),
    );
    expect(screen.getByLabelText("SEO title template")).toHaveValue(
      "{courseName} | Universta",
    );
    expect(screen.getByLabelText("Meta description template")).toHaveValue(
      "Explore {courseName} on Universta.",
    );
    await waitFor(() =>
      expect(
        authFetch.mock.calls.filter(([path]) =>
          String(path).includes("/preview"),
        ).length,
      ).toBeGreaterThan(1),
    );
    await user.click(screen.getByRole("button", { name: "Save Bulk SEO" }));
    await waitFor(() =>
      expect(authFetch).toHaveBeenCalledWith(
        "/api/v1/admin/seo-management/templates/course",
        expect.objectContaining({ method: "PUT" }),
      ),
    );
    expect(await screen.findByRole("status")).toHaveTextContent("Saved");
  });
});
