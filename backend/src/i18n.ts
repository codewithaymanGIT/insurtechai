// Per-request language for engine and API text. The frontend sends the
// visitor's language in the X-Lang header; AsyncLocalStorage carries it through
// every function in that request, so engine code just calls tr("...").

import { AsyncLocalStorage } from "async_hooks";
import type { Request, Response, NextFunction } from "express";
import { isLang, translate, type Catalog, type Lang, type Vars } from "@insurtechai/shared";
import hi from "@insurtechai/shared/dist/i18n/catalogs/hi.js";
import mr from "@insurtechai/shared/dist/i18n/catalogs/mr.js";
import ta from "@insurtechai/shared/dist/i18n/catalogs/ta.js";
import te from "@insurtechai/shared/dist/i18n/catalogs/te.js";
import kn from "@insurtechai/shared/dist/i18n/catalogs/kn.js";

const CATALOGS: Record<Lang, Catalog | null> = { en: null, hi, mr, ta, te, kn };
const store = new AsyncLocalStorage<Lang>();

export function langMiddleware(req: Request, _res: Response, next: NextFunction) {
  const header = req.get("x-lang");
  const lang: Lang = isLang(header) ? header : "en";
  store.run(lang, () => next());
}

export function currentLang(): Lang {
  return store.getStore() ?? "en";
}

/** Translate an English source string into the request's language. */
export function tr(source: string, vars?: Vars): string {
  return translate(CATALOGS[currentLang()], source, vars);
}

/** Run a function with a specific language (scripts, tests). */
export function withLang<T>(lang: Lang, fn: () => T): T {
  return store.run(lang, fn);
}

/** Marks a string for extraction without translating it (for module-level
 * tables); translate at the point of use with tr(value). */
export const N_ = (s: string) => s;
