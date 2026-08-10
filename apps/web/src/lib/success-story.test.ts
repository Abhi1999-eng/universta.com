import { describe, expect, it } from "vitest";
import {
  countryPath,
  journeyExcerpt,
  programmePath,
  successStoryCount,
  successStoryPath,
} from "./success-story";

describe("success story public presentation", () => {
  it("uses the canonical detail route and natural count copy", () => {
    expect(successStoryPath("amara-journey")).toBe("/success-stories/amara-journey");
    expect(successStoryCount(1)).toBe("1 success story");
    expect(successStoryCount(2)).toBe("2 success stories");
  });

  it("keeps a short listing excerpt while preserving the full journey for detail", () => {
    expect(journeyExcerpt(" A full\n story ")).toBe("A full story");
    expect(journeyExcerpt("A".repeat(181))).toHaveLength(181);
  });

  it("links only relationships that have an existing public route", () => {
    expect(countryPath({ slug: "united-kingdom" })).toBe("/countries/united-kingdom");
    expect(
      programmePath({
        id: "story-1",
        title: "Story",
        slug: "story",
        journey: "Journey",
        offering: { slug: "msc-marketing", university: { slug: "westbridge" } },
      }),
    ).toBe("/universities/westbridge/courses/msc-marketing");
    expect(
      programmePath({ id: "story-2", title: "Story", slug: "story", journey: "Journey" }),
    ).toBeNull();
  });
});
