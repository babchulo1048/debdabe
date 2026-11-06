import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  BrainCircuit,
  CheckCircle2,
  CircleDashed,
  Loader2,
  Search,
  Sparkles,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { AppShell, PageTitle } from "@/components/AppShell";
import { LetterSheet, ScaledSheet } from "@/components/LetterSheet";
import { missingSender, SenderFields } from "@/components/SenderFields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import {
  asFields,
  logEvent,
  useContacts,
  useSignatories,
  useTemplates,
  type Me,
  type TemplateRow,
} from "@/lib/data";
import { isoToEthiopianString, todayAddisIso } from "@/lib/ethiopianCalendar";
import { useT } from "@/lib/i18n";
import {
  defaultSender,
  fillTemplate,
  writeSender,
  type Recipient,
  type Sender,
  type TemplateField,
} from "@/lib/letters";
import {
  callModel,
  loadEngineSettings,
  mapPrediction,
  pingModel,
  saveEngineSettings,
  type Engine,
  type ModelPrediction,
} from "@/lib/modelEngine";
import { understandRequest, understandWith } from "@/lib/smartRequest";

export const Route = createFileRoute("/letters/new")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>): { tab?: "ai" | "templates" } =>
    s["tab"] === "ai" || s["tab"] === "templates" ? { tab: s["tab"] } : {},
  head: () => ({ meta: [{ title: "New letter · Debdabe" }] }),
  component: NewLetterPage,
});

function NewLetterPage() {
  const { t } = useT();
  const { tab } = Route.useSearch();
  return (
    <AppShell>
      {(me) => (
        <>
          <PageTitle
            title={t("New letter", "አዲስ ደብዳቤ")}
            sub={t(
              "Describe the letter in one sentence, or start from a ready template.",
              "ደብዳቤውን በአንድ ዓረፍተ ነገር ይግለጹ፣ ወይም ከተዘጋጀ አብነት ይጀምሩ።",
            )}
          />
          <Tabs defaultValue={tab === "templates" ? "templates" : "ai"}>
            <TabsList>
              <TabsTrigger value="ai">
                <Sparkles className="mr-1 size-4" />
                {t("Describe your letter", "ደብዳቤዎን ይግለጹ")}
              </TabsTrigger>
              <TabsTrigger value="templates">{t("Templates", "አብነቶች")}</TabsTrigger>
            </TabsList>
            <TabsContent value="templates" className="mt-4">
              <TemplateGallery me={me} />
            </TabsContent>
            <TabsContent value="ai" className="mt-4">
              <SmartForm me={me} />
            </TabsContent>
          </Tabs>
        </>
      )}
    </AppShell>
  );
}

function useCreateDraft(me: Me) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const signatories = useSignatories();
  return async (row: {
    template_id?: string;
    source: "template" | "ai" | "manual";
    subject: string;
    body: string[];
    recipient?: Json;
    cc?: string[];
    field_values?: Record<string, string>;
    signatory_id?: string | null;
    ai_prompt?: string;
    ai_output?: Json;
  }) => {
    const { data, error } = await supabase
      .from("letters")
      .insert({
        organization_id: me.org.id,
        direction: "outgoing",
        source: row.source,
        template_id: row.template_id ?? null,
        subject: row.subject,
        body: row.body,
        recipient: row.recipient ?? {},
        cc: row.cc ?? [],
        field_values: row.field_values ?? {},
        signatory_id:
          row.signatory_id !== undefined ? row.signatory_id : (signatories.data?.[0]?.id ?? null),
        letter_date: todayAddisIso(),
        created_by: me.userId,
        ai_prompt: row.ai_prompt ?? null,
        ai_output: row.ai_output ?? null,
      })
      .select("id")
      .single();
    if (error) throw error;
    await logEvent(data.id, me.org.id, "created");
    qc.invalidateQueries({ queryKey: ["letters"] });
    navigate({ to: "/letters/$id/edit", params: { id: data.id } });
    return data.id;
  };
}

function TemplateGallery({ me }: { me: Me }) {
  const { t, lang } = useT();
  const templates = useTemplates();
  const createDraft = useCreateDraft(me);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string>("all");
  const [busy, setBusy] = useState<string | null>(null);

  const active = useMemo(() => (templates.data ?? []).filter((x) => x.is_active), [templates.data]);
  const categories = useMemo(() => Array.from(new Set(active.map((x) => x.category))), [active]);
  const shown = active.filter(
    (x) =>
      (cat === "all" || x.category === cat) &&
      (!q || `${x.title_am} ${x.title_en} ${x.subject_am}`.toLowerCase().includes(q.toLowerCase())),
  );

  async function use(tpl: TemplateRow) {
    setBusy(tpl.id);
    try {
      const fields = asFields(tpl.fields);
      await createDraft({
        template_id: tpl.id,
        source: "template",
        subject: tpl.subject_am,
        body: [fillTemplate(tpl.body_am, fields, {})],
      });
    } catch (e) {
      toast.error((e as Error).message);
      setBusy(null);
    }
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-xs">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            aria-label={t("Search templates", "አብነቶችን ፈልግ")}
            placeholder={t("Search templates", "አብነቶችን ፈልግ")}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-8"
          />
        </div>
        {["all", ...categories].map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCat(c)}
            className={`rounded-full border px-3 py-1 text-xs ${cat === c ? "border-primary bg-primary-soft font-medium" : "text-muted-foreground"}`}
          >
            {c === "all" ? t("All", "ሁሉም") : c}
          </button>
        ))}
      </div>

      {templates.isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-36" />
          ))}
        </div>
      ) : shown.length === 0 ? (
        <p className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
          {t("No templates match.", "የሚዛመድ አብነት የለም።")}
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((tpl) => (
            <article key={tpl.id} className="flex flex-col gap-2 rounded-lg border bg-card p-4">
              <span className="w-fit rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                {tpl.category}
              </span>
              <h3 className="font-ethiopic text-base">{tpl.title_am}</h3>
              <p className="text-sm text-muted-foreground">{tpl.title_en}</p>
              <p className="line-clamp-2 font-ethiopic text-sm text-muted-foreground">
                ጉዳዩ፡ {tpl.subject_am}
              </p>
              <Button
                className="mt-auto"
                size="sm"
                disabled={busy !== null}
                onClick={() => use(tpl)}
              >
                {busy === tpl.id && <Loader2 className="animate-spin" />}
                {lang === "am" ? "አብነቱን ተጠቀም" : "Use template"}
              </Button>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

const EXAMPLES = [
  "ለኢትዮጵያ ንግድ ባንክ ቦሌ ቅርንጫፍ፣ የድርጅታችን ሠራተኛ አቶ አበበ ከበደ በሂሳብ ሠራተኛ የሥራ መደብ ላይ ወርሃዊ ደመወዝ ብር 18,500 መሆኑን ለብድር አገልግሎት የሚያረጋግጥ ደብዳቤ",
  "ሠራተኛዋ ወ/ሮ ሰላም ተስፋዬ ከህዳር 10 እስከ ህዳር 20 ቀን 2019 ዓ.ም የዓመት ፈቃድ",
  "ለሁሉም የክፍል ኃላፊዎች ህዳር 5 ቀን 2019 ዓ.ም ከጠዋቱ 3:00 ሰዓት በዋናው አዳራሽ ስብሰባ",
  "ለናሙና አቅራቢ ኃ.የተ.የግ.ማ በደረሰኝ ቁጥር 00451 ያልተከፈለ ብር 45,000 ክፍያ እንዲፈጽሙ",
  "ለሚመለከተው ሁሉ፣ ወ/ሪት ትዕግሥት አለሙ በሽያጭ ባለሙያነት የሥራ ልምድ ማረጋገጫ",
];

function SmartForm({ me }: { me: Me }) {
  const { t, lang } = useT();
  const templates = useTemplates();
  const contacts = useContacts();
  const createDraft = useCreateDraft(me);
  const signatories = useSignatories();
  const [text, setText] = useState("");
  const [submitted, setSubmitted] = useState("");
  // Letterhead + signer: from Settings until the user changes them for this letter.
  const [signatoryId, setSignatoryId] = useState<string | null | undefined>(undefined);
  const [senderEdit, setSenderEdit] = useState<Sender | null>(null);
  const signatoryList = signatories.data ?? [];
  const chosenSignatoryId =
    signatoryId === undefined ? (signatoryList[0]?.id ?? null) : signatoryId;
  const signatory = signatoryList.find((x) => x.id === chosenSignatoryId) ?? null;
  const sender = senderEdit ?? defaultSender(me.org, signatory);
  const senderMissing = missingSender(sender);
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [{ engine, url }, setSettings] = useState(loadEngineSettings);
  const [modelPred, setModelPred] = useState<ModelPrediction | null>(null);
  const [modelBusy, setModelBusy] = useState(false);
  const [modelError, setModelError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const active = useMemo(
    () =>
      (templates.data ?? [])
        .filter((x) => x.is_active)
        .map((x) => ({ ...x, fields: asFields(x.fields) })),
    [templates.data],
  );
  const contactList = useMemo(() => contacts.data ?? [], [contacts.data]);

  /** What the rules (version 0) say: the result in rules mode, a comparison in model mode. */
  const rules = useMemo(() => {
    if (!submitted) return null;
    const picked = pickedId ? active.find((x) => x.id === pickedId) : undefined;
    return picked
      ? understandWith(submitted, picked, contactList)
      : understandRequest(submitted, active, contactList);
  }, [submitted, pickedId, active, contactList]);

  const model = useMemo(
    () =>
      modelPred ? mapPrediction(modelPred, active, contactList, todayAddisIso(), pickedId) : null,
    [modelPred, active, contactList, pickedId],
  );
  // If the model can't be reached, fall back to the rules so the user can still make a letter.
  const fallback = engine === "model" && !!modelError;
  const useModel = engine === "model" && !fallback;
  const result = useModel ? model : rules;

  // What the user typed into the fields on the result card (overrides what was understood).
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [recipientEdit, setRecipientEdit] = useState<Recipient | null>(null);
  useEffect(() => {
    setEdits({});
    setRecipientEdit(null);
  }, [submitted, pickedId, modelPred, engine]);

  const values = useMemo(() => {
    const merged: Record<string, string> = { ...(result?.values ?? {}), ...edits };
    for (const k of Object.keys(merged)) if (!merged[k]?.trim()) delete merged[k];
    return merged;
  }, [result, edits]);
  const recipient: Recipient | null =
    recipientEdit && recipientEdit.name?.trim()
      ? recipientEdit
      : recipientEdit
        ? null
        : (result?.recipient ?? null);
  const filledCount = result ? result.template.fields.filter((f) => values[f.key]).length : 0;

  function editRecipient(name: string) {
    const c = contactList.find((x) => x.type === "recipient" && x.name === name);
    const cur = recipientEdit ?? result?.recipient ?? {};
    setRecipientEdit(
      c
        ? { name: c.name, title: c.title ?? "", city: c.city ?? "" }
        : { name, title: cur.title ?? "", city: cur.city ?? "" },
    );
  }

  function editRecipientPart(part: "title" | "city", v: string) {
    setRecipientEdit({ ...(recipientEdit ?? result?.recipient ?? { name: "" }), [part]: v });
  }

  function setEngine(next: Engine, nextUrl = url) {
    saveEngineSettings(next, nextUrl);
    setSettings({ engine: next, url: nextUrl });
    setModelPred(null);
    setModelError(null);
    setSubmitted("");
  }

  async function checkConnection() {
    setStatus(null);
    try {
      setStatus(`✅ ${await pingModel(url)}`);
    } catch (err) {
      setStatus(`❌ ${(err as Error).message}`);
    }
  }

  async function run(request: string) {
    const q = request.trim();
    if (!q) return;
    setPickedId(null);
    setSubmitted(q);
    if (engine !== "model") return;
    setModelPred(null);
    setModelError(null);
    setModelBusy(true);
    try {
      setModelPred(await callModel(url, q));
    } catch (err) {
      setModelError((err as Error).message);
    } finally {
      setModelBusy(false);
    }
  }

  const label = (f: TemplateField) => (lang === "am" ? f.label_am : f.label_en);
  const title = (x: { title_am: string; title_en: string }) =>
    lang === "am" ? x.title_am : x.title_en;

  function understand(e?: React.FormEvent) {
    e?.preventDefault();
    void run(text);
  }

  async function create() {
    if (!result) return;
    setBusy(true);
    try {
      const tpl = result.template;
      const body = [fillTemplate(tpl.body_am, tpl.fields, values)];
      const output = {
        engine: useModel ? `model-${modelPred?.model ?? "unknown"}` : "rules-v0",
        ...(useModel && modelPred ? { model: modelPred } : {}),
        template_id: tpl.id,
        values: result.values,
        recipient: result.recipient,
        // What the user corrected or added before creating: useful for training later.
        user_edits: { values: edits, recipient: recipientEdit },
        subject: tpl.subject_am,
        body_paragraphs: body,
      };
      const id = await createDraft({
        template_id: tpl.id,
        source: "ai",
        subject: tpl.subject_am,
        body,
        field_values: writeSender(values, sender),
        signatory_id: chosenSignatoryId,
        ...(recipient ? { recipient } : {}),
        ai_prompt: submitted,
        ai_output: output,
      });
      // Every request + what we understood is kept: this log is the future training set.
      await supabase.from("ai_generations").insert({
        organization_id: me.org.id,
        user_id: me.userId,
        letter_id: id,
        prompt: submitted,
        output,
        mock: false,
      });
    } catch (err) {
      toast.error((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-4 [&>*:not(section)]:max-w-[760px]">
      <form onSubmit={understand} className="grid gap-3 rounded-lg border bg-card p-5">
        <details className="order-last text-xs text-muted-foreground">
          <summary className="w-fit cursor-pointer select-none">
            {t("Engine:", "ሞተር፡")}{" "}
            {engine === "rules" ? t("Rules (v0)", "ህጎች (v0)") : t("Model", "ሞዴል")}
            {engine === "model" && !url && ` · ${t("no link set", "ሊንክ አልተሰጠም")}`}
          </summary>
          <div className="mt-2 flex flex-wrap items-center gap-2 rounded-md border border-dashed p-2">
            {(["rules", "model"] as const).map((e) => (
              <button
                key={e}
                type="button"
                aria-pressed={engine === e}
                onClick={() => setEngine(e)}
                className={`rounded px-2.5 py-1 ${engine === e ? "bg-primary text-primary-foreground" : "border text-muted-foreground"}`}
              >
                {e === "rules" ? t("Rules (v0)", "ህጎች (v0)") : t("Model", "ሞዴል")}
              </button>
            ))}
            {engine === "model" && (
              <>
                <Input
                  aria-label={t("Model link", "የሞዴል ሊንክ")}
                  placeholder="https://….trycloudflare.com"
                  value={url}
                  onChange={(e) => setSettings({ engine, url: e.target.value })}
                  onBlur={() => saveEngineSettings(engine, url)}
                  className="h-7 min-w-[240px] flex-1 font-mono text-xs"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7"
                  onClick={checkConnection}
                >
                  {t("Check", "አረጋግጥ")}
                </Button>
                {status && <span className="w-full text-muted-foreground">{status}</span>}
              </>
            )}
          </div>
        </details>
        <Label htmlFor="smart-text">
          {t(
            "What letter do you need? One sentence is enough.",
            "ምን ዓይነት ደብዳቤ ይፈልጋሉ? አንድ ዓረፍተ ነገር በቂ ነው።",
          )}
        </Label>
        <Textarea
          id="smart-text"
          rows={4}
          required
          minLength={3}
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="font-ethiopic"
          placeholder="ለኢትዮጵያ ንግድ ባንክ፣ አቶ አበበ ከበደ ወርሃዊ ደመወዝ ብር 18,500 መሆኑን የሚያረጋግጥ ደብዳቤ"
        />
        <div className="flex flex-wrap gap-1.5">
          <span className="text-xs text-muted-foreground">{t("Try:", "ይሞክሩ፡")}</span>
          {EXAMPLES.map((ex, i) => (
            <button
              key={i}
              type="button"
              onClick={() => {
                setText(ex);
                void run(ex);
              }}
              className="max-w-[220px] truncate rounded-full border px-2.5 py-0.5 font-ethiopic text-xs text-muted-foreground hover:border-primary hover:text-foreground"
            >
              {ex}
            </button>
          ))}
        </div>
        <Button type="submit" className="w-fit" disabled={modelBusy}>
          {modelBusy ? <Loader2 className="animate-spin" /> : <Sparkles />}
          {t("Understand request", "ጥያቄውን ተረዳ")}
        </Button>
      </form>

      {fallback && (
        <div className="flex gap-2 rounded-lg border border-destructive/40 bg-card p-4 text-sm">
          <AlertTriangle className="size-4 shrink-0 text-destructive" />
          <div>
            <p className="font-medium">
              {t(
                "The model is offline right now, so the simple rules (v0) answered instead.",
                "ሞዴሉ አሁን አይገኝም፤ ስለዚህ ቀላሎቹ ህጎች (v0) መለሱ።",
              )}
            </p>
            <p className="mt-1 text-muted-foreground">
              {t(
                "Results may be weaker. Try again later for the model.",
                "ውጤቱ ደካማ ሊሆን ይችላል። ሞዴሉን በኋላ እንደገና ይሞክሩ።",
              )}{" "}
              <span className="text-xs">({modelError})</span>
            </p>
          </div>
        </div>
      )}

      {submitted && !result && !modelBusy && !(useModel && !modelPred) && (
        <div className="rounded-lg border bg-card p-5 text-sm">
          <p className="font-medium">
            {useModel && modelPred
              ? t(
                  `The model says this is not one of our letter types (${Math.round(modelPred.confidence * 100)}% sure).`,
                  `ሞዴሉ ይህ ከደብዳቤ ዓይነቶቻችን አንዱ አይደለም ይላል (${Math.round(modelPred.confidence * 100)}% እርግጠኛ)።`,
                )
              : t("I couldn't match this to a template.", "ይህን ከአብነት ጋር ማዛመድ አልቻልኩም።")}
          </p>
          <p className="mt-1 text-muted-foreground">
            {t(
              "Mention the letter type (salary confirmation, leave, meeting, payment, quotation, work experience) or pick a template from the Templates tab.",
              "የደብዳቤውን ዓይነት ይጥቀሱ (የደመወዝ ማረጋገጫ፣ ፈቃድ፣ ስብሰባ፣ ክፍያ፣ የዋጋ ማቅረቢያ፣ የሥራ ልምድ) ወይም ከአብነቶች ይምረጡ።",
            )}
          </p>
        </div>
      )}

      {result && (
        <section className="grid gap-4 rounded-lg border bg-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                {t("Letter type", "የደብዳቤ ዓይነት")}
              </p>
              <h3 className="font-ethiopic text-lg">{title(result.template)}</h3>
              {useModel && model && (
                <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <BrainCircuit className="size-3.5" />
                  {t("Model", "ሞዴል")} · {Math.round(model.confidence * 100)}% {t("sure", "እርግጠኛ")}
                  <span>
                    · {t("Rules (v0) would pick:", "ህጎቹ (v0) የሚመርጡት፡")}{" "}
                    {rules ? title(rules.template) : t("nothing", "ምንም")}
                  </span>
                </p>
              )}
            </div>
            {active.length > 1 && (
              <select
                aria-label={t("Choose another letter type", "ሌላ ዓይነት ይምረጡ")}
                className="rounded-md border bg-background px-2 py-1 text-sm"
                value={result.template.id}
                onChange={(e) => setPickedId(e.target.value)}
              >
                {active.map((x) => (
                  <option key={x.id} value={x.id}>
                    {title(x)}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start">
            <div className="grid content-start gap-4">
              <datalist id="smart-contacts">
                {contactList
                  .filter((c) => c.type === "recipient")
                  .map((c) => (
                    <option key={c.id} value={c.name} />
                  ))}
              </datalist>
              <div className="grid gap-3 text-sm">
                <p className="text-xs text-muted-foreground">
                  {t(
                    "Check what was understood, fill in what's missing (optional), then create the letter.",
                    "የተረዳውን ያረጋግጡ፣ የጎደለውን ይሙሉ (አማራጭ)፣ ከዚያ ደብዳቤውን ይፍጠሩ።",
                  )}
                </p>
                <FieldRow
                  id="smart-recipient"
                  label={t("Recipient", "ተቀባይ")}
                  filled={!!recipient?.name}
                >
                  <Input
                    id="smart-recipient"
                    list="smart-contacts"
                    className="h-9 font-ethiopic"
                    placeholder="[ተቀባይ]"
                    value={
                      recipientEdit ? (recipientEdit.name ?? "") : (result.recipient?.name ?? "")
                    }
                    onChange={(e) => editRecipient(e.target.value)}
                  />
                </FieldRow>
                <FieldRow
                  id="smart-recipient-title"
                  label={t("Recipient title / branch", "የተቀባይ ማዕረግ / ቅርንጫፍ")}
                  filled={!!(recipientEdit ?? result.recipient)?.title}
                >
                  <Input
                    id="smart-recipient-title"
                    className="h-9 font-ethiopic"
                    placeholder={t("optional", "አማራጭ")}
                    value={(recipientEdit ?? result.recipient)?.title ?? ""}
                    onChange={(e) => editRecipientPart("title", e.target.value)}
                  />
                </FieldRow>
                <FieldRow
                  id="smart-recipient-city"
                  label={t("City", "ከተማ")}
                  filled={!!(recipientEdit ?? result.recipient)?.city}
                >
                  <Input
                    id="smart-recipient-city"
                    className="h-9 font-ethiopic"
                    placeholder={t("optional", "አማራጭ")}
                    value={(recipientEdit ?? result.recipient)?.city ?? ""}
                    onChange={(e) => editRecipientPart("city", e.target.value)}
                  />
                </FieldRow>
                {result.template.fields.map((f) => {
                  const v = values[f.key] ?? "";
                  return (
                    <FieldRow key={f.key} id={`smart-${f.key}`} label={label(f)} filled={!!v}>
                      <div className="flex flex-wrap items-center gap-2">
                        <Input
                          id={`smart-${f.key}`}
                          type={
                            f.type === "date"
                              ? "date"
                              : f.type === "number" || f.type === "money"
                                ? "number"
                                : "text"
                          }
                          step={f.type === "money" ? "0.01" : undefined}
                          className="h-9 min-w-0 flex-1 font-ethiopic"
                          placeholder={`[${f.label_am}]`}
                          value={v}
                          onChange={(e) => setEdits((x) => ({ ...x, [f.key]: e.target.value }))}
                        />
                        {f.type === "date" && v && (
                          <span className="font-ethiopic text-xs text-muted-foreground">
                            {isoToEthiopianString(v)}
                          </span>
                        )}
                      </div>
                    </FieldRow>
                  );
                })}
              </div>

              <div className="grid gap-3 rounded-md border p-3">
                <p className="flex items-center gap-2 text-sm font-medium">
                  {senderMissing.length ? (
                    <CircleDashed className="size-4 text-warning" />
                  ) : (
                    <CheckCircle2 className="size-4 text-success" />
                  )}
                  {t("From (letterhead and signature)", "ከ (ራስጌ እና ፊርማ)")}
                </p>
                <SenderFields
                  idPrefix="smart-sender"
                  sender={sender}
                  onChange={setSenderEdit}
                  signatories={signatoryList}
                  signatoryId={chosenSignatoryId}
                  onSignatoryChange={setSignatoryId}
                />
              </div>

              {useModel && model && model.unconverted.length > 0 && (
                <div className="rounded-md border border-warning/50 p-3 text-sm">
                  <p className="font-medium">
                    {t("Found, but couldn't turn into a field:", "ተገኝቷል፣ ግን ወደ መስክ መቀየር አልተቻለም፡")}
                  </p>
                  <ul className="mt-1 list-disc pl-5 font-ethiopic text-muted-foreground">
                    {model.unconverted.map((u) => (
                      <li key={u.field.key}>
                        {label(u.field)}: “{u.raw}” — {t("set it in the editor", "በአርታዒው ያስገቡ")}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {useModel && model && (
                <details className="text-xs text-muted-foreground">
                  <summary className="cursor-pointer">
                    {t("What the model marked in your sentence", "ሞዴሉ በዓረፍተ ነገርዎ ውስጥ ምልክት ያደረገው")}
                  </summary>
                  <dl className="mt-2 grid grid-cols-[8rem_1fr] gap-1 font-ethiopic">
                    {Object.entries(model.rawFacts).map(([k, v]) => (
                      <div key={k} className="contents">
                        <dt className="font-mono">{k}</dt>
                        <dd>{v}</dd>
                      </div>
                    ))}
                  </dl>
                </details>
              )}

              <div className="flex flex-wrap items-center gap-3">
                <Button onClick={create} disabled={busy}>
                  {busy ? <Loader2 className="animate-spin" /> : <ArrowRight />}
                  {t("Create letter", "ደብዳቤውን ፍጠር")}
                </Button>
                <p className="text-xs text-muted-foreground">
                  {filledCount < result.template.fields.length
                    ? t(
                        `${filledCount} of ${result.template.fields.length} details filled. You can create it now; empty ones stay as [placeholders] to fill later in the editor.`,
                        `ከ${result.template.fields.length} ዝርዝሮች ${filledCount}ቱ ተሞልተዋል። አሁን መፍጠር ይችላሉ፤ ባዶዎቹ እንደ [ቦታ ያዥ] ይቆያሉ፣ በኋላ በአርታዒው ይሞላሉ።`,
                      )
                    : t("All details filled.", "ሁሉም ዝርዝሮች ተሞልተዋል።")}
                </p>
              </div>
            </div>
            <div className="grid gap-2 lg:sticky lg:top-20">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                {t("Preview", "ቅድመ እይታ")}
              </p>
              <div className="overflow-hidden rounded-md border bg-muted/40 p-2 sm:p-3">
                <ScaledSheet>
                  <LetterSheet
                    org={me.org}
                    letter={{
                      referenceNo: null,
                      dateIso: todayAddisIso(),
                      recipient: recipient ?? {},
                      subject: result.template.subject_am,
                      body: [fillTemplate(result.template.body_am, result.template.fields, values)],
                      cc: [],
                      signatory,
                      sender,
                    }}
                  />
                </ScaledSheet>
              </div>
            </div>
          </div>
        </section>
      )}

      <p className="text-xs text-muted-foreground">
        {t(
          "Only facts you typed are used; nothing is invented. The wording comes from your approved templates.",
          "የጻፉት መረጃ ብቻ ጥቅም ላይ ይውላል፤ ምንም አይፈጠርም። አጻጻፉ ከጸደቁ አብነቶችዎ ይመጣል።",
        )}
      </p>
    </div>
  );
}

/** One "understood" field: status icon, label, input. Stacks on small screens. */
function FieldRow({
  id,
  label,
  filled,
  children,
}: {
  id: string;
  label: string;
  filled: boolean;
  children: ReactNode;
}) {
  return (
    <div className="grid grid-cols-[1.25rem_minmax(0,1fr)] items-center gap-x-2 gap-y-1 sm:grid-cols-[1.25rem_10rem_minmax(0,1fr)]">
      {filled ? (
        <CheckCircle2 className="size-4 text-success" />
      ) : (
        <CircleDashed className="size-4 text-muted-foreground" />
      )}
      <Label htmlFor={id} className="font-normal text-muted-foreground">
        {label}
      </Label>
      <div className="col-start-2 sm:col-start-3">{children}</div>
    </div>
  );
}
