import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Download, Inbox, Loader2, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { AppShell, PageTitle, StatusBadge } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { asRecipient, useLetters, useMembers, type LetterRow, type Me } from "@/lib/data";
import {
  formatGregorian,
  isoToEthiopianString,
  isoToEthYear,
  todayAddisIso,
} from "@/lib/ethiopianCalendar";
import { downloadBlob } from "@/lib/docx";
import { useT } from "@/lib/i18n";
import { uploadOrgFile } from "@/lib/storage";

export const Route = createFileRoute("/register")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>): { incoming?: "1" } =>
    s["incoming"] === "1" ? { incoming: "1" } : {},
  head: () => ({ meta: [{ title: "Letter register · Debdabe" }] }),
  component: RegisterPage,
});

const PAGE = 20;

function RegisterPage() {
  const { t } = useT();
  const search = Route.useSearch();
  const [open, setOpen] = useState(search.incoming === "1");
  return (
    <AppShell>
      {(me) => (
        <>
          <PageTitle
            title={t("Letter register", "የደብዳቤ መዝገብ")}
            sub={t(
              "Every outgoing (ወጪ) and incoming (ገቢ) letter, with its reference number.",
              "እያንዳንዱ ወጪ እና ገቢ ደብዳቤ ከቁጥሩ ጋር።",
            )}
            action={
              <Button onClick={() => setOpen(true)}>
                <Inbox />
                {t("Register incoming letter", "ገቢ ደብዳቤ መዝግብ")}
              </Button>
            }
          />
          <RegisterTable />
          <IncomingDialog me={me} open={open} onOpenChange={setOpen} />
        </>
      )}
    </AppShell>
  );
}

function RegisterTable() {
  const { t } = useT();
  const [dir, setDir] = useState<"outgoing" | "incoming">("outgoing");
  const letters = useLetters(dir);
  const members = useMembers();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"all" | "draft" | "final">("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(0);

  const who = (id: string | null) =>
    members.data?.find((m) => m.id === id)?.full_name ||
    members.data?.find((m) => m.id === id)?.email ||
    "";
  const party = (l: LetterRow) =>
    dir === "incoming" ? (l.sender ?? "") : (asRecipient(l.recipient).name ?? "");

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (letters.data ?? []).filter(
      (l) =>
        (status === "all" || l.status === status) &&
        (!from || l.letter_date >= from) &&
        (!to || l.letter_date <= to) &&
        (!needle ||
          `${l.subject} ${l.reference_no ?? ""} ${party(l)}`.toLowerCase().includes(needle)),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [letters.data, q, status, from, to, dir]);

  const pageRows = rows.slice(page * PAGE, (page + 1) * PAGE);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE));

  function exportCsv() {
    const header = [
      "Reference",
      "Ethiopian date",
      "Gregorian date",
      "Subject",
      dir === "incoming" ? "From" : "To",
      "Created by",
      "Status",
    ];
    const esc = (v: string) => `"${v.replaceAll('"', '""')}"`;
    const lines = rows.map((l) =>
      [
        l.reference_no ?? "",
        isoToEthiopianString(l.letter_date),
        l.letter_date,
        l.subject,
        party(l),
        who(l.created_by),
        l.status,
      ]
        .map(esc)
        .join(","),
    );
    const blob = new Blob(["﻿" + [header.map(esc).join(","), ...lines].join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    downloadBlob(blob, `register-${dir}-${todayAddisIso()}.csv`);
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <Tabs
          value={dir}
          onValueChange={(v) => {
            setDir(v as "outgoing" | "incoming");
            setPage(0);
          }}
        >
          <TabsList>
            <TabsTrigger value="outgoing">{t("Outgoing · ወጪ", "ወጪ")}</TabsTrigger>
            <TabsTrigger value="incoming">{t("Incoming · ገቢ", "ገቢ")}</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative w-full max-w-xs">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            aria-label={t("Search register", "መዝገቡን ፈልግ")}
            placeholder={t("Subject, recipient or reference", "ጉዳይ፣ ተቀባይ ወይም ቁጥር")}
            className="pl-8 font-ethiopic"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(0);
            }}
          />
        </div>
        {dir === "outgoing" && (
          <select
            aria-label={t("Status", "ሁኔታ")}
            className="h-9 rounded-md border bg-background px-2 text-sm"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as typeof status);
              setPage(0);
            }}
          >
            <option value="all">{t("All statuses", "ሁሉም")}</option>
            <option value="final">{t("Final", "የተጠናቀቀ")}</option>
            <option value="draft">{t("Draft", "ረቂቅ")}</option>
          </select>
        )}
        <div className="flex items-center gap-1.5 text-sm">
          <Label htmlFor="from" className="text-muted-foreground">
            {t("From", "ከ")}
          </Label>
          <Input
            id="from"
            type="date"
            className="w-40"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
          <Label htmlFor="to" className="text-muted-foreground">
            {t("to", "እስከ")}
          </Label>
          <Input
            id="to"
            type="date"
            className="w-40"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </div>
        <Button variant="outline" className="ml-auto" onClick={exportCsv} disabled={!rows.length}>
          <Download />
          CSV
        </Button>
      </div>

      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-2 font-medium">{t("Reference", "ቁጥር")}</th>
              <th className="px-4 py-2 font-medium">{t("Ethiopian date", "ቀን")}</th>
              <th className="px-4 py-2 font-medium">{t("Gregorian", "እ.ኤ.አ")}</th>
              <th className="px-4 py-2 font-medium">{t("Subject", "ጉዳይ")}</th>
              <th className="px-4 py-2 font-medium">
                {dir === "incoming" ? t("From", "ከ") : t("To", "ለ")}
              </th>
              <th className="px-4 py-2 font-medium">{t("Created by", "ያዘጋጀው")}</th>
              <th className="px-4 py-2 font-medium">{t("Status", "ሁኔታ")}</th>
            </tr>
          </thead>
          <tbody>
            {letters.isLoading ? (
              <tr>
                <td colSpan={7} className="p-4">
                  <Skeleton className="h-24" />
                </td>
              </tr>
            ) : pageRows.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-muted-foreground">
                  {t("No letters match these filters.", "ከእነዚህ ማጣሪያዎች ጋር የሚዛመድ ደብዳቤ የለም።")}
                </td>
              </tr>
            ) : (
              pageRows.map((l) => (
                <tr key={l.id} className="border-b last:border-0 hover:bg-accent/40">
                  <td className="whitespace-nowrap px-4 py-2.5 font-mono text-xs tabular-nums">
                    <Link
                      to={l.status === "draft" ? "/letters/$id/edit" : "/letters/$id"}
                      params={{ id: l.id }}
                      className="text-primary hover:underline"
                    >
                      {l.reference_no ?? t("(draft)", "(ረቂቅ)")}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 font-ethiopic">
                    {isoToEthiopianString(l.letter_date)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 tabular-nums text-muted-foreground">
                    {formatGregorian(l.letter_date)}
                  </td>
                  <td className="max-w-[20rem] truncate px-4 py-2.5 font-ethiopic">{l.subject}</td>
                  <td className="max-w-[14rem] truncate px-4 py-2.5 font-ethiopic">{party(l)}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-muted-foreground">
                    {who(l.created_by)}
                  </td>
                  <td className="px-4 py-2.5">
                    <StatusBadge status={l.status} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <div className="flex items-center justify-end gap-2 text-sm">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
          >
            {t("Previous", "ቀዳሚ")}
          </Button>
          <span className="tabular-nums text-muted-foreground">
            {page + 1} / {pages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= pages - 1}
            onClick={() => setPage((p) => p + 1)}
          >
            {t("Next", "ቀጣይ")}
          </Button>
        </div>
      )}
    </div>
  );
}

function IncomingDialog({
  me,
  open,
  onOpenChange,
}: {
  me: Me;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { t } = useT();
  const qc = useQueryClient();
  const [form, setForm] = useState({
    sender: "",
    theirRef: "",
    received: todayAddisIso(),
    subject: "",
    assigned: "",
  });
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const filePath = file
        ? await uploadOrgFile("incoming-letters", me.org.id, file, "incoming")
        : "";
      const { error } = await supabase.rpc("register_incoming", {
        _sender: form.sender,
        _their_ref: form.theirRef,
        _received: form.received,
        _subject: form.subject,
        _file_url: filePath,
        _assigned: form.assigned,
        _eth_year: isoToEthYear(form.received),
      });
      if (error) throw error;
      toast.success(t("Incoming letter registered", "ገቢ ደብዳቤው ተመዝግቧል"));
      qc.invalidateQueries({ queryKey: ["letters"] });
      setForm({ sender: "", theirRef: "", received: todayAddisIso(), subject: "", assigned: "" });
      setFile(null);
      onOpenChange(false);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("Register incoming letter", "ገቢ ደብዳቤ መዝግብ")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-3">
          <Field
            id="in-sender"
            label={t("From (sender)", "ላኪ")}
            value={form.sender}
            onChange={set("sender")}
            required
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              id="in-ref"
              label={t("Their reference no.", "የላኪው ቁጥር")}
              value={form.theirRef}
              onChange={set("theirRef")}
            />
            <div className="grid gap-1.5">
              <Label htmlFor="in-date">{t("Date received", "የደረሰበት ቀን")}</Label>
              <Input
                id="in-date"
                type="date"
                value={form.received}
                onChange={set("received")}
                required
              />
              <span className="font-ethiopic text-xs text-muted-foreground">
                {isoToEthiopianString(form.received)}
              </span>
            </div>
          </div>
          <Field
            id="in-subject"
            label={t("Subject", "ጉዳይ")}
            value={form.subject}
            onChange={set("subject")}
            required
          />
          <Field
            id="in-assigned"
            label={t("Assigned to", "የተመደበለት")}
            value={form.assigned}
            onChange={set("assigned")}
          />
          <div className="grid gap-1.5">
            <Label htmlFor="in-file">
              {t("Scanned letter (PDF or image, optional)", "የተቃኘ ደብዳቤ (PDF ወይም ምስል፣ አማራጭ)")}
            </Label>
            <Input
              id="in-file"
              type="file"
              accept="application/pdf,image/*"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={busy}>
              {busy && <Loader2 className="animate-spin" />}
              {t("Register", "መዝግብ")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  id,
  label,
  ...props
}: { id: string; label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} className="font-ethiopic" {...props} />
    </div>
  );
}
