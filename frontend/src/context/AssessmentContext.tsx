// The estimate currently being viewed: set by the form (or by opening a saved
// estimate) and read by the result, what-if and ask pages. Kept in
// sessionStorage, not localStorage, because it holds personal details
// (income, health) and shouldn't outlive the browser tab on a shared device.
//
// The engine writes its explanations in the visitor's language, so when the
// language changes (or the estimate predates a model update) the same answers
// are re-run without saving a new copy.

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { ApplicantProfile } from "@insurtechai/shared";
import { api, type EstimateResponse } from "../lib/api";
import { safeStorage } from "../lib/utils";
import { useI18n } from "./I18nContext";

interface State {
  applicant: ApplicantProfile;
  result: EstimateResponse;
  lang?: string;
}

interface AssessmentContextValue {
  applicant: ApplicantProfile | null;
  result: EstimateResponse | null;
  /** True while the estimate is being re-run in a new language. */
  refreshing: boolean;
  setAssessment: (applicant: ApplicantProfile, result: EstimateResponse) => void;
  clear: () => void;
}

const AssessmentContext = createContext<AssessmentContextValue | null>(null);
const store = safeStorage("session");
const KEY = "itai.estimate";

/** Results from before the pricing model gained third-party, IDV and tax fields. */
export function isCurrentResult(r: EstimateResponse | null | undefined): boolean {
  return !!r?.premium && "fixedPremium" in r.premium && "ncbPercent" in r.premium && "tax" in r;
}

export function AssessmentProvider({ children }: { children: ReactNode }) {
  const { lang } = useI18n();
  const [state, setState] = useState<State | null>(() => {
    const raw = store.get(KEY);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as State;
      return parsed?.applicant && parsed?.result?.premium ? parsed : null;
    } catch {
      return null;
    }
  });
  const [refreshing, setRefreshing] = useState(false);
  const inflight = useRef<string | null>(null);

  const setAssessment = (applicant: ApplicantProfile, result: EstimateResponse) => {
    const next = { applicant, result, lang };
    setState(next);
    store.set(KEY, JSON.stringify(next));
  };

  useEffect(() => {
    if (!state) return;
    const stale = !isCurrentResult(state.result);
    if (!stale && (state.lang ?? "en") === lang) return;
    const key = `${lang}:${JSON.stringify(state.applicant)}`;
    if (inflight.current === key) return;
    inflight.current = key;
    setRefreshing(true);
    const savedId = state.result.savedId;
    api
      .estimate(state.applicant, { save: false })
      .then((fresh) => {
        const next = { applicant: state.applicant, result: { ...fresh, savedId }, lang };
        setState(next);
        store.set(KEY, JSON.stringify(next));
      })
      .catch(() => {
        // Keep showing the previous result; drop it only if it can't render.
        if (stale) setState(null);
      })
      .finally(() => {
        inflight.current = null;
        setRefreshing(false);
      });
  }, [lang, state]);

  const clear = () => {
    setState(null);
    store.remove(KEY);
  };

  const usable = state && isCurrentResult(state.result) ? state : null;
  return (
    <AssessmentContext.Provider value={{ applicant: usable?.applicant ?? null, result: usable?.result ?? null, refreshing, setAssessment, clear }}>
      {children}
    </AssessmentContext.Provider>
  );
}

export function useAssessment() {
  const ctx = useContext(AssessmentContext);
  if (!ctx) throw new Error("useAssessment must be used within AssessmentProvider");
  return ctx;
}
