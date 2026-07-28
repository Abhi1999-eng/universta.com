import { describe, expect, it } from "vitest";
import { legacyCourseDiscoveryUrl } from "./course-discovery-url";

describe("legacyCourseDiscoveryUrl", () => {
  it("normalizes legacy hierarchy and query values to a canonical lowercase URL", () => {
    expect(
      legacyCourseDiscoveryUrl({
        subject: "Computer-Science",
        subSubject: "Cybersecurity",
        country: "Canada",
        intake: "September",
        englishTest: "IELTS",
        scholarshipAvailable: "TRUE",
      }),
    ).toBe(
      "/courses/computer-science/cybersecurity/canada/september?english-test=ielts&scholarship=true",
    );
  });

  it("normalizes to the three-level hierarchy route when no intake is supplied", () => {
    expect(
      legacyCourseDiscoveryUrl({
        subject: "Computer-Science",
        subSubject: "Cybersecurity",
        country: "Canada",
      }),
    ).toBe("/courses/computer-science/cybersecurity/canada");
  });
});
