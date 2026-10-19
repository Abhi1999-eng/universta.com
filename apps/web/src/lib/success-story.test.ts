import { describe, expect, it } from "vitest";
import {
  countryPath,
  journeyExcerpt,
  moreStories,
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
    expect(countryPath({ slug: "united-kingdom" })).toBe("/study-abroad/united-kingdom");
    expect(
      programmePath({ offering: null }),
    ).toBeNull();
  });

  /* SS-C9. The flat /universities/<uni>/courses/<offering> answered with a
     308; the course's own address is under its university's country. */
  it("links the programme to the course's own address, not the redirecting flat one", () => {
    expect(
      programmePath({
        offering: {
          slug: "meng-civil",
          university: { slug: "university-of-tokyo", country: { slug: "japan" } },
          genericCourse: { slug: "meng-civil-engineering" },
        },
      }),
    ).toBe("/study-abroad/japan/universities/university-of-tokyo/courses/meng-civil");
  });

  it("falls back to the general course when the university's country is unknown", () => {
    const path = programmePath({
      offering: {
        slug: "msc-marketing",
        university: { slug: "westbridge" },
        genericCourse: { slug: "msc-marketing" },
      },
    });
    expect(path).toBe("/courses/msc-marketing");
    expect(path).not.toContain("/universities/");
    expect(programmePath({ offering: { slug: "msc-marketing", university: { slug: "westbridge" } } })).toBeNull();
  });
});

describe("moreStories (SS-U2)", () => {
  const story = (id: string, country?: string, university?: string) => ({
    id,
    slug: id,
    country: country ? { slug: country } : null,
    university: university ? { slug: university } : null,
  });

  it("puts stories from the same country or university first, then keeps display order", () => {
    const all = [story("a"), story("b", "germany"), story("current", "japan", "utokyo"), story("c", "japan"), story("d"), story("e", null as never, "utokyo"), story("f")];
    expect(moreStories(all[2], all).map((row) => row.id)).toEqual(["c", "e", "a", "b"]);
  });

  it("never offers the story being read, and offers nothing when it is the only one", () => {
    expect(moreStories(story("only"), [story("only")])).toEqual([]);
  });
});
