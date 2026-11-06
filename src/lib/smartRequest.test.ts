import { describe, expect, it } from "vitest";

import { buildSeed } from "@/lib/mock/seed";
import type { TemplateField } from "@/lib/letters";
import {
  extractDates,
  understandRequest,
  type ContactLike,
  type TemplateLike,
} from "./smartRequest";

const seed = buildSeed();
const templates = seed.tables["templates"] as unknown as TemplateLike[];
const contacts = seed.tables["contacts"] as unknown as ContactLike[];
const TODAY = "2026-11-03";
const run = (s: string) => understandRequest(s, templates, contacts, TODAY);
const keys = (fs: TemplateField[]) => fs.map((f) => f.key);

// The five requests from docs/model_test_1.txt (the 1B model failed all five).
describe("model_test_1 requests", () => {
  it("1. salary confirmation", () => {
    const r = run(
      "ለኢትዮጵያ ንግድ ባንክ ቦሌ ቅርንጫፍ፣ የድርጅታችን ሠራተኛ አቶ አበበ ከበደ ወርሃዊ ደመወዝ ብር 18,500 መሆኑን የሚያረጋግጥ መደበኛ ደብዳቤ ጻፍልኝ።",
    );
    expect(r?.template.title_en).toMatch(/Salary/);
    expect(r?.values).toMatchObject({
      title: "አቶ",
      employee_name: "አበበ ከበደ",
      gross_salary: "18500",
    });
    expect(r?.recipient?.name).toBe("የኢትዮጵያ ንግድ ባንክ");
    expect(keys(r!.missing)).toEqual(["position", "purpose"]);
  });
  it("2. leave", () => {
    const r = run(
      "ሠራተኛዋ ወ/ሮ ሰላም ተስፋዬ ከህዳር 10 እስከ ህዳር 20 ቀን 2019 ዓ.ም የዓመት ፈቃድ እንደተፈቀደላት የሚገልጽ መደበኛ ደብዳቤ ጻፍልኝ።",
    );
    expect(r?.template.title_en).toMatch(/leave/);
    expect(r?.values).toMatchObject({
      employee_name: "ወ/ሮ ሰላም ተስፋዬ",
      from_date: "2026-11-19",
      to_date: "2026-11-29",
      days: "11",
    });
  });
  it("3. meeting", () => {
    const r = run(
      "ለሁሉም የክፍል ኃላፊዎች ህዳር 5 ቀን 2019 ዓ.ም ከጠዋቱ 3:00 ሰዓት በዋናው አዳራሽ ስብሰባ እንዳለ የሚገልጽ የስብሰባ ጥሪ ደብዳቤ ጻፍልኝ።",
    );
    expect(r?.template.title_en).toMatch(/Meeting/);
    expect(r?.values).toMatchObject({
      meeting_date: "2026-11-14",
      meeting_time: "ከጠዋቱ 3:00",
      venue: "ዋናው አዳራሽ",
    });
    expect(r?.recipient?.name).toBe("ሁሉም የክፍል ኃላፊዎች");
  });
  it("4. payment", () => {
    const r = run("ለናሙና አቅራቢ ኃ.የተ.የግ.ማ ያልተከፈለ ብር 45,000 ክፍያ እንዲፈጽሙ የሚጠይቅ መደበኛ ደብዳቤ ጻፍልኝ።");
    expect(r?.template.title_en).toMatch(/Payment/);
    expect(r?.values["amount"]).toBe("45000");
    expect(r?.recipient?.name).toBe("ናሙና አቅራቢ ኃ.የተ.የግ.ማ");
  });
  it("5. work experience", () => {
    const r = run(
      "ለሚመለከተው ሁሉ፣ ወ/ሪት ትዕግሥት አለሙ በድርጅታችን ለ3 ዓመት በሽያጭ ባለሙያነት እንደሠራች የሚገልጽ የሥራ ልምድ ማረጋገጫ ደብዳቤ ጻፍልኝ።",
    );
    expect(r?.template.title_en).toMatch(/experience/);
    expect(r?.values).toMatchObject({
      title: "ወ/ሪት",
      employee_name: "ትዕግሥት አለሙ",
      position: "ሽያጭ ባለሙያ",
    });
    expect(r?.recipient?.name).toBe("ሚመለከተው ሁሉ");
  });
});

describe("other inputs", () => {
  it("English request", () => {
    const r = run("Salary confirmation for Mr Abebe Kebede, 18,500 birr, for a loan");
    expect(r?.template.title_en).toMatch(/Salary/);
    expect(r?.values).toMatchObject({ title: "አቶ", gross_salary: "18500", purpose: "loan" });
  });
  it("no match returns null", () => {
    expect(run("hello there")).toBeNull();
  });
  it("Ethiopian date without year uses the current Ethiopian year", () => {
    expect(extractDates("ጥር 5", TODAY)).toEqual(["2027-01-13"]);
  });
});
