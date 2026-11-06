import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

export type Lang = "en" | "am";

type LangCtx = { lang: Lang; setLang: (l: Lang) => void; t: (en: string, am: string) => string };

const Ctx = createContext<LangCtx>({ lang: "en", setLang: () => {}, t: (en) => en });

const KEY = "debdabe.lang";

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY);
      if (saved === "am" || saved === "en") setLangState(saved);
    } catch {
      /* storage blocked: keep English */
    }
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem(KEY, l);
    } catch {
      /* ignore */
    }
  }, []);

  const t = useCallback((en: string, am: string) => (lang === "am" ? am : en), [lang]);

  return <Ctx.Provider value={{ lang, setLang, t }}>{children}</Ctx.Provider>;
}

export function useT() {
  return useContext(Ctx);
}
