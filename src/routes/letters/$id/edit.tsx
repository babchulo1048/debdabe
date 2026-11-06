import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Copy, FileDown, Loader2, Lock, Printer, Save, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { AppShell, StatusBadge } from "@/components/AppShell";
import { LetterSheet, ScaledSheet, type LetterContent } from "@/components/LetterSheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import {
  asFields,
  asRecipient,
  asRecord,
  asStrings,
  isAdmin,
  useContacts,
  useLetter,
  useSignatories,
  useTemplates,
  type LetterRow,
  type Me,
} from "@/lib/data";
import { isoToEthiopianString, isoToEthYear } from "@/lib/ethiopianCalendar";
import { useT } from "@/lib/i18n";
import { duplicateLetter, exportDocx, printLetter } from "@/lib/letterActions";
import {
  defaultSender,
  editRatio,
  fillTemplate,
  readSender,
  writeSender,
  type Recipient,
  type Sender,
  type TemplateField,
} from "@/lib/letters";
import { SenderFields } from "@/components/SenderFields";

export const Route = createFileRoute("/letters/$id/edit")({
  ssr: false,
  head: () => ({ meta: [{ title: "Edit letter · Debdabe" }] }),
  component: EditPage,
});

function EditPage() {
  const { id } = Route.useParams();
  const letter = useLetter(id);
  return (
    <AppShell>
      {(me) =>
        letter.isLoading ? (
          <Skeleton className="h-[600px]" />
        ) : !letter.data ? (
          <p className="text-muted-foreground">Letter not found.</p>
        ) : (
          <Editor key={letter.data.updated_at} me={me} letter={letter.data} />
        )
      }
    </AppShell>
  );
}

const splitParas = (s: string) =>
  s
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

function Editor({ me, letter }: { me: Me; letter: LetterRow }) {
  const { t, lang } = useT();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const templates = useTemplates();
  const signatories = useSignatories();
  const contacts = useContacts();

  const template = templates.data?.find((x) => x.id === letter.template_id) ?? null;
  const fields: TemplateField[] = useMemo(() => asFields(template?.fields), [template]);

  const locked = letter.status === "final";
  const [subject, setSubject] = useState(letter.subject);
  const [bodyText, setBodyText] = useState(asStrings(letter.body).join("\n\n"));
  const [bodyTouched, setBodyTouched] = useState(
    !(letter.template_id && (letter.source === "template" || letter.source === "ai")),
  );
  const [values, setValues] = useState<Record<string, string>>(asRecord(letter.field_values));
  const [recipient, setRecipient] = useState<Recipient>(asRecipient(letter.recipient));
  const [cc, setCc] = useState<string[]>(asStrings(letter.cc));
  const [ccInput, setCcInput] = useState("");
  const [signatoryId, setSignatoryId] = useState<string | null>(letter.signatory_id);
  const [dateIso, setDateIso] = useState(letter.letter_date);
  // Letterhead + signer for this letter: stored values, else Settings (until the user edits).
  const [senderEdit, setSenderEdit] = useState<Sender | null>(null);
  const signatory = signatories.data?.find((s) => s.id === signatoryId) ?? null;
  const sender = senderEdit ?? readSender(values, defaultSender(me.org, signatory));
  const [busy, setBusy] = useState<null | "save" | "final">(null);

  // While the user hasn't edited the body by hand, it follows the template fields.
  useEffect(() => {
    if (template && !bodyTouched) setBodyText(fillTemplate(template.body_am, fields, values));
  }, [template, fields, values, bodyTouched]);

  const content: LetterContent = {
    referenceNo: letter.reference_no,
    dateIso,
    recipient,
    subject,
    body: splitParas(bodyText),
    cc,
    signatory,
    sender,
  };

  const recipients = (contacts.data ?? []).filter((c) => c.type === "recipient");
  const ccContacts = (contacts.data ?? []).filter((c) => c.type === "cc");

  async function save(quiet = false) {
    const { error } = await supabase
      .from("letters")
      .update({
        subject,
        body: content.body,
        recipient,
        cc,
        field_values: writeSender(values, sender),
        signatory_id: signatoryId,
        letter_date: dateIso,
        updated_at: new Date().toISOString(),
      })
      .eq("id", letter.id);
    if (error) throw error;
    if (!quiet) toast.success(t("Draft saved", "ረቂቁ ተቀምጧል"));
  }

  async function onSave() {
    setBusy("save");
    try {
      await save();
      qc.invalidateQueries({ queryKey: ["letters"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function onFinalize() {
    const missing = fields.filter((f) => f.required && !values[f.key]);
    if (missing.length) {
      toast.error(
        t(
          `Fill in: ${missing.map((f) => f.label_en).join(", ")}`,
          `ይሙሉ፡ ${missing.map((f) => f.label_am).join("፣ ")}`,
        ),
      );
      return;
    }
    if (!recipient.name) {
      toast.error(t("Add a recipient first.", "መጀመሪያ ተቀባይ ያክሉ።"));
      return;
    }
    setBusy("final");
    try {
      await save(true);
      if (letter.source === "ai") {
        const before = asStrings(
          (letter.ai_output as { body_paragraphs?: string[] } | null)?.body_paragraphs ?? [],
        ).join("\n\n");
        const ratio = editRatio(before, content.body.join("\n\n"));
        await supabase.from("letters").update({ edit_ratio: ratio }).eq("id", letter.id);
        await supabase
          .from("ai_generations")
          .update({ final_text: content.body.join("\n\n"), edit_ratio: ratio })
          .eq("letter_id", letter.id);
      }
      const { data: ref, error } = await supabase.rpc("finalize_letter", {
        _letter: letter.id,
        _eth_year: isoToEthYear(dateIso),
      });
      if (error) {
        if (error.message.includes("PLAN_LIMIT")) {
          toast.error(
            t(
              "Monthly letter limit reached. Upgrade your plan to finalize more letters.",
              "የወሩ የደብዳቤ ገደብ ደርሷል። ተጨማሪ ለማጠናቀቅ ዕቅድዎን ያሳድጉ።",
            ),
            {
              action: { label: t("Upgrade", "አሳድግ"), onClick: () => navigate({ to: "/billing" }) },
            },
          );
        } else throw error;
        return;
      }
      toast.success(t(`Finalized as ${ref}`, `በቁጥር ${ref} ተጠናቋል`));
      qc.invalidateQueries({ queryKey: ["letters"] });
      qc.invalidateQueries({ queryKey: ["usage"] });
      navigate({ to: "/letters/$id", params: { id: letter.id } });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function onDuplicate() {
    try {
      const newId = await duplicateLetter(letter, me.userId);
      qc.invalidateQueries({ queryKey: ["letters"] });
      navigate({ to: "/letters/$id/edit", params: { id: newId } });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  if (locked) {
    return (
      <div className="rounded-lg border bg-card p-8 text-center">
        <Lock className="mx-auto size-6 text-muted-foreground" />
        <p className="mt-2">
          {t("This letter is final and can't be edited.", "ይህ ደብዳቤ ተጠናቋል፣ ሊስተካከል አይችልም።")}
        </p>
        <div className="mt-4 flex justify-center gap-2">
          <Button asChild variant="outline">
            <Link to="/letters/$id" params={{ id: letter.id }}>
              {t("View letter", "ደብዳቤውን እይ")}
            </Link>
          </Button>
          <Button onClick={onDuplicate}>
            <Copy />
            {t("Duplicate as new draft", "እንደ አዲስ ረቂቅ ቅዳ")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-6 min-[900px]:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
      {/* ---------- Form ---------- */}
      <div className="grid content-start gap-5 print:hidden">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-xl">
            {template
              ? lang === "am"
                ? template.title_am
                : template.title_en
              : t("Letter", "ደብዳቤ")}
          </h1>
          <StatusBadge status={letter.status} />
          {letter.source === "ai" && (
            <span className="rounded-full bg-primary-soft px-2 py-0.5 text-xs">AI</span>
          )}
        </div>

        {fields.length > 0 && (
          <Section title={t("Letter details", "የደብዳቤው ዝርዝሮች")}>
            <div className="grid gap-3 sm:grid-cols-2">
              {fields.map((f) => (
                <div key={f.key} className="grid gap-1.5">
                  <Label htmlFor={`f-${f.key}`}>
                    {lang === "am" ? f.label_am : f.label_en}
                    {f.required && <span className="text-destructive"> *</span>}
                  </Label>
                  <Input
                    id={`f-${f.key}`}
                    type={
                      f.type === "date"
                        ? "date"
                        : f.type === "number" || f.type === "money"
                          ? "number"
                          : "text"
                    }
                    step={f.type === "money" ? "0.01" : undefined}
                    className="font-ethiopic"
                    value={values[f.key] ?? ""}
                    onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                  />
                  {f.type === "date" && values[f.key] && (
                    <span className="font-ethiopic text-xs text-muted-foreground">
                      {isoToEthiopianString(values[f.key])}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </Section>
        )}

        <Section title={t("Recipient (ለ)", "ተቀባይ (ለ)")}>
          {recipients.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {recipients.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() =>
                    setRecipient({ name: c.name, title: c.title ?? "", city: c.city ?? "" })
                  }
                  className="rounded-full border px-2.5 py-1 font-ethiopic text-xs hover:border-primary hover:bg-primary-soft"
                >
                  {c.name}
                </button>
              ))}
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-3">
            <LabeledInput
              id="r-name"
              label={t("Name / organisation", "ስም / ድርጅት")}
              value={recipient.name ?? ""}
              onChange={(v) => setRecipient((r) => ({ ...r, name: v }))}
            />
            <LabeledInput
              id="r-title"
              label={t("Title / branch", "ማዕረግ / ቅርንጫፍ")}
              value={recipient.title ?? ""}
              onChange={(v) => setRecipient((r) => ({ ...r, title: v }))}
            />
            <LabeledInput
              id="r-city"
              label={t("City", "ከተማ")}
              value={recipient.city ?? ""}
              onChange={(v) => setRecipient((r) => ({ ...r, city: v }))}
            />
          </div>
        </Section>

        <Section title={t("Content", "ይዘት")}>
          <LabeledInput
            id="subject"
            label={t("Subject (ጉዳዩ)", "ጉዳዩ")}
            value={subject}
            onChange={setSubject}
          />
          <div className="grid gap-1.5">
            <Label htmlFor="body">
              {t(
                "Body (leave a blank line between paragraphs)",
                "ዋና ጽሑፍ (በአንቀጾች መካከል ባዶ መስመር ይተዉ)",
              )}
            </Label>
            <Textarea
              id="body"
              rows={9}
              className="font-ethiopic leading-relaxed"
              value={bodyText}
              onChange={(e) => {
                setBodyTouched(true);
                setBodyText(e.target.value);
              }}
            />
            {template && bodyTouched && letter.source === "template" && (
              <button
                type="button"
                className="w-fit text-xs text-primary hover:underline"
                onClick={() => setBodyTouched(false)}
              >
                {t("Reset body to template", "ጽሑፉን ወደ አብነቱ መልስ")}
              </button>
            )}
          </div>
        </Section>

        <Section title={t("From (letterhead and signature)", "ከ (ራስጌ እና ፊርማ)")}>
          <SenderFields
            idPrefix="s"
            sender={sender}
            onChange={setSenderEdit}
            signatories={signatories.data ?? []}
            signatoryId={signatoryId}
            onSignatoryChange={setSignatoryId}
          />
        </Section>

        <Section title={t("Date and copies", "ቀን እና ግልባጭ")}>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="date">{t("Letter date", "የደብዳቤው ቀን")}</Label>
              <Input
                id="date"
                type="date"
                value={dateIso}
                onChange={(e) => e.target.value && setDateIso(e.target.value)}
              />
              <span className="font-ethiopic text-xs text-muted-foreground">
                {isoToEthiopianString(dateIso)}
              </span>
            </div>
          </div>
          <div className="grid gap-2">
            <Label>{t("Copies (ግልባጭ)", "ግልባጭ")}</Label>
            <div className="flex flex-wrap gap-1.5">
              {ccContacts.map((c) => {
                const on = cc.includes(c.name);
                return (
                  <button
                    key={c.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() =>
                      setCc((list) => (on ? list.filter((x) => x !== c.name) : [...list, c.name]))
                    }
                    className={`rounded-full border px-2.5 py-1 font-ethiopic text-xs ${on ? "border-primary bg-primary-soft" : ""}`}
                  >
                    {c.name}
                  </button>
                );
              })}
              {cc
                .filter((x) => !ccContacts.some((c) => c.name === x))
                .map((x) => (
                  <span
                    key={x}
                    className="flex items-center gap-1 rounded-full border border-primary bg-primary-soft px-2.5 py-1 font-ethiopic text-xs"
                  >
                    {x}
                    <button
                      type="button"
                      aria-label={`Remove ${x}`}
                      onClick={() => setCc((l) => l.filter((y) => y !== x))}
                    >
                      <X className="size-3" />
                    </button>
                  </span>
                ))}
            </div>
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const v = ccInput.trim();
                if (v && !cc.includes(v)) setCc((l) => [...l, v]);
                setCcInput("");
              }}
            >
              <Input
                aria-label={t("Add a copy recipient", "ግልባጭ ተቀባይ ያክሉ")}
                placeholder={t("Add another, e.g. ለማህደር", "ሌላ ያክሉ፣ ለምሳሌ ለማህደር")}
                className="font-ethiopic"
                value={ccInput}
                onChange={(e) => setCcInput(e.target.value)}
              />
              <Button type="submit" variant="outline">
                {t("Add", "አክል")}
              </Button>
            </form>
          </div>
        </Section>

        <div className="sticky bottom-0 flex flex-wrap gap-2 border-t bg-background/95 py-3 backdrop-blur">
          <Button variant="outline" onClick={onSave} disabled={busy !== null}>
            {busy === "save" ? <Loader2 className="animate-spin" /> : <Save />}
            {t("Save draft", "ረቂቅ አስቀምጥ")}
          </Button>
          <Button
            onClick={onFinalize}
            disabled={busy !== null || !isAdmin(me.role)}
            title={
              isAdmin(me.role)
                ? undefined
                : t("Only admins can finalize", "ማጠናቀቅ የሚችሉት አስተዳዳሪዎች ብቻ ናቸው")
            }
          >
            {busy === "final" ? <Loader2 className="animate-spin" /> : <Lock />}
            {t("Finalize & number", "አጠናቅ እና ቁጥር ስጥ")}
          </Button>
          <Button variant="ghost" onClick={() => printLetter(null, me.org.id)}>
            <Printer />
            {t("Print / PDF", "አትም / PDF")}
          </Button>
          <Button variant="ghost" onClick={() => exportDocx(me.org, content, null)}>
            <FileDown />
            DOCX
          </Button>
          <Button variant="ghost" onClick={onDuplicate}>
            <Copy />
            {t("Duplicate", "ቅዳ")}
          </Button>
        </div>
      </div>

      {/* ---------- Live A4 preview ---------- */}
      <div className="min-w-0 min-[900px]:sticky min-[900px]:top-20 min-[900px]:self-start">
        <p className="mb-2 text-xs text-muted-foreground print:hidden">
          {t("Live preview · A4", "ቀጥታ ቅድመ እይታ · A4")}
        </p>
        <ScaledSheet>
          <LetterSheet org={me.org} letter={content} />
        </ScaledSheet>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-3 rounded-lg border bg-card p-4">
      <h2 className="font-sans text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h2>
      {children}
    </section>
  );
}

function LabeledInput({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        className="font-ethiopic"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
