/**
 * "Describe your letter" engine, version 0 (rules, no model).
 *
 * Splits the job the way Path 2 decided:
 *   1. understand the request: pick a template and extract the facts
 *   2. the template writes the formal Amharic
 * The facts only ever come from the user's text, so nothing is invented.
 * Every request + result is logged to ai_generations; that log becomes the
 * training set for the small extraction model later.
 */
import { isoToEthYear, toGregorian, todayAddisIso } from "@/lib/ethiopianCalendar";
import type { Recipient, TemplateField } from "@/lib/letters";

export type TemplateLike = {
  id: string;
  title_am: string;
  title_en: string;
  subject_am: string;
  category: string;
  fields: TemplateField[];
};
export type ContactLike = { name: string; title: string | null; city: string | null; type: string };

export type Understanding<T extends TemplateLike = TemplateLike> = {
  template: T;
  score: number;
  values: Record<string, string>;
  recipient: Recipient | null;
  found: TemplateField[];
  missing: TemplateField[];
};

// ---- template detection ----------------------------------------------------------------

/** Keyword rules for the built-in templates (by id). Higher weight wins. */
/** `boost` rules only add to a template that a main rule already matched. */
const RULES: Record<string, { words: RegExp; weight: number; boost?: true }[]> = {
  // work experience
  "00000000-0000-0000-0000-0000000007e1": [
    { words: /(የ?ሥራ|የ?ስራ)\s*ልምድ|experience|ልምድ\s*ማረጋገጫ/i, weight: 10 },
  ],
  // salary confirmation
  "00000000-0000-0000-0000-0000000007e2": [
    { words: /ደመወዝ|ደሞዝ|salary/i, weight: 6 },
    { words: /ባንክ|bank|ብድር|loan/i, weight: 2, boost: true },
  ],
  // meeting invitation
  "00000000-0000-0000-0000-0000000007e3": [{ words: /ስብሰባ|meeting|ውይይት/i, weight: 8 }],
  // annual leave
  "00000000-0000-0000-0000-0000000007e4": [
    { words: /ፈቃድ|ፍቃድ|ዕረፍት|እረፍት|leave|vacation/i, weight: 8 },
  ],
  // request for quotation
  "00000000-0000-0000-0000-0000000007e5": [
    { words: /ዋጋ\s*ማቅረቢያ|quotation|proforma|ፕሮፎርማ|ለመግዛት|to buy|purchase/i, weight: 8 },
  ],
  // payment request
  "00000000-0000-0000-0000-0000000007e6": [
    { words: /ክፍያ|ያልተከፈለ|payment|unpaid|overdue/i, weight: 7 },
    { words: /ደረሰኝ|invoice/i, weight: 2, boost: true },
  ],
};

const STOP = new Set([
  "የ",
  "ስለ",
  "ስለመስጠት",
  "ስለመጠየቅ",
  "and",
  "for",
  "the",
  "a",
  "of",
  "request",
  "letter",
]);

/** Fallback for custom templates: overlap between request words and the template's titles. */
function overlapScore(text: string, t: TemplateLike) {
  const words = `${t.title_am} ${t.title_en} ${t.subject_am}`
    .toLowerCase()
    .split(/[\s፣,።/()]+/)
    .filter((w) => w.length > 2 && !STOP.has(w));
  const lower = text.toLowerCase();
  return words.reduce((s, w) => s + (lower.includes(w) ? 2 : 0), 0);
}

export function rankTemplates<T extends TemplateLike>(text: string, templates: T[]) {
  return templates
    .map((t) => {
      const rules = RULES[t.id];
      if (!rules) return { template: t, score: overlapScore(text, t) }; // custom templates
      const main = rules.filter((r) => !r.boost && r.words.test(text));
      if (main.length === 0) return { template: t, score: 0 };
      const boost = rules.filter((r) => r.boost && r.words.test(text));
      return { template: t, score: [...main, ...boost].reduce((s, r) => s + r.weight, 0) };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);
}

// ---- fact extraction ----------------------------------------------------------------------

const W = "[^\\s፣,።፤:]+"; // one word

/** Month spellings people actually type (ህዳር/ኅዳር, ታህሳስ/ታኅሣሥ …). Index = month number − 1. */
const MONTH_ALIASES: string[][] = [
  ["መስከረም"],
  ["ጥቅምት"],
  ["ኅዳር", "ህዳር", "ሕዳር"],
  ["ታኅሣሥ", "ታህሳስ", "ታሕሳስ", "ታህሣሥ"],
  ["ጥር"],
  ["የካቲት"],
  ["መጋቢት"],
  ["ሚያዝያ", "ሚያዚያ"],
  ["ግንቦት"],
  ["ሰኔ"],
  ["ሐምሌ", "ሀምሌ"],
  ["ነሐሴ", "ነሃሴ", "ነሀሴ"],
  ["ጳጉሜን", "ጳጉሜ"],
];
const monthIndex = new Map<string, number>();
MONTH_ALIASES.forEach((names, i) => names.forEach((n) => monthIndex.set(n, i + 1)));
const MONTH_RE = MONTH_ALIASES.flat()
  .sort((a, b) => b.length - a.length)
  .join("|");

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/** Ethiopian dates ("ህዳር 10 ቀን 2019 ዓ.ም", "ጥር 5") and ISO dates, in order of appearance. */
export function extractDates(text: string, today = todayAddisIso()): string[] {
  const found: { at: number; iso: string }[] = [];
  const thisEthYear = isoToEthYear(today);

  const eth = new RegExp(`(${MONTH_RE})\\s*(\\d{1,2})(?:\\s*ቀን)?(?:\\s*(\\d{4}))?`, "g");
  for (const m of text.matchAll(eth)) {
    const month = monthIndex.get(m[1] ?? "") ?? 0;
    const day = Number(m[2]);
    const year = m[3] ? Number(m[3]) : thisEthYear;
    if (!month || day < 1 || day > 30) continue;
    const g = toGregorian(year, month, day);
    found.push({ at: m.index ?? 0, iso: `${g.year}-${pad(g.month)}-${pad(g.day)}` });
  }
  for (const m of text.matchAll(/\b(\d{4})-(\d{2})-(\d{2})\b/g))
    found.push({ at: m.index ?? 0, iso: m[0] });

  return found.sort((a, b) => a.at - b.at).map((f) => f.iso);
}

export function extractMoney(text: string): string | null {
  const m =
    text.match(/(?:ብር|birr|ETB)\s*(\d[\d,]*(?:\.\d+)?)/i) ??
    text.match(/(\d[\d,]*(?:\.\d+)?)\s*(?:ብር|birr|ETB)/i);
  return m?.[1] ? m[1].replace(/,/g, "") : null;
}

const TITLES: [RegExp, string][] = [
  [/^(አቶ|ato|mr\.?)$/i, "አቶ"],
  [/^(ወ\/ሮ|ወይዘሮ|w\/ro|mrs\.?)$/i, "ወ/ሮ"],
  [/^(ወ\/ሪት|ወይዘሪት|w\/rt|ms\.?|miss)$/i, "ወ/ሪት"],
  [/^(ዶ\/ር|ዶክተር|dr\.?)$/i, "ዶ/ር"],
];

export function extractPerson(text: string): { title: string; name: string } | null {
  const re = new RegExp(
    `(አቶ|ወ/ሮ|ወይዘሮ|ወ/ሪት|ወይዘሪት|ዶ/ር|ዶክተር|Ato|Mr\\.?|Mrs\\.?|Ms\\.?|Dr\\.?|W/ro|W/rt)\\s+(${W})(?:\\s+(${W}))?`,
    "i",
  );
  const m = text.match(re);
  if (!m?.[1] || !m[2]) return null;
  const title = TITLES.find(([r]) => r.test(m[1] ?? ""))?.[1] ?? m[1];
  // Second word is a surname only if it isn't a grammatical word that follows names.
  // (Names can start with ከ/በ/ለ — ከበደ, በላይ, ለማ — so only known non-name words are rejected.)
  const notName = new RegExp(
    `^(ወርሃዊ|ደመወዝ|ደሞዝ|ድርጅ|በድርጅ|ከ(?:${MONTH_RE})|ለ\\d|who|is|has|from|for|works|was|in|at)`,
    "i",
  );
  const second = m[3] && !notName.test(m[3]) ? m[3] : "";
  return { title, name: [m[2], second].filter(Boolean).join(" ") };
}

function first(text: string, patterns: RegExp[]): string | null {
  for (const p of patterns) {
    const v = text.match(p)?.[1]?.trim();
    if (v) return v;
  }
  return null;
}

export function extractRecipient(text: string, contacts: ContactLike[]): Recipient | null {
  // Saved contacts first ("ለኢትዮጵያ ንግድ ባንክ" matches "የኢትዮጵያ ንግድ ባንክ").
  for (const c of contacts.filter((x) => x.type === "recipient")) {
    const core = c.name.replace(/^የ/, "");
    if (core.length > 2 && text.includes(core))
      return { name: c.name, title: c.title ?? "", city: c.city ?? "" };
  }
  const fixed = text.match(/ለ(ሚመለከተው\s+ሁሉ|ሁሉም\s+(?:የ\S+\s+)?\S+)/);
  if (fixed?.[1]) return { name: fixed[1], title: "", city: "" };
  const lead = text.match(new RegExp(`^\\s*ለ((?:${W}\\s+){0,5}${W})\\s*[፣,]`));
  if (lead?.[1]) return { name: lead[1], title: "", city: "" };
  const en = text.match(/\bto\s+(?:the\s+)?([A-Z][\w.&-]*(?:\s+[A-Z][\w.&-]*){0,5})/);
  if (en?.[1]) return { name: en[1], title: "", city: "" };
  return null;
}

/** Facts for each known field key. Unknown keys fall back to their type. */
function extractField(
  f: TemplateField,
  text: string,
  ctx: {
    person: ReturnType<typeof extractPerson>;
    dates: string[];
    dateCursor: { i: number };
    hasTitleField: boolean;
  },
): string | null {
  const { person } = ctx;
  switch (f.key) {
    case "title":
      return person?.title ?? null;
    case "employee_name":
      return person ? (ctx.hasTitleField ? person.name : `${person.title} ${person.name}`) : null;
    case "position":
      return first(text, [
        new RegExp(`በ((?:${W}\\s+)?${W})\\s+(?:የሥራ|የስራ)\\s+መደብ`),
        new RegExp(`በ((?:${W}\\s+)?${W}?)ነት(?=[\\s፣,።]|$)`),
        /(?:position|as an?|as the)\s+([a-z][\w ]{2,30}?)(?=[,.]|$| for| in| with)/i,
      ]);
    case "department":
      return first(text, [new RegExp(`በ(${W})\\s+ክፍል`), /(\w+)\s+department/i]);
    case "purpose":
      return first(text, [
        new RegExp(`ለ(${W}(?:\\s+${W})?)\\s+(?:አገልግሎት|ዓላማ|እንዲያገለግል)`),
        /for\s+(?:a\s+)?(loan|visa|account opening|[a-z]+ application)/i,
      ]);
    case "meeting_time": {
      const m = text.match(/((?:ከጠዋቱ|ከቀኑ|ከሰዓት\s+በኋላ|ከምሽቱ)\s*)?(\d{1,2}[:፡]\d{2})/);
      return m ? `${m[1] ?? ""}${m[2]}`.trim() : null;
    }
    case "venue":
      return first(text, [
        new RegExp(`በ((?:${W}\\s+){0,2}(?:አዳራሽ|መሰብሰቢያ${W}?|ቢሮ))`),
        /\bin\s+(?:the\s+)?([\w ]{2,30}?(?:hall|room|office))/i,
      ]);
    case "meeting_topic":
      return first(text, [
        new RegExp(`((?:${W}\\s+){0,5}${W}?)ን?\\s+(?:አስመልክቶ|በተመለከተ)`),
        new RegExp(`ስለ((?:${W}\\s+){0,4}${W})\\s+(?:ለመወያየት|ስብሰባ)`),
        /(?:about|on|regarding)\s+([\w ]{3,40}?)(?=[,.]|$| on | at )/i,
      ]);
    case "items":
      return first(text, [
        new RegExp(`(?:ድርጅታችን\\s+)?((?:${W}\\s+){0,4}${W})\\s+ለመግዛት`),
        /(?:to buy|purchase|for)\s+([\w ]{3,40}?)(?=[,.]|$| by | before )/i,
      ]);
    case "invoice_number":
      return first(text, [
        /(?:ደረሰኝ|invoice)\s*(?:ቁጥር|no\.?|number|#)?\s*([A-Za-z0-9/-]*\d[A-Za-z0-9/-]*)/i,
      ]);
    case "days": {
      const d = first(text, [
        /ለ?(\d{1,3})\s*(?:ቀናት|የሥራ\s+ቀናት)/,
        /(\d{1,3})\s*(?:working\s+)?days/i,
      ]);
      return d;
    }
  }
  switch (f.type) {
    case "money":
      return extractMoney(text);
    case "date": {
      const v = ctx.dates[ctx.dateCursor.i];
      if (v) ctx.dateCursor.i += 1;
      return v ?? null;
    }
    default:
      return null;
  }
}

function inclusiveDays(fromIso: string, toIso: string) {
  const ms = Date.parse(toIso) - Date.parse(fromIso);
  return Number.isFinite(ms) && ms >= 0 ? String(Math.round(ms / 86_400_000) + 1) : null;
}

/** Pull the facts for one given template out of the request. */
export function understandWith<T extends TemplateLike>(
  text: string,
  template: T,
  contacts: ContactLike[] = [],
  today = todayAddisIso(),
  score = 0,
): Understanding<T> {
  const ctx = {
    person: extractPerson(text),
    dates: extractDates(text, today),
    dateCursor: { i: 0 },
    hasTitleField: template.fields.some((f) => f.key === "title"),
  };
  const values: Record<string, string> = {};
  for (const f of template.fields) {
    const v = extractField(f, text, ctx);
    if (v) values[f.key] = v;
  }
  const from = values["from_date"];
  const to = values["to_date"];
  if (!values["days"] && from && to && template.fields.some((f) => f.key === "days")) {
    const d = inclusiveDays(from, to);
    if (d) values["days"] = d;
  }
  return {
    template,
    score,
    values,
    recipient: extractRecipient(text, contacts),
    found: template.fields.filter((f) => values[f.key]),
    missing: template.fields.filter((f) => !values[f.key]),
  };
}

/** Pick the best template and pull the facts out of the request. */
export function understandRequest<T extends TemplateLike>(
  text: string,
  templates: T[],
  contacts: ContactLike[] = [],
  today = todayAddisIso(),
): Understanding<T> | null {
  const best = rankTemplates(text, templates)[0];
  return best ? understandWith(text, best.template, contacts, today, best.score) : null;
}
