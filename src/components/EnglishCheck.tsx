import { AlertTriangle, CheckCircle2, Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { EnglishItem, Source, Status } from "@/lib/english";
import { useT } from "@/lib/i18n";

export type EnglishRow = EnglishItem & {
  value: string;
  status: Status;
  source: Source;
  /** The user typed this value. */
  edited: boolean;
};

const SOURCE_TEXT: Record<Source, [string, string]> = {
  empty: ["", ""],
  same: ["Already in English", "በእንግሊዝኛ ነው"],
  memory: ["Saved before", "ከዚህ በፊት የተቀመጠ"],
  settings: ["From Settings", "ከቅንብሮች"],
  dictionary: ["Known word", "የታወቀ ቃል"],
  words: ["Check the wording", "አገላለጹን ያረጋግጡ"],
  time: ["Check the time", "ሰዓቱን ያረጋግጡ"],
  spelling: ["Check the spelling", "አጻጻፉን ያረጋግጡ"],
  none: ["Please write in English", "በእንግሊዝኛ ይጻፉ"],
};

/** Shows each fact that needs an English form, so the user can check or write it. */
export function EnglishCheck({
  rows,
  onChange,
  onSave,
  saving,
  unsaved,
  edited,
}: {
  rows: EnglishRow[];
  onChange: (id: string, value: string) => void;
  onSave: () => void;
  saving: boolean;
  unsaved: number;
  /** The Amharic wording was changed after the letter was made. */
  edited: boolean;
}) {
  const { t, lang } = useT();
  const shown = rows.filter((r) => r.source !== "same" && r.source !== "empty");
  const open = shown.filter((r) => !r.value.trim()).length;
  const toCheck = shown.filter((r) => r.status === "check" && !r.edited).length;

  return (
    <section className="grid gap-3 rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-sans text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {t("English version: check", "የእንግሊዝኛ ቅጂ፡ ያረጋግጡ")}
        </h2>
        <span className="flex items-center gap-1.5 text-xs">
          {open || toCheck ? (
            <>
              <AlertTriangle className="size-3.5 text-warning" />
              {[
                open && t(`${open} to write`, `${open} የሚጻፍ`),
                toCheck && t(`${toCheck} to check`, `${toCheck} የሚረጋገጥ`),
              ]
                .filter(Boolean)
                .join(" · ")}
            </>
          ) : (
            <>
              <CheckCircle2 className="size-3.5 text-success" />
              {t("All filled", "ሁሉም ተሞልቷል")}
            </>
          )}
        </span>
      </div>

      {edited && (
        <p className="rounded-md border border-warning bg-warning/10 p-2 text-xs">
          {t(
            "The Amharic text was changed after the letter was made. The English letter uses the template's standard wording, so read it before sending.",
            "የአማርኛው ጽሑፍ ደብዳቤው ከተዘጋጀ በኋላ ተቀይሯል። የእንግሊዝኛው ደብዳቤ የአብነቱን መደበኛ አገላለጽ ይጠቀማል፤ ከመላክዎ በፊት ያንብቡት።",
          )}
        </p>
      )}

      {shown.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {t("Nothing to translate in this letter.", "በዚህ ደብዳቤ የሚተረጎም የለም።")}
        </p>
      ) : (
        <div className="grid gap-3">
          {shown.map((r) => {
            const empty = !r.value.trim();
            const note = r.edited ? null : SOURCE_TEXT[r.source];
            const warn = empty || (r.status === "check" && !r.edited);
            return (
              <div key={r.id} className="grid gap-1">
                <div className="flex items-baseline justify-between gap-2">
                  <Label htmlFor={`en-${r.id}`} className="text-xs font-medium">
                    {lang === "am" ? r.label_am : r.label_en}
                  </Label>
                  {note && note[0] && (
                    <span
                      className={`text-[11px] ${warn ? "text-warning" : "text-muted-foreground"}`}
                    >
                      {t(note[0], note[1])}
                    </span>
                  )}
                </div>
                <p className="truncate font-ethiopic text-xs text-muted-foreground" title={r.am}>
                  {r.am}
                </p>
                <Input
                  id={`en-${r.id}`}
                  lang="en"
                  className={`h-9 ${empty ? "border-warning" : ""}`}
                  placeholder={t("English", "እንግሊዝኛ")}
                  value={r.value}
                  onChange={(e) => onChange(r.id, e.target.value)}
                />
              </div>
            );
          })}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
        <p className="text-xs text-muted-foreground">
          {t(
            "Saved words fill in by themselves in your next letters.",
            "የተቀመጡ ቃላት በሚቀጥሉት ደብዳቤዎች በራሳቸው ይሞላሉ።",
          )}
        </p>
        <Button size="sm" variant="outline" disabled={!unsaved || saving} onClick={onSave}>
          <Save />
          {t("Save English words", "የእንግሊዝኛ ቃላትን አስቀምጥ")}
        </Button>
      </div>
    </section>
  );
}
