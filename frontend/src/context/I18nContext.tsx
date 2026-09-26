import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { LANGUAGES, isLang, translate, type Catalog, type Lang, type Vars } from "@insurtechai/shared";
import { safeStorage } from "../lib/utils";
import { setApiLang, setApiTranslator } from "../lib/api";

// Catalogs and fonts load only when a language is chosen, so English visitors
// download neither.
const CATALOG_LOADERS: Record<Exclude<Lang, "en">, () => Promise<{ default: Catalog }>> = {
  hi: () => import("@insurtechai/shared/dist/i18n/catalogs/hi.js"),
  mr: () => import("@insurtechai/shared/dist/i18n/catalogs/mr.js"),
  ta: () => import("@insurtechai/shared/dist/i18n/catalogs/ta.js"),
  te: () => import("@insurtechai/shared/dist/i18n/catalogs/te.js"),
  kn: () => import("@insurtechai/shared/dist/i18n/catalogs/kn.js"),
};

const FONT_LOADERS: Record<string, () => Promise<unknown>> = {
  devanagari: () => import("@fontsource-variable/noto-sans-devanagari"),
  tamil: () => import("@fontsource-variable/noto-sans-tamil"),
  telugu: () => import("@fontsource-variable/noto-sans-telugu"),
  kannada: () => import("@fontsource-variable/noto-sans-kannada"),
};

const store = safeStorage("local");
const KEY = "itai.lang";

function initialLang(): Lang {
  const saved = store.get(KEY);
  if (isLang(saved)) return saved;
  const nav = typeof navigator !== "undefined" ? navigator.language.slice(0, 2) : "en";
  return isLang(nav) ? nav : "en";
}

interface I18nValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (source: string, vars?: Vars) => string;
  loading: boolean;
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    const l = initialLang();
    setApiLang(l);
    return l;
  });
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setApiLang(lang);
    document.documentElement.lang = lang === "en" ? "en-IN" : lang;
    document.documentElement.dataset.script = LANGUAGES.find((l) => l.code === lang)?.script ?? "latin";
    store.set(KEY, lang);
    if (lang === "en") {
      setCatalog(null);
      return;
    }
    setLoading(true);
    const script = LANGUAGES.find((l) => l.code === lang)!.script;
    Promise.all([CATALOG_LOADERS[lang](), FONT_LOADERS[script]?.()])
      .then(([mod]) => !cancelled && setCatalog(mod.default))
      .catch(() => !cancelled && setCatalog(null))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [lang]);

  // Set synchronously so requests made by children in the same render pass
  // (effects run child-first) already carry the new language.
  const setLang = useCallback((l: Lang) => {
    setApiLang(l);
    setLangState(l);
  }, []);
  const t = useCallback((source: string, vars?: Vars) => translate(catalog, source, vars), [catalog]);
  useEffect(() => setApiTranslator(t), [t]);
  const value = useMemo(() => ({ lang, setLang, t, loading }), [lang, setLang, t, loading]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}

/** Shorthand for components that only need t(). */
export function useT() {
  return useI18n().t;
}
