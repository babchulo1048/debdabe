import { isoToEthiopianString } from "./ethiopianCalendar";

export type FieldType = "text" | "date" | "number" | "money";
export type TemplateField = {
  key: string;
  label_am: string;
  label_en: string;
  type: FieldType;
  required?: boolean;
};
export type Recipient = { name?: string; title?: string; city?: string };

export const PLANS = {
  basic: { name: "Basic", price: 500, limit: 30 as number | null, users: "1" },
  office: { name: "Office", price: 1500, limit: 150 as number | null, users: "3" },
  unlimited: { name: "Unlimited", price: 3000, limit: null as number | null, users: "Unlimited" },
} as const;
export type PlanKey = keyof typeof PLANS;
export const VAT_RATE = 0.15;

export function formatMoney(v: string | number): string {
  const n = typeof v === "number" ? v : Number(String(v).replace(/,/g, ""));
  if (!isFinite(n)) return String(v);
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatFieldValue(type: FieldType, raw: string): string {
  if (!raw) return "";
  if (type === "date") return isoToEthiopianString(raw);
  if (type === "money") return formatMoney(raw);
  return raw;
}

/** Substitute {{key}} placeholders; missing values become [label]. */
export function fillTemplate(
  body: string,
  fields: TemplateField[],
  values: Record<string, string>,
): string {
  return body.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) => {
    const f = fields.find((x) => x.key === key);
    const v = values[key];
    if (v) return formatFieldValue(f?.type ?? "text", v);
    return `[${f?.label_am ?? key}]`;
  });
}

export function formatReference(
  pattern: string,
  o: { prefix: string; seq: number; year: number; dept?: string },
): string {
  return pattern
    .replaceAll("{PREFIX}", o.prefix)
    .replaceAll("{SEQ3}", String(o.seq).padStart(3, "0"))
    .replaceAll("{SEQ}", String(o.seq))
    .replaceAll("{ETH_YEAR}", String(o.year))
    .replaceAll("{DEPT}", o.dept ?? "");
}

export function usageLevel(
  used: number,
  limit: number | null,
): "ok" | "near" | "over" | "unlimited" {
  if (limit == null) return "unlimited";
  const p = used / limit;
  if (p >= 1) return used > limit ? "over" : "near";
  if (p >= 0.8) return "near";
  return "ok";
}

export function invoiceTotals(amount: number) {
  const vat = Math.round(amount * VAT_RATE * 100) / 100;
  return { amount, vat, total: amount + vat };
}

/** Levenshtein-based edit ratio (0 = unchanged, 1 = fully rewritten). */
export function editRatio(a: string, b: string): number {
  if (a === b) return 0;
  const m = a.length,
    n = b.length;
  if (!m || !n) return 1;
  let prev: number[] = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const cur: number[] = [i];
    for (let j = 1; j <= n; j++) {
      const sub = (prev[j - 1] ?? 0) + (a[i - 1] === b[j - 1] ? 0 : 1);
      cur[j] = Math.min((prev[j] ?? 0) + 1, (cur[j - 1] ?? 0) + 1, sub);
    }
    prev = cur;
  }
  return Math.round(((prev[n] ?? 0) / Math.max(m, n)) * 1000) / 1000;
}

export function slugify(s: string): string {
  return (s || "letter")
    .trim()
    .replace(/[\s/\\:*?"<>|]+/g, "-")
    .slice(0, 50);
}

export function docxFileName(ref: string | null | undefined, subject: string): string {
  return `${ref ? ref.replaceAll("/", "-") : "draft"}_${slugify(subject)}.docx`;
}

// ---- Sender (letterhead + signer), kept per letter -------------------------

/** Who the letter is from. Prefilled from Settings, editable per letter. */
export type Sender = {
  org_name_am: string;
  org_name_en: string;
  tin: string;
  address: string;
  phone: string;
  email: string;
  signer_name: string;
  signer_position: string;
};
export type SenderKey = keyof Sender;

export const SENDER_FIELDS: { key: SenderKey; label_am: string; label_en: string }[] = [
  { key: "org_name_am", label_am: "የድርጅቱ ስም", label_en: "Company name (Amharic)" },
  { key: "org_name_en", label_am: "የድርጅቱ ስም (እንግሊዝኛ)", label_en: "Company name (English)" },
  { key: "tin", label_am: "የግብር ከፋይ መለያ ቁጥር", label_en: "TIN" },
  { key: "address", label_am: "አድራሻ", label_en: "Address" },
  { key: "phone", label_am: "ስልክ", label_en: "Phone" },
  { key: "email", label_am: "ኢሜይል", label_en: "Email" },
  { key: "signer_name", label_am: "ፈራሚ", label_en: "Signed by" },
  { key: "signer_position", label_am: "የፈራሚው ኃላፊነት", label_en: "Signer's position" },
];

const SENDER_PREFIX = "_sender_";

type OrgLike = {
  name_am?: string | null;
  name_en?: string | null;
  tin?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
};
type SignerLike = { name_am?: string | null; position_am?: string | null } | null | undefined;

/** The sender as set up in Settings. */
export function defaultSender(org: OrgLike, signer: SignerLike): Sender {
  return {
    org_name_am: org.name_am ?? "",
    org_name_en: org.name_en ?? "",
    tin: org.tin ?? "",
    address: org.address ?? "",
    phone: org.phone ?? "",
    email: org.email ?? "",
    signer_name: signer?.name_am ?? "",
    signer_position: signer?.position_am ?? "",
  };
}

/** The letter's own sender values win; older letters without them use Settings. */
export function readSender(values: Record<string, string>, fallback: Sender): Sender {
  const out = { ...fallback };
  for (const f of SENDER_FIELDS) {
    const k = SENDER_PREFIX + f.key;
    if (k in values) out[f.key] = values[k] ?? "";
  }
  return out;
}

/** Store the sender inside the letter's field values. */
export function writeSender(
  values: Record<string, string>,
  sender: Sender,
): Record<string, string> {
  const out = { ...values };
  for (const f of SENDER_FIELDS) out[SENDER_PREFIX + f.key] = sender[f.key].trim();
  return out;
}
