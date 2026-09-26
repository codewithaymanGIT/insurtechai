import { describe, expect, it } from "vitest";
import { translate, LANGUAGES } from "@insurtechai/shared";
import hi from "@insurtechai/shared/dist/i18n/catalogs/hi.js";
import mr from "@insurtechai/shared/dist/i18n/catalogs/mr.js";
import ta from "@insurtechai/shared/dist/i18n/catalogs/ta.js";
import te from "@insurtechai/shared/dist/i18n/catalogs/te.js";
import kn from "@insurtechai/shared/dist/i18n/catalogs/kn.js";

const catalogs = { hi, mr, ta, te, kn };
const vars = (s: string) => [...s.matchAll(/\{([a-zA-Z]+)\}/g)].map((m) => m[1]).sort().join(",");

describe("translate()", () => {
  it("fills placeholders and falls back to English", () => {
    expect(translate(null, "{n} years", { n: 5 })).toBe("5 years");
    expect(translate(hi, "A sentence nobody translated")).toBe("A sentence nobody translated");
  });

  it("uses the catalog when it has the key", () => {
    expect(translate(hi, "Sign in")).not.toBe("Sign in");
  });
});

describe.each(Object.entries(catalogs))("%s catalog", (lang, catalog) => {
  it("is one of the offered languages", () => {
    expect(LANGUAGES.map((l) => l.code)).toContain(lang);
  });

  it("keeps every placeholder of the English source", () => {
    const bad = Object.entries(catalog).filter(([en, tr]) => vars(en) !== vars(tr));
    expect(bad).toEqual([]);
  });

  it("uses Western digits, as the number formatting does", () => {
    const localDigits = /[०-९௦-௯౦-౯೦-೯]/;
    expect(Object.values(catalog).filter((v) => localDigits.test(v))).toEqual([]);
  });
});
