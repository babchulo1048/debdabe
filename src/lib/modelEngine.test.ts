import { describe, expect, it } from "vitest";

import { buildSeed } from "@/lib/mock/seed";
import type { ContactLike, TemplateLike } from "./smartRequest";
import { cleanEdge, looseDate, mapPrediction, toTitle } from "./modelEngine";

const seed = buildSeed();
const T = seed.tables["templates"] as unknown as TemplateLike[];
const C = seed.tables["contacts"] as unknown as ContactLike[];
const TODAY = "2026-11-04"; // a Wednesday

describe("converters", () => {
  it("cleans English edge words", () => {
    expect(cleanEdge("on Dec 15")).toBe("Dec 15");
    expect(cleanEdge("at 10am")).toBe("10am");
  });
  it("maps titles", () => {
    expect(toTitle("Mrs")).toBe("ወ/ሮ");
    expect(toTitle("ato")).toBe("አቶ");
    expect(toTitle("xyz")).toBeNull();
  });
  it("reads many date styles", () => {
    expect(looseDate("ህዳር 10 ቀን 2019", TODAY)).toBe("2026-11-19");
    expect(looseDate("on Dec 15", TODAY)).toBe("2026-12-15");
    expect(looseDate("15 Dec", TODAY)).toBe("2026-12-15");
    expect(looseDate("tomorrow", TODAY)).toBe("2026-11-05");
    expect(looseDate("ሰኞ", TODAY)).toBe("2026-11-09");
    expect(looseDate("Wednesday", TODAY)).toBe("2026-11-11"); // the next one, not today
    expect(looseDate("2012", TODAY)).toBeNull(); // a year is not a day
    expect(looseDate("next week", TODAY)).toBeNull();
  });
});

describe("mapPrediction", () => {
  it("salary: title, name, amount, recipient matched to a saved contact", () => {
    const r = mapPrediction(
      {
        intent: "salary_confirmation",
        confidence: 0.99,
        facts: { NAME: "አስቴር ከበደ", AMOUNT: "25,000", PURPOSE: "ቪዛ", RECIPIENT: "ኢትዮጵያ ንግድ ባንክ" },
      },
      T,
      C,
      TODAY,
    )!;
    expect(r.template.title_en).toMatch(/Salary/);
    expect(r.values).toMatchObject({
      employee_name: "አስቴር ከበደ",
      gross_salary: "25000",
      purpose: "ቪዛ",
    });
    expect(r.recipient?.name).toBe("የኢትዮጵያ ንግድ ባንክ");
    expect(r.unconverted).toEqual([]);
  });
  it("leave: no title field, so the title joins the name; days are counted", () => {
    const r = mapPrediction(
      {
        intent: "leave",
        confidence: 0.97,
        facts: { TITLE: "W/ro", NAME: "Almaz Bekele", FROM_DATE: "Jan 5", TO_DATE: "Jan 20" },
      },
      T,
      C,
      TODAY,
    )!;
    expect(r.values).toMatchObject({
      employee_name: "ወ/ሮ Almaz Bekele",
      from_date: "2026-01-05",
      to_date: "2026-01-20",
      days: "16",
    });
  });
  it("reports what it could not convert instead of guessing", () => {
    const r = mapPrediction(
      { intent: "work_experience", confidence: 0.9, facts: { NAME: "Kebede", START_DATE: "2014" } },
      T,
      C,
      TODAY,
    )!;
    expect(r.values["start_date"]).toBeUndefined();
    expect(r.unconverted.map((u) => u.raw)).toEqual(["2014"]);
  });
  it("none → null; a manual pick still maps the facts", () => {
    const p = { intent: "none", confidence: 0.8, facts: { NAME: "ሙሉጌታ" } };
    expect(mapPrediction(p, T, C, TODAY)).toBeNull();
    const forced = mapPrediction(p, T, C, TODAY, "00000000-0000-0000-0000-0000000007e2")!;
    expect(forced.values["employee_name"]).toBe("ሙሉጌታ");
  });
});
