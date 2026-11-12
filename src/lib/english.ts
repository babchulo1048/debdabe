/**
 * English version of a template letter, without AI.
 *
 * The template's English wording is written by a person. Dates, amounts and numbers convert
 * automatically. Each text fact (name, position, bank…) gets an English suggestion that comes
 * from the company's memory, our word list, or name spelling. A fact we can't translate stays
 * empty for the user to fill. We never guess.
 */
import type { LetterContent } from "@/components/LetterSheet";
import type { Signatory, TemplateRow } from "./data";
import { asFields } from "./data";
import { WORDS } from "./englishWords";
import { parseIso } from "./ethiopianCalendar";
import { fillTemplate, formatMoney, type TemplateField } from "./letters";

// ---- Ethiopic script helpers -------------------------------------------------------

const FIRST = 0x1200;
const LAST = 0x135a;
const isEthiopicLetter = (ch: string | undefined) => {
  const cp = ch?.codePointAt(0) ?? 0;
  return cp >= FIRST && cp <= LAST;
};
export const hasEthiopic = (s: string) => /[ሀ-፿]/.test(s);

const PUNCT: Record<string, string> = {
  "፡": " ",
  "።": ".",
  "፣": ",",
  "፤": ";",
  "፥": ":",
  "፦": ":",
  "፧": "?",
};

/** Row start → Latin consonant. Rows are 8 code points: the 7 vowel orders plus "-wa". */
// prettier-ignore
const CONSONANT: Record<number, string> = {
  0x1200: "h", 0x1208: "l", 0x1210: "h", 0x1218: "m", 0x1220: "s", 0x1228: "r",
  0x1230: "s", 0x1238: "sh", 0x1240: "k", 0x1248: "k", 0x1250: "k", 0x1258: "k",
  0x1260: "b", 0x1268: "v", 0x1270: "t", 0x1278: "ch", 0x1280: "h", 0x1288: "h",
  0x1290: "n", 0x1298: "gn", 0x12a0: "", 0x12a8: "k", 0x12b0: "k", 0x12b8: "h",
  0x12c0: "k", 0x12c8: "w", 0x12d0: "", 0x12d8: "z", 0x12e0: "zh", 0x12e8: "y",
  0x12f0: "d", 0x12f8: "d", 0x1300: "j", 0x1308: "g", 0x1310: "g", 0x1318: "g",
  0x1320: "t", 0x1328: "ch", 0x1330: "p", 0x1338: "ts", 0x1340: "ts", 0x1348: "f",
  0x1350: "p",
};
const VOWELS = ["e", "u", "i", "a", "e", "", "o", "wa"];
/** Rows whose first form sounds "a" (ሀ, ሐ, ኀ, አ, ዐ). */
const A_ROWS = new Set([0x1200, 0x1210, 0x1280, 0x12a0, 0x12d0]);
/** Labialized rows (ቈ, ኈ, ኰ, ዀ, ጐ…) use a different layout. */
const LABIAL_ROWS = new Set([0x1248, 0x1258, 0x1288, 0x12b0, 0x12c0, 0x1310]);
const LABIAL = ["we", "", "wi", "wa", "we", "w", "", ""];
/** Letters that sound the same are written several ways; match them as one. */
const SAME_ROW: Record<number, number> = {
  0x1210: 0x1200,
  0x1280: 0x1200,
  0x1220: 0x1230,
  0x12d0: 0x12a0,
  0x1340: 0x1338,
};

function split(cp: number) {
  const order = (cp - FIRST) % 8;
  return { row: cp - order, order };
}

/** Suggested Latin spelling of an Amharic name, e.g. በረከት ዳኛቸው → Bereket Dagnachew. */
export function transliterate(s: string): string {
  const chars = [...s];
  let out = "";
  chars.forEach((ch, i) => {
    if (PUNCT[ch] != null) {
      out += PUNCT[ch];
      return;
    }
    const cp = ch.codePointAt(0) ?? 0;
    if (cp < FIRST || cp > 0x1357) {
      out += ch;
      return;
    }
    const { row, order } = split(cp);
    const c = CONSONANT[row];
    if (c == null) return;
    if (LABIAL_ROWS.has(row)) {
      out += c + (LABIAL[order] ?? "");
      return;
    }
    if (order === 5) {
      // The 6th form has no vowel, or a short "i" between consonants.
      if (c === "") {
        out += /[a-z]$/i.test(out) ? "" : "e";
        return;
      }
      const wordEnd = !isEthiopicLetter(chars[i + 1]);
      const afterVowel = /[aeiou]$/i.test(out);
      out += c + (wordEnd || afterVowel ? "" : "i");
      return;
    }
    if (row === 0x12a0 && order === 7) {
      out += "e";
      return;
    }
    out += c + (order === 0 && A_ROWS.has(row) ? "a" : (VOWELS[order] ?? ""));
  });
  return out
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** Same key for spelling variants: ሐ/ኀ→ሀ, ሠ→ሰ, ዐ→አ, ፀ→ጸ, ሃ→ሀ, ኣ→አ, punctuation dropped. */
export function normalizeAm(s: string): string {
  let out = "";
  for (const ch of s.trim().toLowerCase()) {
    if (PUNCT[ch] != null) {
      out += " ";
      continue;
    }
    const cp = ch.codePointAt(0) ?? 0;
    if (cp >= FIRST && cp <= 0x1357) {
      const s0 = split(cp);
      const row = SAME_ROW[s0.row] ?? s0.row;
      const order = (row === 0x1200 || row === 0x12a0) && s0.order === 3 ? 0 : s0.order;
      out += String.fromCodePoint(row + order);
      continue;
    }
    out += ch;
  }
  return out
    .replace(/[.,;:!?"'()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const DICT = new Map(WORDS.map(([am, en]) => [normalizeAm(am), en]));

/** "3ተኛ" → "3rd". */
function ordinal(token: string): string | null {
  const m = token.match(/^(\d+)(ተኛው|ኛው|ተኛ|ኛ)$/);
  if (!m) return null;
  const n = Number(m[1]);
  const end = n % 100 >= 11 && n % 100 <= 13 ? "th" : (["th", "st", "nd", "rd"][n % 10] ?? "th");
  return `${n}${end}`;
}

/** Remove a leading ለ/በ/ከ ("for/at/from") so the word itself can be found. */
function stripPrefix(token: string): string {
  const rest = token.slice(1);
  return /^[ለበከ]/.test(token) && rest ? rest : token;
}

/** Word by word, longest phrase first. Null if any Amharic word is unknown. */
export function translateWords(text: string): string | null {
  const original = text
    .trim()
    .split(/[\s፡]+/)
    .filter(Boolean);
  const norm = original.map(normalizeAm);
  const out: string[] = [];
  let i = 0;
  while (i < norm.length) {
    let matched = false;
    for (let len = Math.min(4, norm.length - i); len >= 1 && !matched; len--) {
      const phrase = norm.slice(i, i + len).join(" ");
      const hit = DICT.get(phrase) ?? DICT.get(stripPrefix(phrase));
      if (hit) {
        out.push(hit);
        i += len;
        matched = true;
      }
    }
    if (matched) continue;
    const tok = original[i] ?? "";
    const plain = stripPrefix(tok);
    const ord = ordinal(tok) ?? ordinal(plain);
    if (ord) out.push(ord);
    else if (!hasEthiopic(plain)) out.push(plain);
    else return null;
    i++;
  }
  return out.join(" ");
}

/** Ethiopian clock (day starts at 6 a.m.) to the usual clock: ጠዋት 3 ሰዓት → 9:00 a.m. */
export function ethiopianTimeToEnglish(text: string): string | null {
  if (!hasEthiopic(text)) return null;
  const m = text.match(/(\d{1,2})(?:[:.](\d{2}))?/);
  if (!m) return null;
  const n = Number(m[1]);
  if (n < 1 || n > 12) return null;
  const s = normalizeAm(text);
  const evening = /ማታ|ምሽት|ሌሊት|ለሊት/.test(s) && !/ጠዋት/.test(s);
  const h = (n + (evening ? 18 : 6)) % 24;
  const h12 = h % 12 || 12;
  return `${h12}:${m[2] ?? "00"} ${h < 12 ? "a.m." : "p.m."}`;
}

// prettier-ignore
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** "2026-11-12" → "12 November 2026". */
export function formatGregorianLong(iso: string): string {
  const { y, m, d } = parseIso(iso);
  if (!y || !m || !d) return iso;
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

// ---- Suggestions ------------------------------------------------------------------

export type Kind = "title" | "name" | "time" | "text";
export type Status = "ok" | "check" | "missing";
export type Source =
  "empty" | "memory" | "settings" | "same" | "dictionary" | "words" | "time" | "spelling" | "none";
export type Suggestion = { value: string; status: Status; source: Source };

/** Memory: normalized Amharic → the company's saved English. */
export type Memory = Map<string, string>;

export function suggestEnglish(
  am: string,
  kind: Kind,
  memory: Memory,
  preset?: string | null,
): Suggestion {
  const text = am.trim();
  if (!text) return { value: "", status: "ok", source: "empty" };
  const key = normalizeAm(text);
  const saved = memory.get(key);
  if (saved) return { value: saved, status: "ok", source: "memory" };
  if (preset?.trim()) return { value: preset.trim(), status: "ok", source: "settings" };
  const known = DICT.get(key) ?? DICT.get(normalizeAm(stripPrefix(text)));
  if (kind === "title" && known) return { value: known, status: "ok", source: "dictionary" };
  if (!hasEthiopic(text)) return { value: text, status: "ok", source: "same" };
  if (known) return { value: known, status: "ok", source: "dictionary" };
  if (kind === "time") {
    const t = ethiopianTimeToEnglish(text);
    if (t) return { value: t, status: "check", source: "time" };
  }
  const words = translateWords(text);
  if (words) return { value: words, status: "check", source: "words" };
  if (kind === "name") {
    // "አቶ ሰለሞን ታደሰ" → "Mr. Selemon Tadese": a leading title is translated, the rest spelled.
    const [first = "", ...rest] = text.split(/\s+/);
    const title = rest.length ? DICT.get(normalizeAm(first)) : undefined;
    const isTitle = title && /^(Mr|Mrs|Ms|Dr|Eng|Prof)\.$/.test(title);
    const value = isTitle ? `${title} ${transliterate(rest.join(" "))}` : transliterate(text);
    return { value, status: "check", source: "spelling" };
  }
  return { value: "", status: "missing", source: "none" };
}

// ---- The English letter -----------------------------------------------------------

export type EnglishItem = {
  id: string;
  label_en: string;
  label_am: string;
  am: string;
  kind: Kind;
  preset?: string | null | undefined;
};

export function fieldKind(f: TemplateField): Kind {
  if (f.key === "title") return "title";
  if (/name/i.test(f.key)) return "name";
  if (/time/i.test(f.key)) return "time";
  return "text";
}

/** Everything in the letter that needs an English form, in reading order. */
export function englishItems(o: {
  template: TemplateRow;
  values: Record<string, string>;
  content: LetterContent;
}): EnglishItem[] {
  const { content, values } = o;
  const items: EnglishItem[] = [];
  const add = (item: EnglishItem) => item.am.trim() && items.push(item);

  const r = content.recipient;
  add({ id: "r:name", label_en: "Recipient", label_am: "ተቀባይ", am: r.name ?? "", kind: "name" });
  add({
    id: "r:title",
    label_en: "Recipient title / branch",
    label_am: "የተቀባይ ኃላፊነት",
    am: r.title ?? "",
    kind: "text",
  });
  add({ id: "r:city", label_en: "City", label_am: "ከተማ", am: r.city ?? "", kind: "name" });

  for (const f of asFields(o.template.fields)) {
    if (f.type !== "text") continue;
    add({
      id: `f:${f.key}`,
      label_en: f.label_en || f.key,
      label_am: f.label_am,
      am: values[f.key] ?? "",
      kind: fieldKind(f),
    });
  }

  const snd = content.sender;
  const sig: Signatory | null =
    content.signatory && content.signatory.name_am === snd.signer_name ? content.signatory : null;
  add({
    id: "s:signer",
    label_en: "Signed by",
    label_am: "ፈራሚ",
    am: snd.signer_name,
    kind: "name",
    preset: sig?.name_en,
  });
  add({
    id: "s:position",
    label_en: "Signer's position",
    label_am: "የፈራሚው ኃላፊነት",
    am: snd.signer_position,
    kind: "text",
    preset: sig?.position_en,
  });
  add({
    id: "s:org",
    label_en: "Company name",
    label_am: "የድርጅቱ ስም",
    am: snd.org_name_am,
    kind: "name",
    preset: snd.org_name_en,
  });
  if (hasEthiopic(snd.address))
    add({ id: "s:address", label_en: "Address", label_am: "አድራሻ", am: snd.address, kind: "text" });

  content.cc.forEach((c, i) =>
    add({ id: `cc:${i}`, label_en: `Copy to (${i + 1})`, label_am: "ግልባጭ", am: c, kind: "text" }),
  );
  return items;
}

/** Fill the English wording: dates and money convert; text uses the checked English. */
export function fillEnglish(
  body: string,
  fields: TemplateField[],
  values: Record<string, string>,
  text: (key: string) => string,
): string {
  return body.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) => {
    const f = fields.find((x) => x.key === key);
    const raw = (values[key] ?? "").trim();
    const blank = `[${f?.label_en || key}]`;
    if (!raw) return blank;
    if (f?.type === "date") return formatGregorianLong(raw);
    if (f?.type === "money") return formatMoney(raw);
    if (f?.type === "number") return raw;
    return text(key).trim() || blank;
  });
}

/** The same letter in English, using the checked values (item id → English). */
export function buildEnglish(
  content: LetterContent,
  template: TemplateRow,
  values: Record<string, string>,
  en: Record<string, string>,
): LetterContent {
  const fields = asFields(template.fields);
  const v = (id: string) => (en[id] ?? "").trim();
  const snd = content.sender;
  return {
    ...content,
    lang: "en",
    signerNameAm: snd.signer_name,
    subject: template.subject_en?.trim() || content.subject,
    body: [fillEnglish(template.body_en ?? "", fields, values, (key) => v(`f:${key}`))],
    recipient: {
      ...(content.recipient.name ? { name: v("r:name") } : {}),
      ...(content.recipient.title ? { title: v("r:title") } : {}),
      ...(content.recipient.city ? { city: v("r:city") } : {}),
    },
    cc: content.cc.map((_, i) => v(`cc:${i}`) || "[Copy]"),
    sender: {
      ...snd,
      org_name_en: v("s:org") || snd.org_name_en,
      address: hasEthiopic(snd.address) ? v("s:address") : snd.address,
      signer_name: v("s:signer"),
      signer_position: v("s:position"),
    },
  };
}

/** True if the Amharic letter no longer matches its template (the user rewrote text). */
export function amharicEdited(
  content: Pick<LetterContent, "body" | "subject">,
  template: TemplateRow,
  values: Record<string, string>,
): boolean {
  const expected = fillTemplate(template.body_am, asFields(template.fields), values).trim();
  const actual = content.body
    .filter((p) => p.trim())
    .join("\n\n")
    .trim();
  return actual !== expected || content.subject.trim() !== template.subject_am.trim();
}
