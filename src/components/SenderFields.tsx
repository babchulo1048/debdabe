import { Link } from "@tanstack/react-router";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Signatory } from "@/lib/data";
import { useT } from "@/lib/i18n";
import { SENDER_FIELDS, type Sender, type SenderKey } from "@/lib/letters";

const LETTERHEAD: SenderKey[] = ["org_name_am", "org_name_en", "tin", "address", "phone", "email"];
const SIGNER: SenderKey[] = ["signer_name", "signer_position"];
/** Without these the letter has a visible [blank]. */
export const SENDER_REQUIRED: SenderKey[] = ["org_name_am", "signer_name", "signer_position"];

export function missingSender(sender: Sender): SenderKey[] {
  return SENDER_REQUIRED.filter((k) => !sender[k].trim());
}

/**
 * "From" part of a letter: who signs it and the letterhead text.
 * Prefilled from Settings; changes here apply to this letter only.
 */
export function SenderFields({
  sender,
  onChange,
  signatories,
  signatoryId,
  onSignatoryChange,
  idPrefix,
}: {
  sender: Sender;
  onChange: (next: Sender) => void;
  signatories: Signatory[];
  signatoryId: string | null;
  onSignatoryChange: (id: string | null) => void;
  idPrefix: string;
}) {
  const { t, lang } = useT();
  const set = (k: SenderKey, v: string) => onChange({ ...sender, [k]: v });

  function pickSigner(id: string) {
    const s = signatories.find((x) => x.id === id);
    onSignatoryChange(s ? s.id : null);
    onChange({
      ...sender,
      signer_name: s?.name_am ?? "",
      signer_position: s?.position_am ?? "",
    });
  }

  const field = (k: SenderKey) => {
    const f = SENDER_FIELDS.find((x) => x.key === k)!;
    const required = SENDER_REQUIRED.includes(k);
    const empty = !sender[k].trim();
    return (
      <div key={k} className="grid gap-1.5">
        <Label htmlFor={`${idPrefix}-${k}`} className="text-xs font-normal text-muted-foreground">
          {lang === "am" ? f.label_am : f.label_en}
          {required && <span className="text-destructive"> *</span>}
        </Label>
        <Input
          id={`${idPrefix}-${k}`}
          className={`h-9 font-ethiopic ${required && empty ? "border-warning" : ""}`}
          placeholder={`[${f.label_am}]`}
          value={sender[k]}
          onChange={(e) => set(k, e.target.value)}
        />
      </div>
    );
  };

  const matched = signatories.some((s) => s.id === signatoryId && s.name_am === sender.signer_name);

  return (
    <div className="grid gap-4">
      <div className="grid gap-3">
        <p className="text-sm font-medium">{t("Signed by", "ፈራሚ")}</p>
        {signatories.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {signatories.map((s) => (
              <button
                key={s.id}
                type="button"
                aria-pressed={matched && s.id === signatoryId}
                onClick={() => pickSigner(s.id)}
                className={`rounded-full border px-3 py-1 font-ethiopic text-xs transition-colors ${
                  matched && s.id === signatoryId
                    ? "border-primary bg-primary-soft"
                    : "hover:border-primary"
                }`}
              >
                {s.name_am}
                {s.position_am && <span className="text-muted-foreground"> · {s.position_am}</span>}
              </button>
            ))}
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-2">{SIGNER.map(field)}</div>
        {!matched && sender.signer_name.trim() && (
          <p className="text-xs text-muted-foreground">
            {t(
              "Typed by hand: the saved signature image won't be added.",
              "በእጅ የተጻፈ፡ የተቀመጠው የፊርማ ምስል አይጨመርም።",
            )}
          </p>
        )}
      </div>

      <div className="grid gap-3">
        <p className="text-sm font-medium">{t("Letterhead", "የደብዳቤ ራስጌ")}</p>
        <div className="grid gap-3 sm:grid-cols-2">{LETTERHEAD.map(field)}</div>
      </div>

      <p className="text-xs text-muted-foreground">
        {t(
          "Changes here apply to this letter only. To change them for every letter, use ",
          "እዚህ የሚደረግ ለውጥ ለዚህ ደብዳቤ ብቻ ነው። ለሁሉም ደብዳቤዎች ለመቀየር ",
        )}
        <Link to="/settings" className="text-primary hover:underline">
          {t("Settings", "ቅንብሮች")}
        </Link>
        {t(".", " ይጠቀሙ።")}
      </p>
    </div>
  );
}
