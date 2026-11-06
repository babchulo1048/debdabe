import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Copy, FileDown, Paperclip, Pencil, Printer } from "lucide-react";
import { toast } from "sonner";

import { AppShell, StatusBadge } from "@/components/AppShell";
import { LetterSheet, ScaledSheet } from "@/components/LetterSheet";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useLetter, useLetterEvents, useSignatories, type LetterRow, type Me } from "@/lib/data";
import { formatGregorian, isoToEthiopianString } from "@/lib/ethiopianCalendar";
import { useT } from "@/lib/i18n";
import { duplicateLetter, exportDocx, printLetter, toContent } from "@/lib/letterActions";
import { useSignedUrl } from "@/lib/storage";

export const Route = createFileRoute("/letters/$id/")({
  ssr: false,
  head: () => ({ meta: [{ title: "Letter · Debdabe" }] }),
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
  const content = toContent(letter, signatories.data);
  const incoming = letter.direction === "incoming";

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
      : ([[t("To", "ለ"), content.recipient.name ?? ""]] as [string, React.ReactNode][])),
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
                onClick={() => printLetter(letter.id, me.org.id).then(() => events.refetch())}
              >
                <Printer />
                {t("Print / PDF", "አትም / PDF")}
              </Button>
              <Button
                variant="outline"
                onClick={() => exportDocx(me.org, content, letter.id).then(() => events.refetch())}
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
