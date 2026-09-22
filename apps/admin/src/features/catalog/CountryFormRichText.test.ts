import { describe, expect, it } from "vitest";
import { richTextOrEmpty } from "./CountryForm";

/**
 * An emptied rich text editor keeps its empty paragraph, "<p><br></p>". Sent
 * as it was, that landed on the guide as a subheading made of markup.
 */
describe("richTextOrEmpty", () => {
  it("sends an emptied editor as nothing", () => {
    expect(richTextOrEmpty("<p><br></p>")).toBe("");
    expect(richTextOrEmpty("<p>&nbsp;</p>")).toBe("");
    expect(richTextOrEmpty("  ")).toBe("");
  });

  it("keeps rich text that has words in it, as written", () => {
    expect(richTextOrEmpty(" <p>A lead worth reading.</p> ")).toBe("<p>A lead worth reading.</p>");
  });
});
