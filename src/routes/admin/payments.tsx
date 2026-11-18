import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell, PageTitle } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useIsPlatformAdmin, usePayments, type Payment } from "@/lib/data";
import { formatGregorian } from "@/lib/ethiopianCalendar";
import { formatMoney } from "@/lib/letters";
import {
  checkReceipt,
  lookupErrorText,
  type CheckResult,
  type PaymentChecks,
  type PayMethod,
} from "@/lib/verifyMela";
import { lookupPayment } from "@/lib/verifyPayment";

export const Route = createFileRoute("/admin/payments")({
  ssr: false,
  head: () => ({ meta: [{ title: "Payments to approve · Debdabe" }] }),
  component: AdminPaymentsPage,
});

const CHECK_LABELS: [keyof PaymentChecks, string][] = [
  ["amount", "Amount"],
  ["receiver", "Paid to us"],
  ["status", "Completed"],
  ["recent", "Recent"],
];

function AdminPaymentsPage() {
  return <AppShell>{() => <Body />}</AppShell>;
}

function Body() {
  const admin = useIsPlatformAdmin();
  const payments = usePayments();
  const orgs = useQuery({
    queryKey: ["admin-orgs"],
    queryFn: async () => {
      const { data, error } = await supabase.from("organizations").select("id, name_en, name_am");
      if (error) throw error;
      return new Map(data.map((o) => [o.id, o.name_en || o.name_am]));
    },
  });
  const [filter, setFilter] = useState<"pending" | "all">("pending");

  if (admin.isLoading) return null;
  if (!admin.data) {
    return (
      <p className="p-10 text-center text-muted-foreground">
        Only Debdabe staff can see this page.
      </p>
    );
  }
  const rows = (payments.data ?? []).filter((p) => filter === "all" || p.status === "pending");

  return (
    <>
      <PageTitle
        title="Payments to approve"
        sub="Checked with Verify Mela. Approve gives the organisation the plan for one month. Testing only."
      />
      <div className="mb-3 flex gap-2">
        {(["pending", "all"] as const).map((f) => (
          <Button
            key={f}
            size="sm"
            variant={filter === f ? "default" : "outline"}
            onClick={() => setFilter(f)}
          >
            {f === "pending" ? "Pending" : "All"}
          </Button>
        ))}
      </div>
      <div className="grid gap-3">
        {rows.length === 0 && (
          <p className="rounded-lg border bg-card p-8 text-center text-muted-foreground">
            No payments here.
          </p>
        )}
        {rows.map((p) => (
          <PaymentCard key={p.id} p={p} org={orgs.data?.get(p.organization_id) ?? "—"} />
        ))}
      </div>
    </>
  );
}

function asChecks(v: Payment["checks"]): Partial<PaymentChecks> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Partial<PaymentChecks>) : {};
}

function CheckPill({ label, v }: { label: string; v: CheckResult | undefined }) {
  const tone =
    v === "ok"
      ? "bg-success/15 text-success"
      : v === "fail"
        ? "bg-destructive/15 text-destructive"
        : "bg-muted text-muted-foreground";
  const mark = v === "ok" ? "✓" : v === "fail" ? "✗" : "?";
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${tone}`}>
      {mark} {label}
    </span>
  );
}

function PaymentCard({ p, org }: { p: Payment; org: string }) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [checks, setChecks] = useState<Partial<PaymentChecks>>(asChecks(p.checks));

  async function decide(approve: boolean) {
    setBusy(true);
    try {
      let note: string | null = null;
      if (approve) {
        // Re-read the receipt from Verify Mela (repeat lookups are free), so a row a customer
        // forged in the database can't be approved by mistake.
        // CBE / Abyssinia need the receipt link, not the bare reference.
        const link = (p.receipt as { receiptUrl?: string | null } | null)?.receiptUrl;
        const r = await lookupPayment({
          data: { method: p.method as PayMethod, msg: link || p.reference },
        });
        if (!r.ok) {
          toast.error(`Could not re-check: ${lookupErrorText(r.code, r.message)}`);
          return;
        }
        const fresh = checkReceipt(r.receipt, {
          amount: Number(p.expected_amount),
          receiverNames: r.receiverNames,
          now: new Date(p.created_at),
        });
        setChecks(fresh);
        if (r.receipt.reference !== p.reference || r.receipt.amount !== Number(p.amount)) {
          toast.error("The bank's receipt does not match this row. Not approved.");
          return;
        }
        const bad = Object.entries(fresh).filter(([, v]) => v !== "ok");
        if (
          bad.length &&
          !window.confirm(
            `Some checks are not green (${bad.map(([k]) => k).join(", ")}). Approve anyway?`,
          )
        )
          return;
      } else {
        note = window.prompt("Reason for rejecting (the customer sees it):", "") || null;
      }
      const { error } = await supabase.rpc(approve ? "approve_payment" : "reject_payment", {
        _payment: p.id,
        ...(note ? { _note: note } : {}),
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success(approve ? `Approved: ${org} is on ${p.plan}` : "Rejected");
      qc.invalidateQueries({ queryKey: ["payments"] });
      qc.invalidateQueries({ queryKey: ["me"] });
      qc.invalidateQueries({ queryKey: ["invoices"] });
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="grid gap-3 rounded-lg border bg-card p-4 text-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <span className="font-medium">{org}</span>
          <span className="text-muted-foreground">
            {" "}
            · {p.plan} · {formatGregorian(p.created_at)}
          </span>
        </div>
        <span className="text-xs uppercase tracking-wide text-muted-foreground">{p.status}</span>
      </div>
      <div className="grid gap-1 sm:grid-cols-2">
        <div>
          Paid:{" "}
          <span className="font-semibold tabular-nums">
            {p.amount == null ? "–" : formatMoney(p.amount)}
          </span>{" "}
          <span className="text-muted-foreground">(expected {formatMoney(p.expected_amount)})</span>
        </div>
        <div>
          {p.method} · <span className="font-mono">{p.reference}</span>
        </div>
        <div>
          To: {p.receiver_name ?? "–"}{" "}
          {p.receiver_account && (
            <span className="text-muted-foreground">({p.receiver_account})</span>
          )}
        </div>
        <div>From: {p.payer_name ?? "–"}</div>
        <div>On: {p.paid_at ? new Date(p.paid_at).toLocaleString() : "–"}</div>
        {p.note && <div>Note: {p.note}</div>}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {CHECK_LABELS.map(([k, label]) => (
          <CheckPill key={k} label={label} v={checks[k]} />
        ))}
      </div>
      {p.status === "pending" && (
        <div className="flex gap-2">
          <Button size="sm" disabled={busy} onClick={() => decide(true)}>
            Approve
          </Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => decide(false)}>
            Reject
          </Button>
        </div>
      )}
    </article>
  );
}
