/**
 * "Model" engine for Describe-your-letter: calls the trained model (served from
 * Colab during testing) and turns its raw answers into template field values.
 *
 * The model only marks words the user typed. This file converts them:
 *   "25,000" → 25000 · "Mrs" → ወ/ሮ · "ህዳር 10" / "Dec 15" / "tomorrow" → a date.
 * Anything it can't convert is reported, never guessed.
 */
import { parseIso } from "@/lib/ethiopianCalendar";
import type { Recipient, TemplateField } from "@/lib/letters";
import {
  extractDates,
  type ContactLike,
  type TemplateLike,
  type Understanding,
} from "@/lib/smartRequest";

export type ModelPrediction = {
  intent: string;
  confidence: number;
  facts: Record<string, string>;
  /** Which trained model answered, e.g. "round2" (sent by the serve notebook). */
  model?: string;
};

export type ModelUnderstanding<T extends TemplateLike = TemplateLike> = Understanding<T> & {
  confidence: number;
  rawFacts: Record<string, string>;
  unconverted: { field: TemplateField; raw: string }[];
};

/** Model letter types → the built-in template ids. */
export const INTENT_TEMPLATE: Record<string, string> = {
  work_experience: "00000000-0000-0000-0000-0000000007e1",
  salary_confirmation: "00000000-0000-0000-0000-0000000007e2",
  meeting: "00000000-0000-0000-0000-0000000007e3",
  leave: "00000000-0000-0000-0000-0000000007e4",
  quotation: "00000000-0000-0000-0000-0000000007e5",
  payment: "00000000-0000-0000-0000-0000000007e6",
};

/** Model fact tags → template field keys (first match in the template wins). */
const TAG_FIELDS: Record<string, string[]> = {
  TITLE: ["title"],
  NAME: ["employee_name"],
  POSITION: ["position"],
  AMOUNT: ["gross_salary", "salary", "amount"],
  PURPOSE: ["purpose"],
  START_DATE: ["start_date"],
  FROM_DATE: ["from_date"],
  TO_DATE: ["to_date"],
  DAYS: ["days"],
  MEET_DATE: ["meeting_date"],
  MEET_TIME: ["meeting_time"],
  VENUE: ["venue"],
  TOPIC: ["meeting_topic"],
  ITEMS: ["items"],
  DEADLINE: ["deadline"],
  INVOICE_NO: ["invoice_number"],
  INVOICE_DATE: ["invoice_date"],
  DUE_DATE: ["due_date"],
  DEPARTMENT: ["department"],
};

// ---- small converters ------------------------------------------------------------

/** "on Dec 15" → "Dec 15", "at 10am" → "10am". */
export function cleanEdge(raw: string) {
  return raw
    .trim()
    .replace(/^(on|at|from|by|before|until|since|due|the)\s+/i, "")
    .replace(/[\s,.;:፡።፣-]+$/u, "")
    .trim();
}

const TITLE_MAP: Record<string, string> = {
  አቶ: "አቶ",
  ato: "አቶ",
  mr: "አቶ",
  "mr.": "አቶ",
  "ወ/ሮ": "ወ/ሮ",
  ወይዘሮ: "ወ/ሮ",
  "w/ro": "ወ/ሮ",
  mrs: "ወ/ሮ",
  "mrs.": "ወ/ሮ",
  "ወ/ሪት": "ወ/ሪት",
  ወይዘሪት: "ወ/ሪት",
  "w/rt": "ወ/ሪት",
  ms: "ወ/ሪት",
  "ms.": "ወ/ሪት",
  miss: "ወ/ሪት",
  "ዶ/ር": "ዶ/ር",
  ዶክተር: "ዶ/ር",
  dr: "ዶ/ር",
  "dr.": "ዶ/ር",
};

export function toTitle(raw: string): string | null {
  return TITLE_MAP[raw.trim().toLowerCase()] ?? null;
}

function toNumber(raw: string): string | null {
  const v = raw.replace(/[^\d.]/g, "").replace(/\.0+$/, "");
  return v && Number.isFinite(Number(v)) ? v : null;
}

const EN_MONTHS = [
  "jan",
  "feb",
  "mar",
  "apr",
  "may",
  "jun",
  "jul",
  "aug",
  "sep",
  "oct",
  "nov",
  "dec",
];
const WEEKDAYS: [RegExp, number][] = [
  [/^(sunday|sun|እሁድ|እሑድ)$/i, 0],
  [/^(monday|mon|ሰኞ)$/i, 1],
  [/^(tuesday|tue|ማክሰኞ)$/i, 2],
  [/^(wednesday|wed|ረቡዕ|ረቡእ)$/i, 3],
  [/^(thursday|thu|ሐሙስ|ሀሙስ|ሃሙስ)$/i, 4],
  [/^(friday|fri|አርብ|ዓርብ)$/i, 5],
  [/^(saturday|sat|ቅዳሜ)$/i, 6],
];

function formatIsoDate(y: number, m: number, d: number) {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function addDays(iso: string, n: number) {
  const { y, m, d } = parseIso(iso);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
}

/**
 * Turn whatever date text the model marked into YYYY-MM-DD, or null.
 * Handles Ethiopian dates, ISO, "Dec 15"/"15 Dec", weekdays (next one), today/tomorrow.
 * A bare year or "next week" is not a day, so it stays null (the user picks the day).
 */
export function looseDate(raw: string, today: string): string | null {
  const r = cleanEdge(raw).replace(/^(next|this|የሚቀጥለው)\s+/i, "");
  const eth = extractDates(r, today)[0];
  if (eth) return eth;
  if (/^(today|ዛሬ)$/i.test(r)) return today;
  if (/^(tomorrow|ነገ)$/i.test(r)) return addDays(today, 1);
  for (const [re, wd] of WEEKDAYS) {
    if (re.test(r)) {
      const { y, m, d } = parseIso(today);
      const now = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
      return addDays(today, (wd - now + 7) % 7 || 7);
    }
  }
  const en =
    r.match(/^([a-z]{3,9})\.?\s+(\d{1,2})(?:,?\s+(\d{4}))?$/i) ??
    r.match(/^(\d{1,2})\s+([a-z]{3,9})\.?(?:,?\s+(\d{4}))?$/i);
  if (en) {
    const [monthText, dayText] = /^\d/.test(en[1] ?? "") ? [en[2], en[1]] : [en[1], en[2]];
    const mi = EN_MONTHS.indexOf((monthText ?? "").slice(0, 3).toLowerCase());
    const day = Number(dayText);
    if (mi >= 0 && day >= 1 && day <= 31) {
      const year = en[3] ? Number(en[3]) : parseIso(today).y;
      return formatIsoDate(year, mi + 1, day);
    }
  }
  return null;
}

function inclusiveDays(fromIso: string, toIso: string) {
  const ms = Date.parse(toIso) - Date.parse(fromIso);
  return Number.isFinite(ms) && ms >= 0 ? String(Math.round(ms / 86_400_000) + 1) : null;
}

function matchRecipient(raw: string, contacts: ContactLike[]): Recipient {
  const name = cleanEdge(raw);
  const norm = (s: string) => s.replace(/^የ/, "").replace(/\s+/g, " ").trim().toLowerCase();
  const n = norm(name);
  for (const c of contacts.filter((x) => x.type === "recipient")) {
    const core = norm(c.name);
    if (core.length > 2 && (core.includes(n) || n.includes(core)))
      return { name: c.name, title: c.title ?? "", city: c.city ?? "" };
  }
  return { name, title: "", city: "" };
}

// ---- main mapping ------------------------------------------------------------------

/** Model answer → the same shape the rules engine returns, plus what couldn't be converted. */
export function mapPrediction<T extends TemplateLike>(
  pred: ModelPrediction,
  templates: T[],
  contacts: ContactLike[],
  today: string,
  forcedTemplateId?: string | null,
): ModelUnderstanding<T> | null {
  const id = forcedTemplateId ?? INTENT_TEMPLATE[pred.intent];
  const template = id ? templates.find((x) => x.id === id) : undefined;
  if (!template) return null;

  const values: Record<string, string> = {};
  const unconverted: { field: TemplateField; raw: string }[] = [];
  const hasTitleField = template.fields.some((f) => f.key === "title");

  for (const [tag, raw] of Object.entries(pred.facts)) {
    const keys = TAG_FIELDS[tag];
    const field = keys && template.fields.find((f) => keys.includes(f.key));
    if (!field || !raw.trim()) continue;
    let v: string | null;
    if (tag === "TITLE") v = toTitle(raw);
    else if (tag === "NAME") {
      const title = !hasTitleField && pred.facts["TITLE"] ? toTitle(pred.facts["TITLE"]) : null;
      v = [title, cleanEdge(raw)].filter(Boolean).join(" ");
    } else if (field.type === "money" || field.type === "number") v = toNumber(raw);
    else if (field.type === "date") v = looseDate(raw, today);
    else v = cleanEdge(raw);
    if (v) values[field.key] = v;
    else unconverted.push({ field, raw });
  }

  const from = values["from_date"];
  const to = values["to_date"];
  if (!values["days"] && from && to && template.fields.some((f) => f.key === "days")) {
    const d = inclusiveDays(from, to);
    if (d) values["days"] = d;
  }

  return {
    template,
    score: pred.confidence,
    confidence: pred.confidence,
    values,
    recipient: pred.facts["RECIPIENT"] ? matchRecipient(pred.facts["RECIPIENT"], contacts) : null,
    found: template.fields.filter((f) => values[f.key]),
    missing: template.fields.filter((f) => !values[f.key]),
    rawFacts: pred.facts,
    unconverted,
  };
}

// ---- talking to the model server ---------------------------------------------------

const URL_KEY = "debdabe.modelUrl";
const ENGINE_KEY = "debdabe.engine";
export type Engine = "rules" | "model";

/** Built-in model link (set VITE_MODEL_URL on Vercel); a link saved in the browser wins. */
const DEFAULT_URL = (import.meta.env["VITE_MODEL_URL"] as string | undefined)?.trim() ?? "";

export function loadEngineSettings(): { engine: Engine; url: string } {
  if (typeof localStorage === "undefined") return { engine: "model", url: DEFAULT_URL };
  return {
    // The model is the default; "rules" only if the user picked it.
    engine: localStorage.getItem(ENGINE_KEY) === "rules" ? "rules" : "model",
    url: localStorage.getItem(URL_KEY) || DEFAULT_URL,
  };
}

/**
 * Lets you send one link: https://app/?model=https://xyz.trycloudflare.com
 * Saves the model link, switches to the model, and removes it from the address bar.
 */
export function captureModelLinkFromUrl() {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams(window.location.search);
  const link = params.get("model");
  if (!link || !/^https?:\/\//.test(link)) return;
  saveEngineSettings("model", link);
  params.delete("model");
  const q = params.toString();
  window.history.replaceState(
    null,
    "",
    window.location.pathname + (q ? `?${q}` : "") + window.location.hash,
  );
}

export function saveEngineSettings(engine: Engine, url: string) {
  localStorage.setItem(ENGINE_KEY, engine);
  localStorage.setItem(URL_KEY, url.trim());
}

const base = (url: string) => url.trim().replace(/\/+$/, "");

export async function pingModel(url: string): Promise<string> {
  const res = await fetch(`${base(url)}/health`, { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`Model server answered ${res.status}`);
  const body = (await res.json()) as { model?: string };
  return body.model ?? "ok";
}

export async function callModel(url: string, text: string): Promise<ModelPrediction> {
  const res = await fetch(`${base(url)}/understand`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`Model server answered ${res.status}`);
  return (await res.json()) as ModelPrediction;
}
