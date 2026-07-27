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
});
