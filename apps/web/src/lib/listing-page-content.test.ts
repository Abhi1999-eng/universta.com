import { afterEach, describe, expect, it, vi } from "vitest";
import { getListingPageContent } from "./listing-page-content";

afterEach(() => {
  vi.unstubAllGlobals();
});

function pageResponse(data: unknown): Response {
  return new Response(JSON.stringify({ data }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

describe("getListingPageContent", () => {
  it("never promotes the stats-pill utility title into the public hero", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        pageResponse({
          title: "Universities Listing",
          shortDescription: "Managed listing introduction.",
          sections: [
            {
              sectionKey: "stats-pill",
              sectionType: "STATS",
              heading: "Statistics pill",
              status: "ACTIVE",
            },
          ],
        }),
      ),
    );

    await expect(getListingPageContent("universities-listing")).resolves.toEqual(
      {
        heading: undefined,
        lede: "Managed listing introduction.",
        ctaHeading: undefined,
        ctaBody: undefined,
      },
    );
  });

  it("preserves the first editorial section as the managed hero fallback", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        pageResponse({
          sections: [
            {
              sectionKey: "stats-pill",
              sectionType: "STATS",
              heading: "Statistics pill",
              status: "ACTIVE",
            },
            {
              sectionKey: "introduction",
              sectionType: "CONTENT",
              heading: "Choose your university",
              subheading: "Compare published institutions.",
              status: "ACTIVE",
            },
          ],
        }),
      ),
    );

    await expect(getListingPageContent("universities-listing")).resolves.toEqual(
      {
        heading: "Choose your university",
        lede: "Compare published institutions.",
        ctaHeading: undefined,
        ctaBody: undefined,
      },
    );
  });
});
