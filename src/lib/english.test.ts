import { describe, expect, it } from "vitest";

import type { LetterContent } from "@/components/LetterSheet";
import type { TemplateRow } from "./data";
import {
  amharicEdited,
  buildEnglish,
  englishItems,
  ethiopianTimeToEnglish,
  formatGregorianLong,
  normalizeAm,
  suggestEnglish,
  transliterate,
} from "./english";
import { asFields } from "./data";
import { fillTemplate } from "./letters";
import { buildSeed } from "./mock/seed";

const templates = buildSeed().tables["templates"] as unknown as TemplateRow[];
const salary = templates.find((x) => x.subject_am === "የደመወዝ ማረጋገጫ ስለመስጠት")!;
const none = new Map<string, string>();
const placeholders = (s: string) =>
  [...s.matchAll(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g)].map((m) => m[1]).sort();

describe("name spelling", () => {
  it.each([
    ["በረከት ዳኛቸው", "Bereket Dagnachew"],
    ["ሄኖክ ገብሬ", "Henok Gebre"],
    ["ብርሃኑ", "Birhanu"],
    ["ደሳለኝ", "Desalegn"],
    ["ሀና ተስፋዬ", "Hana Tesfaye"],
  ])("%s → %s", (am, en) => expect(transliterate(am)).toBe(en));
});

describe("suggestions", () => {
  it("treats spelling variants as the same word", () => {
    expect(normalizeAm("ሠራተኛ")).toBe(normalizeAm("ሰራተኛ"));
    expect(normalizeAm("ኃላፊ")).toBe(normalizeAm("ሃላፊ"));
    expect(normalizeAm("ዓመታዊ")).toBe(normalizeAm("አመታዊ"));
  });

  it("knows titles, banks and positions", () => {
    expect(suggestEnglish("አቶ", "title", none)).toMatchObject({ value: "Mr.", status: "ok" });
    expect(suggestEnglish("Ato", "title", none).value).toBe("Mr.");
    expect(suggestEnglish("ኢትዮጵያ ንግድ ባንክ", "name", none).value).toBe("Commercial Bank of Ethiopia");
    expect(suggestEnglish("የሂሳብ ባለሙያ", "text", none).value).toBe("Accountant");
  });

  it("builds phrases word by word, marked to check", () => {
    expect(suggestEnglish("3 ኮምፒውተሮች እና 1 ፕሪንተር", "text", none)).toEqual({
      value: "3 computers and 1 printer",
      status: "check",
      source: "words",
    });
    expect(suggestEnglish("200 ሪም ወረቀት", "text", none).value).toBe("200 reams of paper");
    expect(suggestEnglish("3ተኛ ፎቅ", "text", none).value).toBe("3rd floor");
  });

  it("never guesses unknown words, but spells unknown names", () => {
    expect(suggestEnglish("በስራ መቅረት", "text", none)).toMatchObject({
      value: "",
      status: "missing",
    });
    expect(suggestEnglish("አስቴር ከበደ", "name", none)).toMatchObject({ status: "check" });
    expect(suggestEnglish("ወ/ሮ አስቴር ከበደ", "name", none).value).toBe("Mrs. Aster Kebede");
  });

  it("uses the company's memory first, and leaves English as it is", () => {
    const mem = new Map([[normalizeAm("ፋይናንስ ክፍል"), "Finance and Budget Department"]]);
    expect(suggestEnglish("ፋይናንስ ክፍል", "text", mem)).toMatchObject({
      value: "Finance and Budget Department",
      source: "memory",
    });
    expect(suggestEnglish("Dawit Alemu", "name", none)).toMatchObject({
      value: "Dawit Alemu",
      source: "same",
    });
  });

  it("converts the Ethiopian clock", () => {
    expect(ethiopianTimeToEnglish("ከጠዋቱ 3 ሰዓት")).toBe("9:00 a.m.");
    expect(ethiopianTimeToEnglish("ከሰአት 8:30")).toBe("2:30 p.m.");
    expect(ethiopianTimeToEnglish("ማታ 2 ሰዓት")).toBe("8:00 p.m.");
    expect(ethiopianTimeToEnglish("10am")).toBeNull();
    expect(formatGregorianLong("2026-11-12")).toBe("12 November 2026");
  });
});

describe("English letter", () => {
  it("every built-in template has English with the same blanks", () => {
    expect(templates).toHaveLength(6);
    for (const t of templates) {
      expect(t.body_en, t.title_en).toBeTruthy();
      expect(placeholders(t.body_en), t.title_en).toEqual(placeholders(t.body_am));
    }
  });

  const values = {
    title: "አቶ",
    employee_name: "በረከት ዳኛቸው",
    position: "የሂሳብ ባለሙያ",
    gross_salary: "23400",
    purpose: "ብድር",
  };
  const content: LetterContent = {
    referenceNo: "REF/001/2019",
    dateIso: "2026-11-12",
    recipient: { name: "ኢትዮጵያ ንግድ ባንክ", city: "አዲስ አበባ" },
    subject: salary.subject_am,
    body: [fillTemplate(salary.body_am, asFields(salary.fields), values)],
    cc: [],
    signatory: null,
    sender: {
      org_name_am: "ናሙና ትሬዲንግ",
      org_name_en: "Namuna Trading PLC",
      tin: "",
      address: "Bole",
      phone: "",
      email: "",
      signer_name: "ሰለሞን ታደሰ",
      signer_position: "ዋና ሥራ አስኪያጅ",
    },
  };

  it("fills the English wording from the same facts", () => {
    const rows = englishItems({ template: salary, values, content });
    const en = Object.fromEntries(
      rows.map((r) => [r.id, suggestEnglish(r.am, r.kind, none, r.preset).value]),
    );
    const out = buildEnglish(content, salary, values, en);
    expect(out.lang).toBe("en");
    expect(out.subject).toBe("Salary Confirmation");
    expect(out.body[0]).toBe(
      "This is to confirm that Mr. Bereket Dagnachew is employed by our company in the position of Accountant, with a gross monthly salary of ETB 23,400.00. This confirmation is issued for the purpose of loan.",
    );
    expect(out.recipient).toEqual({ name: "Commercial Bank of Ethiopia", city: "Addis Ababa" });
    expect(out.sender.org_name_en).toBe("Namuna Trading PLC");
    expect(out.sender.signer_position).toBe("General Manager");
    expect(out.signerNameAm).toBe("ሰለሞን ታደሰ");
  });

  it("an empty English fact shows a blank, not a guess", () => {
    const out = buildEnglish(content, salary, values, {});
    expect(out.body[0]).toContain("[Employee name]");
  });

  it("notices when the Amharic text was rewritten", () => {
    expect(amharicEdited(content, salary, values)).toBe(false);
    expect(amharicEdited({ ...content, body: ["ሌላ ጽሑፍ"] }, salary, values)).toBe(true);
  });
});
