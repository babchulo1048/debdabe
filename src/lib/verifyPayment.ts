// Server function: calls Verify Mela with our secret API key. The handler runs only on the
// server (Vercel / `npm run dev`), so VERIFYMELA_API_KEY never reaches the browser.
// Server env (no VITE_ prefix):
//   VERIFYMELA_API_KEY        vm_… key from the Verify Mela dashboard (required)
//   VERIFYMELA_RECEIVER_NAMES our account names, comma separated, e.g. "Eyoel Demis" (optional)
//   VERIFYMELA_URL            default https://verifymela.vercel.app
import { createServerFn } from "@tanstack/react-start";

import { PAY_METHODS, type PayMethod, type Receipt } from "./verifyMela";

export type LookupResult =
  | { ok: true; receipt: Receipt; receiverNames: string[] }
  | { ok: false; code: string; message: string };

type Input = { method: PayMethod; msg: string };

function validate(d: unknown): Input {
  const o = (d ?? {}) as Record<string, unknown>;
  const method = String(o["method"] ?? "") as PayMethod;
  const msg = String(o["msg"] ?? "").trim();
  if (!PAY_METHODS.some((m) => m.id === method)) throw new Error("Unknown payment method");
  if (!msg || msg.length > 8000) throw new Error("Paste the payment SMS (max 8000 characters)");
  return { method, msg };
}

export const lookupPayment = createServerFn({ method: "POST" })
  .validator(validate)
  .handler(async ({ data }): Promise<LookupResult> => {
    const key = process.env["VERIFYMELA_API_KEY"]?.trim();
    if (!key) return { ok: false, code: "NO_KEY", message: "VERIFYMELA_API_KEY is not set" };
    const base = (process.env["VERIFYMELA_URL"] ?? "https://verifymela.vercel.app").replace(
      /\/$/,
      "",
    );
    const receiverNames = (process.env["VERIFYMELA_RECEIVER_NAMES"] ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    try {
      const res = await fetch(`${base}/api/lookup`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
        body: JSON.stringify({ method: data.method, msg: data.msg }),
        signal: AbortSignal.timeout(45_000),
      });
      const body = (await res.json().catch(() => null)) as {
        success?: boolean;
        message?: string;
        data?: Receipt;
        meta?: { code?: string } | null;
      } | null;
      if (res.ok && body?.success && body.data) {
        return { ok: true, receipt: body.data, receiverNames };
      }
      return {
        ok: false,
        code: body?.meta?.code ?? `HTTP_${res.status}`,
        message: body?.message ?? `Verify Mela answered ${res.status}`,
      };
    } catch (e) {
      return { ok: false, code: "NETWORK", message: (e as Error).message };
    }
  });
