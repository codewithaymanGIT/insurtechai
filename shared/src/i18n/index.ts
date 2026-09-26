// Translation core shared by the frontend and backend.
//
// Source strings are the English text itself (gettext style): t("Get an
// estimate"). Catalogs map English -> translation, and any string missing from
// a catalog falls back to English, so an untranslated string never breaks the
// page. Placeholders use {name} and are filled after translation.

export type Lang = "en" | "hi" | "mr" | "ta" | "te" | "kn";

export const LANGUAGES: { code: Lang; name: string; native: string; script: "latin" | "devanagari" | "tamil" | "telugu" | "kannada" }[] = [
  { code: "en", name: "English", native: "English", script: "latin" },
  { code: "hi", name: "Hindi", native: "हिन्दी", script: "devanagari" },
  { code: "mr", name: "Marathi", native: "मराठी", script: "devanagari" },
  { code: "ta", name: "Tamil", native: "தமிழ்", script: "tamil" },
  { code: "te", name: "Telugu", native: "తెలుగు", script: "telugu" },
  { code: "kn", name: "Kannada", native: "ಕನ್ನಡ", script: "kannada" },
];

export type Catalog = Record<string, string>;
export type Vars = Record<string, string | number>;

export function isLang(v: unknown): v is Lang {
  return typeof v === "string" && LANGUAGES.some((l) => l.code === v);
}

export function fill(template: string, vars?: Vars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
}

export function translate(catalog: Catalog | null | undefined, source: string, vars?: Vars): string {
  return fill(catalog?.[source] || source, vars);
}
