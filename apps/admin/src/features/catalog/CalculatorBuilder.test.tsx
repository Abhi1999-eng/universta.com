import { describe, expect, it } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CalculatorBuilder } from "./CalculatorBuilder";

/**
 * The calculator used to be typed as JSON. What matters now is that the form
 * produces the same document the API already validates, and that a document it
 * cannot show is left alone rather than flattened.
 */

const config = {
  base: { livingMin: 850, livingMax: 1200, insurance: 130, semesterFee: 275 },
  factors: [
    {
      id: "city",
      label: "Where will you live?",
      options: [
        { value: "campus", label: "On campus", mult: 1 },
        { value: "capital", label: "In the capital", mult: 1.35, note: "Rooms go fast" },
      ],
    },
    {
      id: "programme",
      label: "Which programme?",
      options: [
        { value: "bachelor", label: "Bachelor", tuitionMin: 800, tuitionMax: 800 },
      ],
    },
  ],
};

describe("calculator builder", () => {
  it("shows a stored calculator as filled-in fields, not as JSON", () => {
    render(<CalculatorBuilder value={JSON.stringify(config)} onChange={() => {}} />);
    expect(screen.getByDisplayValue("Where will you live?")).toBeTruthy();
    expect(screen.getByDisplayValue("In the capital")).toBeTruthy();
    expect(screen.getByDisplayValue("1.35")).toBeTruthy();
    expect(screen.getByDisplayValue("Rooms go fast")).toBeTruthy();
    expect(screen.getByDisplayValue("850")).toBeTruthy();
    // The old raw editor is gone for a document the form understands.
    expect(screen.queryByText(/set up outside the form/i)).toBeNull();
  });

  /* The ids are the country page's own keys. Re-saving an untouched record
     must not rename them, or a page that remembered a choice forgets it. */
  it("keeps the ids a stored document already carries", () => {
    let latest = "";
    render(
      <CalculatorBuilder
        value={JSON.stringify(config)}
        onChange={(next) => {
          latest = next;
        }}
      />,
    );
    fireEvent.change(screen.getByDisplayValue("130"), { target: { value: "140" } });
    const parsed = JSON.parse(latest) as typeof config;
    expect(parsed.base.insurance).toBe(140);
    expect(parsed.factors.map((factor) => factor.id)).toEqual(["city", "programme"]);
    expect(parsed.factors[0].options.map((option) => option.value)).toEqual([
      "campus",
      "capital",
    ]);
  });

  /* Nobody should have to invent a key for "Where will you live?". */
  it("derives an id from the question when one is written here", () => {
    let latest = "";
    render(<CalculatorBuilder value="" onChange={(next) => (latest = next)} />);
    fireEvent.change(screen.getByPlaceholderText("Where will you live?"), {
      target: { value: "How will you travel?" },
    });
    fireEvent.change(screen.getByPlaceholderText("In the capital"), {
      target: { value: "By train" },
    });
    const parsed = JSON.parse(latest) as typeof config;
    expect(parsed.factors[0].id).toBe("how-will-you-travel");
    expect(parsed.factors[0].options[0].value).toBe("by-train");
  });

  it("saves nothing at all when every box is emptied again", () => {
    let latest = "unset";
    render(<CalculatorBuilder value="" onChange={(next) => (latest = next)} />);
    const question = screen.getByPlaceholderText("Where will you live?");
    fireEvent.change(question, { target: { value: "Where will you live?" } });
    expect(latest).not.toBe("");
    fireEvent.change(question, { target: { value: "" } });
    expect(latest).toBe("");
  });

  /* The message names the box, not the field in the document. */
  it("says what is still wrong in the form's own words", () => {
    render(<CalculatorBuilder value="" onChange={() => {}} />);
    fireEvent.change(screen.getByPlaceholderText("Where will you live?"), {
      target: { value: "Where will you live?" },
    });
    expect(
      screen.getByText(/Fill all four monthly cost boxes, or clear the whole calculator/i),
    ).toBeTruthy();
    expect(screen.getByText(/needs at least one answer/i)).toBeTruthy();
  });

  it("refuses a living cost change outside the range the page accepts", () => {
    render(<CalculatorBuilder value={JSON.stringify(config)} onChange={() => {}} />);
    fireEvent.change(screen.getByDisplayValue("1.35"), { target: { value: "50" } });
    expect(
      screen.getByText(/the living cost change must be between 0.1 and 5/i),
    ).toBeTruthy();
  });

  /* A document written by hand or by an importer can hold things this form has
     no box for. Rewriting it would quietly drop them. */
  it("leaves a document it cannot show exactly as it is", () => {
    const exotic = JSON.stringify({
      base: { livingMin: 1, livingMax: 2, insurance: 3, semesterFee: 4 },
      factors: [],
      somethingElse: true,
    });
    render(<CalculatorBuilder value={exotic} onChange={() => {}} />);
    expect(screen.getByText(/set up outside the form/i)).toBeTruthy();
    expect(screen.getByDisplayValue(exotic)).toBeTruthy();
  });
});
