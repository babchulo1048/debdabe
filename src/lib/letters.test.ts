import { describe, expect, it } from "vitest";
import {
  fillTemplate,
  formatMoney,
  formatReference,
  usageLevel,
  invoiceTotals,
  docxFileName,
} from "./letters";

describe("letter rules", () => {
  it("formats reference with default pattern", () => {
    expect(
      formatReference("{PREFIX}/{SEQ3}/{ETH_YEAR}", { prefix: "NT", seq: 45, year: 2019 }),
    ).toBe("NT/045/2019");
  });
  it("formats money as 1,234.00", () => {
    expect(formatMoney("1234")).toBe("1,234.00");
  });
  it("inserts dates in Ethiopian format", () => {
    const out = fillTemplate(
      "ከ{{d}} ጀምሮ",
      [{ key: "d", label_am: "ቀን", label_en: "Date", type: "date" }],
      { d: "2026-11-03" },
    );
    expect(out).toBe("ከጥቅምት 24 ቀን 2019 ዓ.ም ጀምሮ");
  });
  it("usage colours: <80% ok, 80-100% near, over limit over", () => {
    expect(usageLevel(10, 30)).toBe("ok");
    expect(usageLevel(24, 30)).toBe("near");
    expect(usageLevel(31, 30)).toBe("over");
    expect(usageLevel(500, null)).toBe("unlimited");
  });
  it("Office invoice: 1,500 + 225 VAT = 1,725", () => {
    expect(invoiceTotals(1500)).toEqual({ amount: 1500, vat: 225, total: 1725 });
  });
  it("docx file name", () => {
    expect(docxFileName(null, "የስብሰባ ጥሪ")).toBe("draft_የስብሰባ-ጥሪ.docx");
  });
});
