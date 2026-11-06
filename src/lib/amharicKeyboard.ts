/**
 * Phonetic Amharic keyboard: type Amharic sounds with English letters.
 *
 *   consonant + vowel = one Ethiopic letter
 *   e → 1st form (ለ)  u → ሉ  i → ሊ  a → ላ  ie / E → ሌ  (no vowel) → ል  o → ሎ  ua → ሏ
 *   selam → ሰላም · abebe kebede → አበበ ከበደ · demewez → ደመወዝ
 *
 * Same-sounding letters (ሀ/ሐ/ኀ, ሰ/ሠ, አ/ዐ, ጸ/ፀ) get the common one;
 * `alternativesFor` lists the others for the picker popup.
 */

/** Latin key(s) → first codepoint of the Ethiopic series (the "ä" form). */
const CONSONANTS: Record<string, number> = {
  h: 0x1200, // ሀ
  l: 0x1208, // ለ
  H: 0x1210, // ሐ
  m: 0x1218, // መ
  r: 0x1228, // ረ
  s: 0x1230, // ሰ
  sh: 0x1238, // ሸ
  q: 0x1240, // ቀ
  b: 0x1260, // በ
  v: 0x1268, // ቨ
  t: 0x1270, // ተ
  ch: 0x1278, // ቸ
  n: 0x1290, // ነ
  ny: 0x1298, // ኘ
  k: 0x12a8, // ከ
  kh: 0x12b8, // ኸ
  w: 0x12c8, // ወ
  z: 0x12d8, // ዘ
  zh: 0x12e0, // ዠ
  y: 0x12e8, // የ
  d: 0x12f0, // ደ
  j: 0x1300, // ጀ
  g: 0x1308, // ገ
  T: 0x1320, // ጠ
  C: 0x1328, // ጨ
  P: 0x1330, // ጰ
  ts: 0x1338, // ጸ
  f: 0x1348, // ፈ
  p: 0x1350, // ፐ
};
const GLOTTAL = 0x12a0; // አ

/** Vowel typed → form offset inside a series. */
const VOWELS: Record<string, number> = { e: 0, u: 1, i: 2, a: 3, ie: 4, E: 4, "": 5, o: 6 };

/** Vowels typed on their own (no consonant before them). */
const STANDALONE: Record<string, string> = {
  a: "አ",
  e: "እ",
  i: "ኢ",
  u: "ኡ",
  o: "ኦ",
  ie: "ኤ",
  E: "ኤ",
  aa: "ኣ",
};

/** "ua" → the labialized "wa" form (ሏ, ቧ …). Most series keep it at offset 7. */
const LABIAL_SPECIAL: Record<string, number> = { q: 0x124b, k: 0x12b3, g: 0x1313 };
const LABIAL_AT_7 = new Set([
  "l",
  "H",
  "m",
  "r",
  "s",
  "sh",
  "b",
  "v",
  "t",
  "ch",
  "n",
  "ny",
  "z",
  "zh",
  "d",
  "j",
  "T",
  "C",
  "P",
  "ts",
  "f",
  "p",
]);

/** Keys that start a two-letter consonant but mean nothing alone. */
const PENDING_ONLY = new Set(["c"]);

const CONSONANT_KEYS = Object.keys(CONSONANTS).sort((a, b) => b.length - a.length);

/** Letters with no special capital meaning are treated as lowercase. */
function normalizeCase(latin: string) {
  return latin.replace(/[A-Z]/g, (ch) =>
    ["H", "T", "C", "P", "E"].includes(ch) ? ch : ch.toLowerCase(),
  );
}

/**
 * Render one syllable's Latin keys. Returns the text to show, or null if the
 * keys can't be one syllable (the caller then starts a new syllable).
 */
export function renderSyllable(rawLatin: string): string | null {
  const latin = normalizeCase(rawLatin);
  if (!latin) return null;
  if (PENDING_ONLY.has(latin)) return latin; // e.g. "c" waiting for "h"
  const cons = CONSONANT_KEYS.find((k) => latin.startsWith(k));
  if (!cons) return STANDALONE[latin] ?? null;
  const vowel = latin.slice(cons.length);
  const base = CONSONANTS[cons]!;
  if (vowel === "ua") {
    if (LABIAL_SPECIAL[cons]) return String.fromCodePoint(LABIAL_SPECIAL[cons]);
    return LABIAL_AT_7.has(cons) ? String.fromCodePoint(base + 7) : null;
  }
  if (vowel === "u" || vowel === "i" || vowel in VOWELS) {
    const off = VOWELS[vowel];
    return off === undefined ? null : String.fromCodePoint(base + off);
  }
  return null;
}

/**
 * People double letters for stressed sounds (Addis, Abbebe, birr) but Amharic
 * writes them once: a repeated consonant on a vowel-less letter is ignored.
 */
export function isGemination(buf: string, key: string) {
  const b = normalizeCase(buf);
  return b.length > 0 && b in CONSONANTS && normalizeCase(key) === b.slice(-1) && b.length === 1;
}

/** A Latin key this keyboard handles (letters and the ' separator). */
export function isLatinKey(key: string) {
  return /^[a-zA-Z']$/.test(key);
}

/** Convert a whole Latin string at once (used by tests and the help card). */
export function transliterate(text: string): string {
  let out = "";
  let buf = "";
  let shown = "";
  const flush = () => {
    out += shown;
    buf = "";
    shown = "";
  };
  for (const ch of text) {
    if (ch === "'") {
      flush(); // ' just separates: "le'a" → ለአ
      continue;
    }
    if (!isLatinKey(ch)) {
      flush();
      out += ch;
      continue;
    }
    if (isGemination(buf, ch)) continue;
    const cand = buf + ch;
    const r = renderSyllable(cand);
    if (r !== null) {
      buf = cand;
      shown = r;
    } else {
      flush();
      const r2 = renderSyllable(ch);
      buf = r2 !== null ? ch : "";
      shown = r2 ?? ch;
      if (r2 === null) flush();
    }
  }
  flush();
  return out;
}

// ---- same-sounding letters ----------------------------------------------------------

const ALT_GROUPS: number[][] = [
  [0x1200, 0x1210, 0x1280], // ሀ ሐ ኀ
  [0x1230, 0x1220], // ሰ ሠ
  [0x12a0, 0x12d0], // አ ዐ
  [0x1338, 0x1340], // ጸ ፀ
];

/** For a letter like "ሀ", the same sound in the other spellings: ["ሀ","ሐ","ኀ"]. Empty if none. */
export function alternativesFor(ch: string): string[] {
  const cp = ch.codePointAt(0);
  if (cp === undefined || [...ch].length !== 1) return [];
  for (const group of ALT_GROUPS) {
    for (const base of group) {
      const off = cp - base;
      if (off >= 0 && off < 8) {
        return group
          .map((b) => String.fromCodePoint(b + off))
          .filter((c) => /\p{Script=Ethiopic}/u.test(c));
      }
    }
  }
  return [];
}

/** Rows for the help card. */
export const HELP_ROWS: { keys: string; letters: string }[] = [
  { keys: "br · sra · lmd  (no vowel = 6th form)", letters: "ብር · ስራ · ልምድ" },
  { keys: "le lu li la lie l lo", letters: "ለ ሉ ሊ ላ ሌ ል ሎ" },
  { keys: "be bu bi ba bie b bo", letters: "በ ቡ ቢ ባ ቤ ብ ቦ" },
  { keys: "a e i u o ie", letters: "አ እ ኢ ኡ ኦ ኤ" },
  { keys: "she che nye zhe", letters: "ሸ ቸ ኘ ዠ" },
  { keys: "qe khe tse", letters: "ቀ ኸ ጸ" },
  { keys: "Te Ce Pe He", letters: "ጠ ጨ ጰ ሐ" },
  { keys: "lua bua qua", letters: "ሏ ቧ ቋ" },
  { keys: "selam · abebe · demewez", letters: "ሰላም · አበበ · ደመወዝ" },
];
