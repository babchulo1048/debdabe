/**
 * Optional phonetic Amharic keyboard for every text box in Debdabe.
 * Off by default; one toggle in the header turns it on (remembered per browser).
 * When on, English letters become Amharic as you type, and a small picker offers
 * same-sounding letters (ሀ/ሐ/ኀ, ሰ/ሠ, አ/ዐ, ጸ/ፀ).
 */
import { HelpCircle, Keyboard } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  alternativesFor,
  HELP_ROWS,
  isGemination,
  isLatinKey,
  renderSyllable,
} from "@/lib/amharicKeyboard";
import { useT } from "@/lib/i18n";

const KEY = "debdabe.amharicKeyboard";

type Ctx = { enabled: boolean; setEnabled: (v: boolean) => void };
const KeyboardContext = createContext<Ctx>({ enabled: false, setEnabled: () => {} });
export const useAmharicKeyboard = () => useContext(KeyboardContext);

type Field = HTMLInputElement | HTMLTextAreaElement;
/** Where the current letter sits in the field, and the keys typed for it. */
type Syllable = { start: number; end: number; buf: string; value: string; alt: number };
type Picker = { el: Field; start: number; alts: string[]; current: number };

function eligible(el: EventTarget | null): el is Field {
  if (el instanceof HTMLTextAreaElement)
    return !el.readOnly && !el.disabled && el.dataset["amharic"] !== "off";
  if (el instanceof HTMLInputElement)
    return (
      ["text", "search", ""].includes(el.type) &&
      !el.readOnly &&
      !el.disabled &&
      el.dataset["amharic"] !== "off"
    );
  return false;
}

/** Change a React-controlled field's value so React's onChange still fires. */
function setFieldValue(el: Field, value: string, caret: number) {
  const proto =
    el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value")?.set?.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.setSelectionRange(caret, caret);
}

export function AmharicKeyboardProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabledState] = useState(false);
  const [picker, setPicker] = useState<Picker | null>(null);
  const syllables = useRef(new WeakMap<Field, Syllable>());
  const pickerRef = useRef<Picker | null>(null);
  pickerRef.current = picker;

  useEffect(() => {
    setEnabledState(localStorage.getItem(KEY) === "on");
  }, []);

  const setEnabled = useCallback((v: boolean) => {
    localStorage.setItem(KEY, v ? "on" : "off");
    setEnabledState(v);
    setPicker(null);
  }, []);

  const choose = useCallback((i: number) => {
    const p = pickerRef.current;
    if (!p) return;
    const ch = p.alts[i];
    if (!ch) return;
    const v = p.el.value;
    const next = v.slice(0, p.start) + ch + v.slice(p.start + 1);
    setFieldValue(p.el, next, p.start + 1);
    const st = syllables.current.get(p.el);
    if (st && st.start === p.start) syllables.current.set(p.el, { ...st, value: next, alt: i });
    setPicker({ ...p, current: i });
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const onKeyDown = (e: KeyboardEvent) => {
      const el = e.target;
      if (!eligible(el) || e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return;
      const map = syllables.current;

      // Picker open: a number picks a letter, Escape closes, anything else closes it and types.
      const p = pickerRef.current;
      if (p && p.el === el) {
        const n = Number(e.key);
        if (Number.isInteger(n) && n >= 1 && n <= p.alts.length) {
          e.preventDefault();
          choose(n - 1);
          return;
        }
        if (e.key === "Escape") {
          e.preventDefault();
          setPicker(null);
          return;
        }
      }

      if (!isLatinKey(e.key)) {
        map.delete(el);
        if (e.key.length === 1 || e.key === "Backspace" || e.key === "Enter") setPicker(null);
        return;
      }

      const s0 = el.selectionStart ?? 0;
      const s1 = el.selectionEnd ?? s0;
      const st = map.get(el);
      const continuing = !!st && s0 === s1 && s0 === st.end && el.value === st.value;

      if (e.key === "'") {
        // ' only separates letters ("le'a" → ለአ)
        e.preventDefault();
        map.delete(el);
        setPicker(null);
        return;
      }
      if (continuing && st && isGemination(st.buf, e.key)) {
        e.preventDefault(); // "dd" in Addis = one ድ
        return;
      }

      let start = s0;
      let replaceEnd = s1;
      let buf = e.key;
      let out = renderSyllable(e.key);
      let alt = 0;
      if (continuing && st) {
        const joined = renderSyllable(st.buf + e.key);
        if (joined !== null) {
          start = st.start;
          replaceEnd = st.end;
          buf = st.buf + e.key;
          out = joined;
          alt = st.alt;
        }
      }
      if (out === null) {
        map.delete(el);
        return; // not a letter we convert: let the browser type it
      }
      // Keep a picked spelling (e.g. ሐ) when a vowel is added afterwards.
      const alts = alternativesFor(out);
      const picked = alt ? alts[alt] : undefined;
      const shown: string = picked ?? out;

      e.preventDefault();
      const v = el.value;
      const next = v.slice(0, start) + shown + v.slice(replaceEnd);
      const caret = start + shown.length;
      setFieldValue(el, next, caret);
      map.set(el, { start, end: caret, buf, value: next, alt });
      setPicker(
        alts.length > 1 ? { el, start, alts, current: Math.max(0, alts.indexOf(shown)) } : null,
      );
    };

    const onBlur = () => setPicker(null);
    document.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("focusout", onBlur, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("focusout", onBlur, true);
    };
  }, [enabled, choose]);

  return (
    <KeyboardContext.Provider value={{ enabled, setEnabled }}>
      {children}
      {enabled && picker && <PickerPopup picker={picker} onChoose={choose} />}
      {enabled && (
        <div className="pointer-events-none fixed bottom-3 left-3 z-50 rounded-full bg-primary px-3 py-1 text-xs text-primary-foreground shadow print:hidden">
          ⌨ አማ
        </div>
      )}
    </KeyboardContext.Provider>
  );
}

function PickerPopup({ picker, onChoose }: { picker: Picker; onChoose: (i: number) => void }) {
  const r = picker.el.getBoundingClientRect();
  return (
    <div
      role="listbox"
      aria-label="Same-sounding letters"
      className="fixed z-50 flex items-center gap-1 rounded-md border bg-popover p-1 text-sm shadow-md print:hidden"
      style={{ top: r.bottom + 4, left: r.left }}
    >
      {picker.alts.map((ch, i) => (
        <button
          key={ch}
          type="button"
          role="option"
          aria-selected={i === picker.current}
          // mousedown, not click: keep the cursor in the text box
          onMouseDown={(e) => {
            e.preventDefault();
            onChoose(i);
          }}
          className={`flex items-center gap-1 rounded px-2 py-0.5 font-ethiopic ${i === picker.current ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
        >
          <span className="text-[10px] opacity-70">{i + 1}</span>
          <span className="text-base">{ch}</span>
        </button>
      ))}
    </div>
  );
}

/** Header toggle + help. */
export function AmharicKeyboardToggle() {
  const { t } = useT();
  const { enabled, setEnabled } = useAmharicKeyboard();
  const [help, setHelp] = useState(false);
  const [tryIt, setTryIt] = useState("");

  return (
    <div className="flex items-center rounded-md border p-0.5 text-xs">
      <button
        type="button"
        aria-pressed={enabled}
        title={t(
          "Type Amharic with English letters (selam → ሰላም)",
          "በእንግሊዝኛ ፊደላት አማርኛ ይጻፉ (selam → ሰላም)",
        )}
        onClick={() => {
          setEnabled(!enabled);
          if (!enabled && !localStorage.getItem("debdabe.amharicKeyboard.helpSeen")) {
            localStorage.setItem("debdabe.amharicKeyboard.helpSeen", "1");
            setHelp(true);
          }
        }}
        className={`flex items-center gap-1 rounded px-2 py-1 ${enabled ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
      >
        <Keyboard className="size-3.5" />
        {t("Amharic keyboard", "የአማርኛ ኪቦርድ")}
      </button>
      <button
        type="button"
        aria-label={t("How to type", "እንዴት እንደሚጻፍ")}
        onClick={() => setHelp(true)}
        className="rounded px-1 py-1 text-muted-foreground hover:text-foreground"
      >
        <HelpCircle className="size-3.5" />
      </button>

      <Dialog open={help} onOpenChange={setHelp}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {t("Type Amharic with English letters", "በእንግሊዝኛ ፊደላት አማርኛ ይጻፉ")}
            </DialogTitle>
            <DialogDescription>
              {t(
                "Type the sound: a consonant, then a vowel. A letter with no vowel after it becomes the 6th form (br → ብር). Numbers and punctuation stay as they are.",
                "ድምፁን ይጻፉ፡ ተነባቢ ከዚያ አናባቢ። አናባቢ የሌለው ፊደል 6ኛ ቅርጽ ይሆናል (br → ብር)። ቁጥሮችና ሥርዓተ ነጥቦች እንዳሉ ይቆያሉ።",
              )}
            </DialogDescription>
          </DialogHeader>
          <table className="w-full text-sm">
            <tbody>
              {HELP_ROWS.map((r) => (
                <tr key={r.keys} className="border-b last:border-0">
                  <td className="py-1.5 pr-3 font-mono text-xs">{r.keys}</td>
                  <td className="py-1.5 font-ethiopic text-base">{r.letters}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-xs text-muted-foreground">
            {t(
              "Same-sounding letters (ሀ/ሐ/ኀ, ሰ/ሠ, አ/ዐ, ጸ/ፀ): a small picker appears under the box. Press its number or click it. ' separates letters (le'a → ለአ). Double letters count once (addis → አዲስ).",
              "ተመሳሳይ ድምፅ ያላቸው ፊደላት (ሀ/ሐ/ኀ፣ ሰ/ሠ፣ አ/ዐ፣ ጸ/ፀ)፡ ከሳጥኑ ስር ትንሽ መምረጫ ይታያል። ቁጥሩን ይጫኑ ወይም ይጫኑት። ' ፊደላትን ይለያል (le'a → ለአ)።",
            )}
          </p>
          <div className="grid gap-1.5">
            <span className="text-xs font-medium">
              {enabled
                ? t("Try it here:", "እዚህ ይሞክሩ፡")
                : t("Turn the keyboard on to try it here.", "ለመሞከር ኪቦርዱን ያብሩ።")}
            </span>
            <Input
              value={tryIt}
              onChange={(e) => setTryIt(e.target.value)}
              placeholder="selam abebe"
              className="font-ethiopic"
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
