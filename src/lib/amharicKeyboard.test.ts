import { describe, expect, it } from "vitest";

import { alternativesFor, renderSyllable, transliterate } from "./amharicKeyboard";

describe("transliterate", () => {
  it.each([
    ["selam", "ሰላም"],
    ["abebe kebede", "አበበ ከበደ"],
    ["demewez", "ደመወዝ"],
    ["ato", "አቶ"],
    ["addis abeba", "አዲስ አበባ"], // doubled d = one letter
    ["yesra lmd maregageCa", "የስራ ልምድ ማረጋገጫ"],
    ["br", "ብር"],
    ["birr", "ቢር"],
    ["shume", "ሹመ"],
    ["chewa", "ቸዋ"],
    ["Tena", "ጠና"],
    ["Cama", "ጫማ"],
    ["tsehey", "ጸሀይ"],
    ["enat", "እናት"],
    ["lie", "ሌ"],
    ["bua", "ቧ"],
    ["qua", "ቋ"],
    ["ityopya", "ኢትዮፕያ"],
  ])("%s → %s", (latin, amharic) => {
    expect(transliterate(latin)).toBe(amharic);
  });

  it("keeps numbers and punctuation", () => {
    expect(transliterate("le 3:00, 25000")).toBe("ለ 3:00, 25000");
  });
  it("' separates syllables", () => {
    expect(transliterate("le'a")).toBe("ለአ");
  });
  it("capitals without special meaning act like lowercase", () => {
    expect(transliterate("Abebe")).toBe("አበበ");
  });
});

describe("renderSyllable (what you see while typing)", () => {
  it("updates the same letter as keys arrive", () => {
    expect(renderSyllable("s")).toBe("ስ");
    expect(renderSyllable("se")).toBe("ሰ");
    expect(renderSyllable("sh")).toBe("ሽ");
    expect(renderSyllable("c")).toBe("c"); // waits for h
    expect(renderSyllable("ch")).toBe("ች");
    expect(renderSyllable("sel")).toBeNull(); // a new letter starts
  });
});

describe("alternativesFor", () => {
  it("lists same-sounding letters in the same form", () => {
    expect(alternativesFor("ሀ")).toEqual(["ሀ", "ሐ", "ኀ"]);
    expect(alternativesFor("ሳ")).toEqual(["ሳ", "ሣ"]);
    expect(alternativesFor("ሐ")).toEqual(["ሀ", "ሐ", "ኀ"]);
    expect(alternativesFor("አ")).toEqual(["አ", "ዐ"]);
    expect(alternativesFor("ጽ")).toEqual(["ጽ", "ፅ"]);
    expect(alternativesFor("ለ")).toEqual([]);
  });
});
