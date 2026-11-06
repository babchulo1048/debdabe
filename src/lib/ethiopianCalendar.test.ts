import { describe, expect, it } from "vitest";
import { toEthiopian, toGregorian, formatEthiopian, todayAddisIso } from "./ethiopianCalendar";

const cases: [string, [number, number, number], string?][] = [
  ["2026-11-03", [2019, 2, 24], "ጥቅምት 24 ቀን 2019 ዓ.ም"],
  ["2026-09-11", [2019, 1, 1]],
  ["2026-09-10", [2018, 13, 5]],
  ["2027-09-11", [2019, 13, 6]],
  ["2027-09-12", [2020, 1, 1]],
  ["2026-01-07", [2018, 4, 29]],
];

describe("Ethiopian calendar", () => {
  for (const [iso, [ey, em, ed], fmt] of cases) {
    it(`${iso} -> ${ey}-${em}-${ed}`, () => {
      const [y = 0, m = 0, d = 0] = iso.split("-").map(Number);
      const e = toEthiopian(y, m, d);
      expect(e).toEqual({ year: ey, month: em, day: ed });
      expect(toGregorian(ey, em, ed)).toEqual({ year: y, month: m, day: d });
      if (fmt) expect(formatEthiopian(e)).toBe(fmt);
    });
  }
  it("uses Addis Ababa time zone for today", () => {
    // 22:30 UTC on Nov 2 is already Nov 3 in Addis (UTC+3)
    expect(todayAddisIso(new Date("2026-11-02T22:30:00Z"))).toBe("2026-11-03");
  });
});
