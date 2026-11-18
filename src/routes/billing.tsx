import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Check, Printer } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell, PageTitle, UsageMeter } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  isAdmin,
  useInvoices,
  useMonthlyUsage,
  usePayments,
  type Invoice,
  type Me,
} from "@/lib/data";
import { formatGregorian, isoToEthiopianString } from "@/lib/ethiopianCalendar";
import { useT } from "@/lib/i18n";
import { formatMoney, PLANS, VAT_RATE, type PlanKey } from "@/lib/letters";
import type { Json } from "@/integrations/supabase/types";
import { checkReceipt, lookupErrorText, PAY_METHODS, type PayMethod } from "@/lib/verifyMela";
import { lookupPayment } from "@/lib/verifyPayment";

export const Route = createFileRoute("/billing")({
  ssr: false,
  head: () => ({ meta: [{ title: "Plan & billing · Debdabe" }] }),
  component: BillingPage,
});

const FEATURES: Record<PlanKey, [string, string][]> = {
  basic: [
    ["Templates, AI letters, print and DOCX", "አብነቶች፣ የAI ደብዳቤዎች፣ ህትመት እና DOCX"],
    ["1 user, 1 letterhead", "1 ተጠቃሚ፣ 1 የደብዳቤ ራስጌ"],
  ],
  office: [
    ["Everything in Basic", "በBasic ያለው ሁሉ"],
    ["Register and archive", "መዝገብ እና ማህደር"],
    ["Up to 3 users", "እስከ 3 ተጠቃሚዎች"],
  ],
  unlimited: [
    ["Everything in Office", "በOffice ያለው ሁሉ"],
    ["Approvals and branches", "ማጽደቅ እና ቅርንጫፎች"],
    ["Archive search, unlimited users", "የማህደር ፍለጋ፣ ያልተገደቡ ተጠቃሚዎች"],
  ],
};

function BillingPage() {
  const { t } = useT();
  return (
    <AppShell>
      {(me) => (
        <>
          <PageTitle
            title={t("Plan & billing", "ዕቅድ እና ክፍያ")}
            sub={t(
              `Prices exclude ${VAT_RATE * 100}% VAT. Invoices are issued at month end and paid by bank transfer or Telebirr.`,
              `ዋጋዎች ${VAT_RATE * 100}% ቫትን አያካትቱም። ደረሰኞች በወሩ መጨረሻ ይወጣሉ፤ በባንክ ዝውውር ወይም በቴሌብር ይከፈላሉ።`,
            )}
          />
          <Plans me={me} />
          <MyPayments />
          <Invoices me={me} />
        </>
      )}
    </AppShell>
  );
}

function Plans({ me }: { me: Me }) {
  const { t } = useT();
  const usage = useMonthlyUsage();
  const current = me.org.plan;

  const [paying, setPaying] = useState<PlanKey | null>(null);

  return (
    <div className="grid gap-4">
      <div className="max-w-md rounded-lg border bg-card p-4">
        <UsageMeter used={usage.data ?? 0} limit={PLANS[current].limit} />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {(Object.keys(PLANS) as PlanKey[]).map((k) => {
          const p = PLANS[k];
          const active = k === current;
          return (
            <article
              key={k}
              className={`flex flex-col gap-3 rounded-lg border bg-card p-5 ${active ? "border-primary ring-1 ring-primary" : ""}`}
            >
              <div className="flex items-center justify-between">
                <h2 className="text-lg">{p.name}</h2>
                {active && (
                  <span className="rounded-full bg-primary-soft px-2 py-0.5 text-xs font-medium">
                    {t("Current plan", "የአሁኑ ዕቅድ")}
                  </span>
                )}
              </div>
              <div className="font-serif text-2xl font-semibold tabular-nums">
                {p.price.toLocaleString("en-US")}{" "}
                <span className="font-sans text-sm font-normal text-muted-foreground">
                  {t("birr / month", "ብር / በወር")}
                </span>
              </div>
              <div className="text-sm text-muted-foreground">
                {p.limit == null
                  ? t("Unlimited letters (fair use)", "ያልተገደበ ደብዳቤ (ተገቢ አጠቃቀም)")
                  : t(`${p.limit} letters per month`, `በወር ${p.limit} ደብዳቤዎች`)}
              </div>
              <ul className="grid gap-1.5 text-sm">
                {FEATURES[k].map(([en, am]) => (
                  <li key={en} className="flex gap-2">
                    <Check className="mt-0.5 size-4 shrink-0 text-success" />
                    {t(en, am)}
                  </li>
                ))}
              </ul>
              {!active && isAdmin(me.role) && (
                <Button variant="outline" className="mt-auto" onClick={() => setPaying(k)}>
                  {t(`Pay for ${p.name}`, `ለ${p.name} ይክፈሉ`)}
                </Button>
              )}
            </article>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">
        {me.org.paid_until &&
          t(
            `Paid until ${formatGregorian(me.org.paid_until)}. `,
            `እስከ ${formatGregorian(me.org.paid_until)} ተከፍሏል። `,
          )}
        {t(
          "Testing: pay, paste the SMS, and the plan changes after Debdabe approves the payment.",
          "ሙከራ፡ ይክፈሉ፣ መልዕክቱን ይለጥፉ፤ ክፍያው ሲጸድቅ ዕቅዱ ይቀየራል።",
        )}
      </p>
      {paying && <PayDialog me={me} plan={paying} onClose={() => setPaying(null)} />}
    </div>
  );
}

function Invoices({ me }: { me: Me }) {
  const { t } = useT();
  const invoices = useInvoices();
  const [open, setOpen] = useState<Invoice | null>(null);
  return (
    <section className="mt-8">
      <h2 className="mb-3 text-lg">{t("Invoices", "ደረሰኞች")}</h2>
      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-2 font-medium">{t("Invoice", "ደረሰኝ")}</th>
              <th className="px-4 py-2 font-medium">{t("Period", "ጊዜ")}</th>
              <th className="px-4 py-2 font-medium">{t("Plan", "ዕቅድ")}</th>
              <th className="px-4 py-2 text-right font-medium">{t("Amount", "መጠን")}</th>
              <th className="px-4 py-2 text-right font-medium">{t("VAT", "ቫት")}</th>
              <th className="px-4 py-2 text-right font-medium">{t("Total", "ጠቅላላ")}</th>
              <th className="px-4 py-2 font-medium">{t("Status", "ሁኔታ")}</th>
            </tr>
          </thead>
          <tbody>
            {invoices.data?.length ? (
              invoices.data.map((inv) => (
                <tr key={inv.id} className="border-b last:border-0 hover:bg-accent/40">
                  <td className="px-4 py-2.5">
                    <button
                      type="button"
                      className="font-mono text-primary hover:underline"
                      onClick={() => setOpen(inv)}
                    >
                      {inv.number}
                    </button>
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5">
                    {formatGregorian(inv.period_start)} – {formatGregorian(inv.period_end)}
                  </td>
                  <td className="px-4 py-2.5 capitalize">{inv.plan}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{formatMoney(inv.amount)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{formatMoney(inv.vat)}</td>
                  <td className="px-4 py-2.5 text-right font-medium tabular-nums">
                    {formatMoney(inv.total)}
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${inv.status === "paid" ? "bg-success/15 text-success" : "bg-warning/15 text-warning"}`}
                    >
                      {inv.status === "paid" ? t("Paid", "ተከፍሏል") : t("Unpaid", "ያልተከፈለ")}
                    </span>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} className="p-8 text-center text-muted-foreground">
                  {t("No invoices yet.", "እስካሁን ደረሰኝ የለም።")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {open && <InvoiceDialog me={me} inv={open} onClose={() => setOpen(null)} />}
    </section>
  );
}

function InvoiceDialog({ me, inv, onClose }: { me: Me; inv: Invoice; onClose: () => void }) {
  const { t } = useT();
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{inv.number}</DialogTitle>
        </DialogHeader>
        <div className="print-area grid gap-4 rounded-md border bg-white p-6 text-sm text-black">
          <div className="flex justify-between gap-4">
            <div>
              <div className="font-serif text-lg font-semibold">Debdabe</div>
              <div className="text-neutral-500">
                {t("Invoice", "ደረሰኝ")} {inv.number}
              </div>
            </div>
            <div className="text-right">
              <div className="font-medium">{me.org.name_en}</div>
              <div className="font-ethiopic">{me.org.name_am}</div>
              {me.org.tin && <div>TIN: {me.org.tin}</div>}
            </div>
          </div>
          <div>
            {t("Period", "ጊዜ")}: {formatGregorian(inv.period_start)} –{" "}
            {formatGregorian(inv.period_end)} ·{" "}
            <span className="font-ethiopic">
              {isoToEthiopianString(inv.period_start)} – {isoToEthiopianString(inv.period_end)}
            </span>
          </div>
          <table className="w-full">
            <tbody>
              <tr className="border-b">
                <td className="py-2 capitalize">
                  {inv.plan} {t("plan, monthly", "ዕቅድ፣ ወርሃዊ")}
                </td>
                <td className="py-2 text-right tabular-nums">{formatMoney(inv.amount)}</td>
              </tr>
              <tr className="border-b">
                <td className="py-2">
                  {t("VAT", "ቫት")} ({VAT_RATE * 100}%)
                </td>
                <td className="py-2 text-right tabular-nums">{formatMoney(inv.vat)}</td>
              </tr>
              <tr>
                <td className="py-2 font-semibold">{t("Total (birr)", "ጠቅላላ (ብር)")}</td>
                <td className="py-2 text-right font-semibold tabular-nums">
                  {formatMoney(inv.total)}
                </td>
              </tr>
            </tbody>
          </table>
          <div className="text-xs text-neutral-500">
            {inv.status === "paid" && inv.paid_at
              ? t(
                  `Paid on ${formatGregorian(inv.paid_at)}`,
                  `በ${formatGregorian(inv.paid_at)} ተከፍሏል`,
                )
              : t("Payable by bank transfer or Telebirr.", "በባንክ ዝውውር ወይም በቴሌብር የሚከፈል።")}
          </div>
        </div>
        <Button variant="outline" className="w-fit" onClick={() => window.print()}>
          <Printer />
          {t("Print invoice", "ደረሰኙን አትም")}
        </Button>
      </DialogContent>
    </Dialog>
  );
}

/** Plan price + VAT: what the customer must transfer. */
function planTotal(plan: PlanKey): number {
  const price = PLANS[plan].price;
  return Math.round(price * (1 + VAT_RATE) * 100) / 100;
}

function PayDialog({ me, plan, onClose }: { me: Me; plan: PlanKey; onClose: () => void }) {
  const { t } = useT();
  const qc = useQueryClient();
  const [method, setMethod] = useState<PayMethod>("telebirr");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const total = planTotal(plan);
  const hint = PAY_METHODS.find((m) => m.id === method)?.hint ?? "";

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const r = await lookupPayment({ data: { method, msg } });
      if (!r.ok) {
        setError(lookupErrorText(r.code, r.message));
        return;
      }
      const rc = r.receipt;
      const checks = checkReceipt(rc, { amount: total, receiverNames: r.receiverNames });
      const { error: insErr } = await supabase.from("payments").insert({
        organization_id: me.org.id,
        plan,
        expected_amount: total,
        method,
        reference: rc.reference,
        amount: rc.amount,
        payer_name: rc.payer.name,
        receiver_name: rc.receiver.name,
        receiver_account: rc.receiver.account,
        paid_at: rc.paidAt,
        checks: checks as unknown as Json,
        receipt: rc as unknown as Json,
      });
      if (insErr) {
        setError(
          insErr.code === "23505"
            ? t("This payment was already submitted.", "ይህ ክፍያ ቀደም ብሎ ቀርቧል።")
            : insErr.message,
        );
        return;
      }
      toast.success(t("Payment received. We will approve it soon.", "ክፍያው ደርሷል። በቅርቡ እናጸድቃለን።"));
      qc.invalidateQueries({ queryKey: ["payments"] });
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t(`Pay for ${PLANS[plan].name}`, `ለ${PLANS[plan].name} ይክፈሉ`)}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 text-sm">
          <div className="rounded-md border bg-muted/40 p-3">
            {t("Transfer", "ያስተላልፉ")}{" "}
            <span className="font-semibold tabular-nums">{formatMoney(total)}</span>{" "}
            {t(
              `birr (${formatMoney(PLANS[plan].price)} + ${VAT_RATE * 100}% VAT) for one month.`,
              `ብር (${formatMoney(PLANS[plan].price)} + ${VAT_RATE * 100}% ቫት) ለአንድ ወር።`,
            )}
          </div>
          <div className="grid gap-1.5">
            <Label>{t("Paid with", "የተከፈለበት")}</Label>
            <div className="flex flex-wrap gap-2">
              {PAY_METHODS.map((m) => (
                <Button
                  key={m.id}
                  type="button"
                  size="sm"
                  variant={m.id === method ? "default" : "outline"}
                  onClick={() => setMethod(m.id)}
                >
                  {m.en}
                </Button>
              ))}
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="pay-msg">{t("Payment SMS", "የክፍያ መልዕክት")}</Label>
            <Textarea
              id="pay-msg"
              rows={5}
              value={msg}
              onChange={(e) => setMsg(e.target.value)}
              placeholder={hint}
            />
            <p className="text-xs text-muted-foreground">{hint}</p>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button onClick={submit} disabled={busy || !msg.trim()}>
            {busy
              ? t("Checking with the bank…", "ከባንኩ ጋር በማረጋገጥ ላይ…")
              : t("Submit payment", "ክፍያ አስገባ")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function MyPayments() {
  const { t } = useT();
  const payments = usePayments();
  if (!payments.data?.length) return null;
  const label = (s: string) =>
    s === "approved"
      ? t("Approved", "ጸድቋል")
      : s === "rejected"
        ? t("Rejected", "ውድቅ ተደርጓል")
        : t("Waiting for approval", "ማጽደቅ በመጠበቅ ላይ");
  const tone = (s: string) =>
    s === "approved"
      ? "bg-success/15 text-success"
      : s === "rejected"
        ? "bg-destructive/15 text-destructive"
        : "bg-warning/15 text-warning";
  return (
    <section className="mt-8">
      <h2 className="mb-3 text-lg">{t("Payments", "ክፍያዎች")}</h2>
      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-sm">
          <tbody>
            {payments.data.map((p) => (
              <tr key={p.id} className="border-b last:border-0">
                <td className="whitespace-nowrap px-4 py-2.5">{formatGregorian(p.created_at)}</td>
                <td className="px-4 py-2.5 capitalize">{p.plan}</td>
                <td className="px-4 py-2.5">
                  {p.method} · <span className="font-mono">{p.reference}</span>
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">
                  {p.amount == null ? "–" : formatMoney(p.amount)}
                </td>
                <td className="px-4 py-2.5">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${tone(p.status)}`}
                  >
                    {label(p.status)}
                  </span>
                  {p.note && <span className="ml-2 text-xs text-muted-foreground">{p.note}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
