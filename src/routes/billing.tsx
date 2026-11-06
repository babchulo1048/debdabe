import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Check, Printer } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell, PageTitle, UsageMeter } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { isAdmin, useInvoices, useMonthlyUsage, type Invoice, type Me } from "@/lib/data";
import { formatGregorian, isoToEthiopianString } from "@/lib/ethiopianCalendar";
import { useT } from "@/lib/i18n";
import { formatMoney, PLANS, VAT_RATE, type PlanKey } from "@/lib/letters";

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
          <Invoices me={me} />
        </>
      )}
    </AppShell>
  );
}

function Plans({ me }: { me: Me }) {
  const { t } = useT();
  const qc = useQueryClient();
  const usage = useMonthlyUsage();
  const current = me.org.plan;

  async function switchPlan(plan: PlanKey) {
    const { error } = await supabase.from("organizations").update({ plan }).eq("id", me.org.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(t(`Switched to ${PLANS[plan].name}`, `ወደ ${PLANS[plan].name} ተቀይሯል`));
    qc.invalidateQueries({ queryKey: ["me"] });
  }

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
                <Button variant="outline" className="mt-auto" onClick={() => switchPlan(k)}>
                  {t(`Switch to ${p.name}`, `ወደ ${p.name} ቀይር`)}
                </Button>
              )}
            </article>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">
        {t(
          "Demo billing: switching plans takes effect immediately and no payment is collected.",
          "የሙከራ ክፍያ፡ ዕቅድ መቀየር ወዲያውኑ ይሠራል፣ ምንም ክፍያ አይሰበሰብም።",
        )}
      </p>
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
