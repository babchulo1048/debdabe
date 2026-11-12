import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Copy, FileDown, Languages, Paperclip, Pencil, Printer } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { AppShell, StatusBadge } from "@/components/AppShell";
import { EnglishCheck, type EnglishRow } from "@/components/EnglishCheck";
import { LetterSheet, ScaledSheet } from "@/components/LetterSheet";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  asRecord,
  saveTranslations,
  useLetter,
  useLetterEvents,
  useSignatories,
  useTemplates,
  useTranslations,
  type LetterRow,
  type Me,
} from "@/lib/data";
import {
  amharicEdited,
  buildEnglish,
  englishItems,
  hasEthiopic,
  normalizeAm,
  suggestEnglish,
} from "@/lib/english";
import { formatGregorian, isoToEthiopianString } from "@/lib/ethiopianCalendar";
import { useT } from "@/lib/i18n";
import { duplicateLetter, exportDocx, printLetter, toContent } from "@/lib/letterActions";
import { useSignedUrl } from "@/lib/storage";

export const Route = createFileRoute("/letters/$id/")({
  ssr: false,
  head: () => ({ meta: [{ title: "Letter · Debdabe" }] }),
  // ?lang=en opens the English version directly (used by the editor's English button).
  validateSearch: (s: Record<string, unknown>): { lang?: "en" } =>
    s["lang"] === "en" ? { lang: "en" } : {},
  component: DetailPage,
});

const EVENT_LABEL: Record<string, [string, string]> = {
  created: ["Created", "ተፈጠረ"],
  edited: ["Edited", "ተስተካከለ"],
  finalized: ["Finalized", "ተጠናቀቀ"],
  printed: ["Printed", "ታተመ"],
  exported_docx: ["Downloaded DOCX", "DOCX ወረደ"],
};

function DetailPage() {
  const { id } = Route.useParams();
  const letter = useLetter(id);
  return (
    <AppShell>
      {(me) =>
        letter.isLoading ? (
          <Skeleton className="h-[600px]" />
        ) : letter.data ? (
          <Detail me={me} letter={letter.data} />
        ) : (
          <p>Letter not found.</p>
        )
      }
    </AppShell>
  );
}

function Detail({ me, letter }: { me: Me; letter: LetterRow }) {
  const { t } = useT();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const signatories = useSignatories();
  const events = useLetterEvents(letter.id);
  const fileUrl = useSignedUrl("incoming-letters", letter.file_url);
  const amharic = toContent(letter, signatories.data, me.org);
  const incoming = letter.direction === "incoming";
  const templates = useTemplates();
  const memory = useTranslations();
  const { lang: startLang } = Route.useSearch();
  const [lang, setLang] = useState<"am" | "en">(startLang ?? "am");
  const [typed, setTyped] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const template = templates.data?.find((x) => x.id === letter.template_id) ?? null;
  const values = asRecord(letter.field_values);
  const englishReady = !!template?.body_en?.trim();

  // English suggestion for every fact; what the user typed wins.
  const rows: EnglishRow[] = useMemo(() => {
    if (!template || !englishReady) return [];
    const mem = memory.data ?? new Map<string, string>();
    return englishItems({ template, values, content: amharic }).map((item) => {
      const s = suggestEnglish(item.am, item.kind, mem, item.preset);
      const own = typed[item.id];
      return own != null
        ? { ...item, ...s, value: own, edited: true }
        : { ...item, ...s, edited: false };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [template, englishReady, memory.data, typed, letter, signatories.data]);

  const showEnglish = lang === "en" && !!template && englishReady;
  const content = showEnglish
    ? buildEnglish(amharic, template, values, Object.fromEntries(rows.map((r) => [r.id, r.value])))
    : amharic;

  /** English words to remember: Amharic facts whose English isn't saved yet. */
  const toSave = rows
    .filter((r) => hasEthiopic(r.am) && r.value.trim() && r.source !== "settings")
    .map((r) => ({ source: normalizeAm(r.am), target: r.value.trim() }))
    .filter((p) => memory.data?.get(p.source) !== p.target);

  async function saveEnglish(quiet = false) {
    if (!toSave.length) return;
    setSaving(true);
    try {
      await saveTranslations(me.org.id, toSave);
      await qc.invalidateQueries({ queryKey: ["translations"] });
      setTyped({});
      if (!quiet) toast.success(t("English words saved", "የእንግሊዝኛ ቃላት ተቀምጠዋል"));
    } catch (e) {
      toast.error(
        t(
          `Couldn't save the English words: ${(e as Error).message}`,
          `የእንግሊዝኛ ቃላትን ማስቀመጥ አልተቻለም፡ ${(e as Error).message}`,
        ),
      );
    } finally {
      setSaving(false);
    }
  }

  /** Before printing or downloading the English letter, remember its words. */
  const beforeOutput = () => (showEnglish ? saveEnglish(true) : Promise.resolve());

  async function onDuplicate() {
    try {
      const newId = await duplicateLetter(letter, me.userId);
      qc.invalidateQueries({ queryKey: ["letters"] });
      navigate({ to: "/letters/$id/edit", params: { id: newId } });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  const meta: [string, React.ReactNode][] = [
    [t("Reference", "ቁጥር"), <span className="font-mono">{letter.reference_no ?? "—"}</span>],
    [
      t("Date", "ቀን"),
      `${isoToEthiopianString(letter.letter_date)} · ${formatGregorian(letter.letter_date)}`,
    ],
    ...(incoming
      ? ([
          [t("From", "ከ"), letter.sender ?? ""],
          [t("Their reference", "የእነሱ ቁጥር"), letter.their_reference ?? ""],
          [t("Assigned to", "የተመደበለት"), letter.assigned_to ?? ""],
        ] as [string, React.ReactNode][])
      : ([[t("To", "ለ"), amharic.recipient.name ?? ""]] as [string, React.ReactNode][])),
    ...(letter.edit_ratio != null
      ? ([
          [t("AI edit rate", "የAI ማስተካከያ መጠን"), `${Math.round(Number(letter.edit_ratio) * 100)}%`],
        ] as [string, React.ReactNode][])
      : []),
  ];

  return (
    <div className="grid gap-6 min-[900px]:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
      <aside className="grid content-start gap-4 print:hidden">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-ethiopic text-xl">{letter.subject}</h1>
          <StatusBadge status={letter.status} />
        </div>
        <dl className="grid gap-2 rounded-lg border bg-card p-4 text-sm">
          {meta.map(([k, v]) => (
            <div key={k} className="grid grid-cols-[8rem_1fr] gap-2">
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="font-ethiopic">{v}</dd>
            </div>
          ))}
        </dl>

        <div className="flex flex-wrap gap-2">
          {letter.status === "draft" && (
            <Button asChild>
              <Link to="/letters/$id/edit" params={{ id: letter.id }}>
                <Pencil />
                {t("Edit", "አስተካክል")}
              </Link>
            </Button>
          )}
          {!incoming && (
            <>
              <Button
                variant="outline"
                onClick={() =>
                  beforeOutput()
                    .then(() => printLetter(letter.id, me.org.id))
                    .then(() => events.refetch())
                }
              >
                <Printer />
                {t("Print / PDF", "አትም / PDF")}
              </Button>
              <Button
                variant="outline"
                onClick={() =>
                  beforeOutput()
                    .then(() => exportDocx(me.org, content, letter.id))
                    .then(() => events.refetch())
                }
              >
                <FileDown />
                DOCX
              </Button>
              <Button variant="ghost" onClick={onDuplicate}>
                <Copy />
                {t("Duplicate", "ቅዳ")}
              </Button>
            </>
          )}
          {incoming && fileUrl && (
            <Button asChild variant="outline">
              <a href={fileUrl} target="_blank" rel="noreferrer">
                <Paperclip />
                {t("Open scanned letter", "የተቃኘውን ደብዳቤ ክፈት")}
              </a>
            </Button>
          )}
        </div>

        {!incoming && (
          <div className="grid gap-2">
            <div
              role="group"
              aria-label={t("Letter language", "የደብዳቤው ቋንቋ")}
              className="flex items-center gap-2"
            >
              <Languages className="size-4 text-muted-foreground" />
              <Button
                size="sm"
                variant={lang === "am" ? "default" : "outline"}
                aria-pressed={lang === "am"}
                onClick={() => setLang("am")}
              >
                አማርኛ
              </Button>
              <Button
                size="sm"
                variant={lang === "en" ? "default" : "outline"}
                aria-pressed={lang === "en"}
                onClick={() => setLang("en")}
              >
                English
              </Button>
            </div>
            {lang === "en" && !template && (
              <p className="rounded-md border p-3 text-sm text-muted-foreground">
                {t(
                  "This letter wasn't made from a template, so there is no English version.",
                  "ይህ ደብዳቤ ከአብነት ስላልተዘጋጀ የእንግሊዝኛ ቅጂ የለውም።",
                )}
              </p>
            )}
            {lang === "en" && template && !englishReady && (
              <p className="rounded-md border p-3 text-sm text-muted-foreground">
                {t(
                  "This template has no English wording yet. An admin can add it on the Templates page.",
                  "ይህ አብነት የእንግሊዝኛ አገላለጽ የለውም። አስተዳዳሪ በአብነቶች ገጽ ላይ ሊጨምረው ይችላል።",
                )}
              </p>
            )}
            {showEnglish && (
              <EnglishCheck
                rows={rows}
                onChange={(id, v) => setTyped((x) => ({ ...x, [id]: v }))}
                onSave={() => saveEnglish()}
                saving={saving}
                unsaved={toSave.length}
                edited={amharicEdited(amharic, template, values)}
              />
            )}
          </div>
        )}

        <section className="rounded-lg border bg-card p-4">
          <h2 className="mb-2 font-sans text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {t("History", "ታሪክ")}
          </h2>
          <ol className="grid gap-1.5 text-sm">
            {events.data?.map((e) => {
              const label = EVENT_LABEL[e.type] ?? [e.type, e.type];
              return (
                <li key={e.id} className="flex justify-between gap-3">
                  <span>{t(label[0], label[1])}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {new Date(e.at).toLocaleString()}
                  </span>
                </li>
              );
            })}
          </ol>
        </section>
      </aside>

      <div className="min-w-0">
        {incoming ? (
          <div className="rounded-lg border bg-card p-8 text-sm text-muted-foreground print:hidden">
            {t(
              "Incoming letters are stored as scans. Open the attachment to read it.",
              "ገቢ ደብዳቤዎች እንደ ቅኝት ይቀመጣሉ። ለማንበብ ዓባሪውን ይክፈቱ።",
            )}
          </div>
        ) : (
          <ScaledSheet>
            <LetterSheet org={me.org} letter={content} />
          </ScaledSheet>
        )}
      </div>
    </div>
  );
}
