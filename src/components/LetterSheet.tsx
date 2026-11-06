import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

import type { Org, Signatory } from "@/lib/data";
import { isoToEthiopianString } from "@/lib/ethiopianCalendar";
import type { Recipient, Sender } from "@/lib/letters";
import { useSignedUrl } from "@/lib/storage";

export type LetterContent = {
  referenceNo: string | null;
  dateIso: string;
  recipient: Recipient;
  subject: string;
  body: string[];
  cc: string[];
  signatory: Signatory | null;
  /** Letterhead text and signer for this letter (editable per letter). */
  sender: Sender;
};

/** Show the stored signature image only if the letter is still signed by that person. */
export function signatureFor(letter: LetterContent): string | null {
  const s = letter.signatory;
  return s && s.name_am === letter.sender.signer_name ? s.signature_url : null;
}

/** The printed page: an official Amharic letter on the organisation's letterhead. */
export function LetterSheet({ org, letter }: { org: Org; letter: LetterContent }) {
  const header = useSignedUrl("letterheads", org.letterhead_header_url);
  const footer = useSignedUrl("letterheads", org.letterhead_footer_url);
  const logo = useSignedUrl("letterheads", org.logo_url);
  const signature = useSignedUrl("signatures", signatureFor(letter));
  const snd = letter.sender;
  const r = letter.recipient;

  return (
    <div className="letter-sheet print-area flex flex-col">
      {header ? (
        <img src={header} alt="" className="mb-4 w-full object-contain" />
      ) : (
        <div className="mb-5 flex items-center justify-between gap-4 border-b-2 border-letterhead pb-2 text-letterhead">
          <div className="flex items-center gap-3">
            {logo && <img src={logo} alt="" className="h-14 w-14 object-contain" />}
            <div className="leading-snug">
              <div className="text-[14pt] font-semibold">{snd.org_name_am || "[የድርጅቱ ስም]"}</div>
              {snd.org_name_en && (
                <div className="font-sans text-[10pt] font-medium">{snd.org_name_en}</div>
              )}
            </div>
          </div>
          <div className="text-right font-sans text-[8.5pt] leading-snug">
            {snd.address && <div>{snd.address}</div>}
            {snd.phone && <div>{snd.phone}</div>}
            {snd.email && <div>{snd.email}</div>}
            {snd.tin && <div>TIN: {snd.tin}</div>}
          </div>
        </div>
      )}

      <div className="ml-auto text-right">
        <div>
          ቁጥር፡{" "}
          {letter.referenceNo ?? (
            <span className="text-[10pt] text-neutral-500">(assigned on finalize)</span>
          )}
        </div>
        <div>ቀን፡ {isoToEthiopianString(letter.dateIso)}</div>
      </div>

      <div className="mt-4">
        <div>ለ፡ {r.name || "[ተቀባይ]"}</div>
        {r.title && <div>{r.title}</div>}
        {r.city && <div className="underline underline-offset-4">{r.city}</div>}
      </div>

      <div className="mt-5 text-center font-semibold">
        ጉዳዩ፡ <span className="underline underline-offset-4">{letter.subject || "[ጉዳይ]"}</span>
      </div>

      <div className="mt-4 space-y-3 text-justify">
        {letter.body
          .filter((p) => p.trim())
          .map((p, i) => (
            <p key={i} className="indent-10">
              {p}
            </p>
          ))}
      </div>

      <div className="keep-together mt-6">
        <div className="pl-[55%]">ከሰላምታ ጋር</div>
        <div className="mt-2 flex items-end justify-between gap-6 pl-[45%]">
          <div className="min-w-0">
            <div className="h-16">
              {signature && <img src={signature} alt="" className="h-16 object-contain" />}
            </div>
            <div className="font-semibold">{snd.signer_name || "[ፈራሚ]"}</div>
            <div className="text-[11pt]">{snd.signer_position || "[የፈራሚው ኃላፊነት]"}</div>
          </div>
          <div
            aria-hidden
            className="grid h-24 w-24 shrink-0 place-items-center rounded-full border-2 border-dashed border-neutral-300 font-sans text-[7pt] text-neutral-400"
          >
            ማህተም
          </div>
        </div>

        {letter.cc.length > 0 && (
          <div className="mt-6 text-[11pt]">
            <div>ግልባጭ፡</div>
            {letter.cc.map((c, i) => (
              <div key={i} className="pl-4">
                – {c}
              </div>
            ))}
          </div>
        )}
      </div>

      {footer && <img src={footer} alt="" className="mt-auto w-full object-contain pt-6" />}
    </div>
  );
}

/** Scales the 210mm sheet down to fit its container, keeping print size intact. */
export function ScaledSheet({ children }: { children: ReactNode }) {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [height, setHeight] = useState<number | undefined>(undefined);

  useLayoutEffect(() => {
    const o = outer.current;
    const i = inner.current;
    if (!o || !i) return;
    const update = () => {
      const s = Math.min(1, o.clientWidth / i.scrollWidth);
      setScale(s);
      setHeight(i.scrollHeight * s);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(o);
    ro.observe(i);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={outer} className="print-wrapper w-full overflow-hidden" style={{ height }}>
      <div
        ref={inner}
        className="print-wrapper w-max origin-top-left"
        style={{ transform: `scale(${scale})` }}
      >
        {children}
      </div>
    </div>
  );
}
