// Ethiopian calendar conversions (pure functions).

export function gregorianToJdn(y: number, m: number, d: number): number {
  const a = Math.floor((14 - m) / 12);
  const y2 = y + 4800 - a;
  const m2 = m + 12 * a - 3;
  return (
    d +
    Math.floor((153 * m2 + 2) / 5) +
    365 * y2 +
    Math.floor(y2 / 4) -
    Math.floor(y2 / 100) +
    Math.floor(y2 / 400) -
    32045
  );
}

export function jdnToGregorian(jdn: number) {
  const a = jdn + 32044;
  const b = Math.floor((4 * a + 3) / 146097);
  const c = a - Math.floor((146097 * b) / 4);
  const d = Math.floor((4 * c + 3) / 1461);
  const e = c - Math.floor((1461 * d) / 4);
  const m = Math.floor((5 * e + 2) / 153);
  return {
    year: 100 * b + d - 4800 + Math.floor(m / 10),
    month: m + 3 - 12 * Math.floor(m / 10),
    day: e - Math.floor((153 * m + 2) / 5) + 1,
  };
}

const ETHIOPIAN_EPOCH = 1723856;

export type EthDate = { year: number; month: number; day: number };

export function toEthiopian(y: number, m: number, d: number): EthDate {
  const jdn = gregorianToJdn(y, m, d);
  const r = (((jdn - ETHIOPIAN_EPOCH) % 1461) + 1461) % 1461;
  const n = (r % 365) + 365 * Math.floor(r / 1460);
  const year =
    4 * Math.floor((jdn - ETHIOPIAN_EPOCH) / 1461) + Math.floor(r / 365) - Math.floor(r / 1460);
  return { year, month: Math.floor(n / 30) + 1, day: (n % 30) + 1 };
}

export function ethiopianToJdn(year: number, month: number, day: number): number {
  return ETHIOPIAN_EPOCH + 365 * year + Math.floor(year / 4) + 30 * (month - 1) + day - 1;
}

export function toGregorian(year: number, month: number, day: number) {
  return jdnToGregorian(ethiopianToJdn(year, month, day));
}

export const ETH_MONTHS = [
  "መስከረም",
  "ጥቅምት",
  "ኅዳር",
  "ታኅሣሥ",
  "ጥር",
  "የካቲት",
  "መጋቢት",
  "ሚያዝያ",
  "ግንቦት",
  "ሰኔ",
  "ሐምሌ",
  "ነሐሴ",
  "ጳጉሜን",
];

export function formatEthiopian(e: EthDate): string {
  return `${ETH_MONTHS[e.month - 1]} ${e.day} ቀን ${e.year} ዓ.ም`;
}

/** Parse "YYYY-MM-DD" into parts. */
export function parseIso(iso: string) {
  const [y = 0, m = 0, d = 0] = iso.slice(0, 10).split("-").map(Number);
  return { y, m, d };
}

export function isoToEthiopianString(iso: string | null | undefined): string {
  if (!iso) return "";
  const { y, m, d } = parseIso(iso);
  if (!y || !m || !d) return "";
  return formatEthiopian(toEthiopian(y, m, d));
}

export function isoToEthYear(iso: string): number {
  const { y, m, d } = parseIso(iso);
  return toEthiopian(y, m, d).year;
}

/** Today in Africa/Addis_Ababa as YYYY-MM-DD. */
export function todayAddisIso(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Addis_Ababa",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function formatGregorian(iso: string): string {
  const { y, m, d } = parseIso(iso);
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  return `${d} ${months[m - 1]} ${y}`;
}
