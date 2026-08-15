import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { StudentOperationsManager } from "./StudentOperationsManager";

const authFetch = vi.fn();

vi.mock("@/features/auth/auth-client", () => ({
  authFetch: (...args: unknown[]) => authFetch(...args),
}));

const overview = {
  applications: [
    {
      id: "accepted-application",
      status: "ACCEPTED",
      offering: { name: "Accepted offering" },
      studentProfile: { id: "student-1", user: { firstName: "Avery" } },
    },
    {
      id: "under-review-application",
      status: "UNDER_REVIEW",
      offering: { name: "Under review offering" },
      studentProfile: { id: "student-2", user: { firstName: "Jordan" } },
    },
  ],
  scholarshipApplications: [],
  tickets: [],
  conversations: [],
  referrals: [],
  consultants: [],
};

function jsonResponse(data: unknown) {
  return new Response(JSON.stringify(data), { status: 200 });
}

describe("StudentOperationsManager application actions", () => {
  beforeEach(() => {
    authFetch.mockReset();
    authFetch.mockImplementation(() => Promise.resolve(jsonResponse(overview)));
  });

  it("offers only valid staff transitions and keeps offer receipt behind upload", async () => {
    render(<StudentOperationsManager />);

    const acceptedSelect = await screen.findByLabelText(
      "Change status for Accepted offering",
    );
    expect(
      screen.getByRole("option", { name: "enrolled" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: "offer received" }),
    ).not.toBeInTheDocument();

    fireEvent.change(acceptedSelect, { target: { value: "ENROLLED" } });
    await waitFor(() =>
      expect(authFetch).toHaveBeenCalledWith(
        "/api/v1/admin/student-operations/applications/accepted-application/status",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ status: "ENROLLED" }),
        }),
      ),
    );

    expect(screen.getAllByLabelText(/Upload offer/i)).toHaveLength(1);
    expect(
      screen.queryByLabelText("Change status for Under review offering"),
    ).toBeInTheDocument();
  });
});
