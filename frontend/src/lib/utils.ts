import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { InsuranceType, RiskCategory, CoverageLevel } from "@insurtechai/shared";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function inr(n: number): string {
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

/** ₹12.4L / ₹1.2Cr / ₹8.5K style, for axes and tight spaces. */
export function inrCompact(n: number): string {
  const a = Math.abs(n);
  if (a >= 1_00_00_000) return `₹${(n / 1_00_00_000).toFixed(a >= 10_00_00_000 ? 0 : 1)}Cr`;
  if (a >= 1_00_000) return `₹${(n / 1_00_000).toFixed(a >= 10_00_000 ? 0 : 1)}L`;
  if (a >= 1000) return `₹${(n / 1000).toFixed(a >= 10_000 ? 0 : 1)}K`;
  return `₹${Math.round(n)}`;
}

/** "12 lakh", "1.5 crore": the way people in India say amounts out loud. */
export function inrWords(n: number): string | null {
  if (!Number.isFinite(n) || n < 1_00_000) return null;
  if (n >= 1_00_00_000) return `${+(n / 1_00_00_000).toFixed(2)} crore`;
  return `${+(n / 1_00_000).toFixed(2)} lakh`;
}

export function num(n: number): string {
  return n.toLocaleString("en-IN");
}

type TFn = (source: string, vars?: Record<string, string | number>) => string;
const identity: TFn = (s, v) => (v ? s.replace(/\{(\w+)\}/g, (_, k) => String(v[k] ?? "")) : s);

export function relativeDate(iso: string, t: TFn = identity): string {
  const d = new Date(iso.includes("T") ? iso : iso.replace(" ", "T") + "Z");
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return t("just now");
  if (diff < 3600) return t("{n} min ago", { n: Math.floor(diff / 60) });
  if (diff < 86400) return t("{n} h ago", { n: Math.floor(diff / 3600) });
  if (diff < 7 * 86400) return t("{n} d ago", { n: Math.floor(diff / 86400) });
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export const TYPE_LABEL: Record<InsuranceType, string> = {
  HEALTH: "Health",
  MOTOR: "Motor",
  PROPERTY: "Home",
  LIFE: "Term life",
};

export const COVER_LABEL: Record<CoverageLevel, string> = {
  BASIC: "Basic",
  STANDARD: "Standard",
  PREMIUM: "Premium",
  COMPREHENSIVE: "Comprehensive",
};

export const RISK_ORDER: RiskCategory[] = ["Very Low", "Low", "Moderate", "High", "Very High"];

/** Tailwind colour key (risk-1..5) for a risk band. */
export const RISK_TONE: Record<RiskCategory, 1 | 2 | 3 | 4 | 5> = {
  "Very Low": 1,
  Low: 2,
  Moderate: 3,
  High: 4,
  "Very High": 5,
};

export const RISK_TEXT: Record<RiskCategory, string> = {
  "Very Low": "text-risk-1",
  Low: "text-risk-2",
  Moderate: "text-risk-3",
  High: "text-risk-4",
  "Very High": "text-risk-5",
};

export const RISK_BG: Record<RiskCategory, string> = {
  "Very Low": "bg-risk-1",
  Low: "bg-risk-2",
  Moderate: "bg-risk-3",
  High: "bg-risk-4",
  "Very High": "bg-risk-5",
};

export const DB_RISK: Record<string, RiskCategory> = {
  VERY_LOW: "Very Low",
  LOW: "Low",
  MODERATE: "Moderate",
  HIGH: "High",
  VERY_HIGH: "Very High",
};

export function riskFromScore(score: number): RiskCategory {
  if (score <= 20) return "Very Low";
  if (score <= 40) return "Low";
  if (score <= 60) return "Moderate";
  if (score <= 80) return "High";
  return "Very High";
}

export function safeStorage(kind: "local" | "session") {
  return {
    get(key: string): string | null {
      try {
        return (kind === "local" ? localStorage : sessionStorage).getItem(key);
      } catch {
        return null;
      }
    },
    set(key: string, value: string) {
      try {
        (kind === "local" ? localStorage : sessionStorage).setItem(key, value);
      } catch {
        /* storage unavailable (private mode, blocked): state stays in memory */
      }
    },
    remove(key: string) {
      try {
        (kind === "local" ? localStorage : sessionStorage).removeItem(key);
      } catch {
        /* ignore */
      }
    },
  };
}
