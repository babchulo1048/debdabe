// Verify Mela (https://verifymela.vercel.app/docs): reads an Ethiopian payment SMS / receipt
// link and returns the receipt as the bank or telebirr records it. It gives no verdict, so
// the checks below compare the receipt with what we expected. Pure code, safe in the browser.

export const PAY_METHODS = [
  { id: "telebirr", en: "telebirr", hint: "Paste the whole SMS, or the transaction number" },
  { id: "cbe", en: "CBE", hint: "Paste the whole SMS: CBE needs the receipt link" },
  { id: "dashen", en: "Dashen Bank", hint: "Paste the whole SMS, or the reference" },
  { id: "abyssinia", en: "Bank of Abyssinia", hint: "Paste the whole SMS (the slip link)" },
  { id: "mpesa", en: "M-PESA", hint: "Paste the whole SMS, or the transaction number" },
] as const;
export type PayMethod = (typeof PAY_METHODS)[number]["id"];

/** The fields of Verify Mela's canonical receipt that we use. */
export type Receipt = {
  provider: string;
  reference: string;
  status: string | null;
  payer: { name: string | null; account: string | null };
  receiver: { name: string | null; account: string | null };
  amount: number | null;
  totalPaid: number | null;
  currency: string;
  paidAt: string | null;
  paidAtRaw: string | null;
  receiptUrl: string | null;
  cached: boolean;
};

export type CheckResult = "ok" | "fail" | "unknown";
export type PaymentChecks = {
  amount: CheckResult; // reached us >= expected
  receiver: CheckResult; // paid to one of our names ("unknown" when no names are configured)
  status: CheckResult; // provider says completed (null status = settled on dashen/abyssinia/mpesa)
  recent: CheckResult; // paid within the last RECENT_DAYS
};

export const RECENT_DAYS = 3;

const words = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);

/** True when every word of one of `ours` appears in the receiver name (order and case ignored). */
export function receiverMatches(receiverName: string | null, ours: string[]): boolean {
  if (!receiverName) return false;
  const got = new Set(words(receiverName));
  return ours.some((n) => {
    const w = words(n);
    return w.length > 0 && w.every((x) => got.has(x));
  });
}

export function checkReceipt(
  r: Receipt,
  expected: { amount: number; receiverNames: string[]; now?: Date },
): PaymentChecks {
  const now = expected.now ?? new Date();
  const amount: CheckResult =
    r.amount == null ? "unknown" : r.amount + 0.005 >= expected.amount ? "ok" : "fail";
  const receiver: CheckResult = expected.receiverNames.length
    ? receiverMatches(r.receiver.name, expected.receiverNames)
      ? "ok"
      : "fail"
    : "unknown";
  const status: CheckResult =
    r.status == null ? "ok" : r.status.trim().toLowerCase() === "completed" ? "ok" : "fail";
  let recent: CheckResult = "unknown";
  if (r.paidAt) {
    const age = now.getTime() - new Date(r.paidAt).getTime();
    recent = age <= RECENT_DAYS * 86_400_000 ? "ok" : "fail";
  }
  return { amount, receiver, status, recent };
}

export function allOk(c: PaymentChecks): boolean {
  return Object.values(c).every((v) => v === "ok");
}

/** Plain-English text for Verify Mela's error codes (meta.code). */
export function lookupErrorText(code: string | undefined, fallback: string): string {
  switch (code) {
    case "REFERENCE_NOT_FOUND":
      return "The bank / telebirr does not know this transaction. Check the method and the SMS.";
    case "LINK_REQUIRED":
      return "This bank needs the receipt link. Paste the whole SMS, not only the FT number.";
    case "PROVIDER_MISMATCH":
      return "This SMS is from a different bank than the one you chose.";
    case "INVALID_MESSAGE":
      return "No transaction number or receipt link was found in the text.";
    case "PROVIDER_RATE_LIMITED":
      return "The bank is busy. Try again in a minute.";
    case "PROVIDER_UNAVAILABLE":
    case "PROVIDER_ERROR":
    case "PARSER_OUTDATED":
    case "PROVIDER_DISABLED":
      return "The bank's receipt service is not answering right now. Try again later.";
    case "WALLET_EMPTY":
    case "KEY_LIMIT_REACHED":
    case "KEY_REQUIRED":
    case "NO_KEY":
      return "Payment checking is not available right now (Verify Mela key / credit).";
    default:
      return fallback;
  }
}
