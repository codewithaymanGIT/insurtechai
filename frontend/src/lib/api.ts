// Typed API client. Every call maps 1:1 to a backend route. Requests carry
// the session cookie (same origin in production, proxied by Vite in dev).

import type {
  ApplicantProfile,
  FullAssessmentResult,
  ScenarioSimulationResult,
  AdvisorQuestionId,
  PortfolioKpis,
  RiskDistributionBucket,
  CustomerSegment,
  InsuranceType,
} from "@insurtechai/shared";

export class ApiError extends Error {
  status: number;
  fieldErrors: Record<string, string>;
  constructor(status: number, message: string, fieldErrors: Record<string, string> = {}) {
    super(message);
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

type Translator = (source: string, vars?: Record<string, string | number>) => string;
let apiT: Translator = (s, v) => (v ? s.replace(/\{(\w+)\}/g, (_, k) => String(v[k] ?? "")) : s);
/** Lets client-side messages (validation, network errors) follow the chosen language. */
export function setApiTranslator(t: Translator) {
  apiT = t;
}

/** Turns validator wording into something a visitor would say. */
function friendly(message: string): string {
  if (/expected number/i.test(message) || /nan/i.test(message)) return apiT("Enter a number.");
  let m = message.match(/greater than or equal to ([\d.]+)/i);
  if (m) return apiT("Must be at least {n}.", { n: Number(m[1]).toLocaleString("en-IN") });
  m = message.match(/less than or equal to ([\d.]+)/i);
  if (m) return apiT("Must be {n} or less.", { n: Number(m[1]).toLocaleString("en-IN") });
  if (/at least 1 character/i.test(message)) return apiT("Required.");
  if (/expected integer/i.test(message)) return apiT("Use a whole number.");
  return message;
}

// The visitor's language, sent with every request so engine text (verdicts,
// factor explanations, errors) comes back translated.
let apiLang = "en";
export function setApiLang(lang: string) {
  apiLang = lang;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      credentials: "same-origin",
      ...init,
      headers: { "Content-Type": "application/json", "X-Lang": apiLang, ...(init?.headers ?? {}) },
    });
  } catch {
    throw new ApiError(0, apiT("Can't reach the server. Check your connection and try again."));
  }
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const fieldErrors: Record<string, string> = {};
    if (Array.isArray(body?.details)) {
      for (const d of body.details as { path: string; message: string }[]) fieldErrors[d.path] = friendly(d.message);
    }
    throw new ApiError(res.status, body?.message ?? body?.error ?? apiT("Something went wrong. Please try again."), fieldErrors);
  }
  return body as T;
}

const post = <T>(path: string, data?: unknown) => request<T>(path, { method: "POST", body: data === undefined ? undefined : JSON.stringify(data) });
const del = <T>(path: string) => request<T>(path, { method: "DELETE" });
const get = <T>(path: string) => request<T>(path);

export interface EstimateResponse extends FullAssessmentResult {
  explanation: string[];
  savedId: string | null;
}

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: "USER" | "ADMIN";
  avatarUrl: string | null;
  needsProfile: boolean;
  mfaEnabled: boolean;
}

/** What to do after a successful first factor. */
export type SignInStatus = "ok" | "profile" | "mfa";

export interface DeviceSession {
  id: string;
  current: boolean;
  userAgent: string | null;
  ip: string | null;
  createdAt: string;
  lastSeenAt: string;
}

export interface AuthConfig {
  googleClientId: string | null;
  emailCodes: boolean;
  emailDelivery: "smtp" | "console" | "unavailable";
  ai: { enabled: boolean; tier: "free" | "paid" };
}

export interface ChatResponse {
  available: boolean;
  reply: string | null;
  interactionId: string | null;
  error?: string;
  remainingToday?: number;
}

export interface SavedEstimateRow {
  id: string;
  insuranceType: InsuranceType;
  riskScore: number;
  finalPremium: number;
  createdAt: string;
}

export interface PortfolioRow {
  applicantId: string;
  age: number;
  occupation: string;
  location: string;
  annualIncome: number;
  policyId: string;
  insuranceType: InsuranceType;
  policyNumber: string;
  coverageLevel: string;
  riskScore: number | null;
  riskCategory: string | null;
  finalPremium: number | null;
  fraudScore: number | null;
}

export interface DashboardData {
  kpis: PortfolioKpis;
  riskDistribution: RiskDistributionBucket[];
  premiumDistribution: { bucket: string; count: number }[];
  claimsByMonth: { month: string; count: number; totalAmount: number }[];
  riskVsPremium: { riskScore: number; premium: number; insuranceType: string }[];
  customerSegments: CustomerSegment[];
  geographicRisk: { location: string; averageRiskScore: number; averagePremium: number; count: number }[];
  fraudTrends: { anomalyLevel: string; count: number }[];
}

export interface UsageStats {
  users: number;
  newUsersWeek: number;
  activeSessions: number;
  savedEstimates: number;
  chats24h: number;
  chats7d: number;
  estimatesByType: { insuranceType: InsuranceType; n: number }[];
}

export const api = {
  // Estimates
  estimate: (applicant: ApplicantProfile, opts?: { save?: boolean }) =>
    post<EstimateResponse>(`/risk-assessment${opts?.save === false ? "?save=0" : ""}`, applicant),
  simulate: (baseline: ApplicantProfile, modified: ApplicantProfile) =>
    post<ScenarioSimulationResult>("/scenario/simulate", { baseline, modified }),
  askPreset: (questionId: AdvisorQuestionId, applicant: ApplicantProfile) =>
    post<{ questionId: AdvisorQuestionId; answer: string }>("/ai/advisor", { questionId, applicant }),
  askChat: (applicant: ApplicantProfile, question: string, previousInteractionId?: string) =>
    post<ChatResponse>("/ai/chat", { applicant, question, previousInteractionId }),

  // Auth
  authConfig: () => get<AuthConfig>("/auth/config"),
  me: () => get<{ user: SessionUser | null }>("/auth/me"),
  requestCode: (email: string) => post<{ ok: true; resendAfterSeconds: number }>("/auth/email/request", { email }),
  verifyCode: (email: string, code: string) => post<{ status: SignInStatus }>("/auth/email/verify", { email, code }),
  signInWithGoogle: (credential: string) => post<{ status: SignInStatus }>("/auth/google", { credential }),
  verifyMfa: (input: { code: string } | { recoveryCode: string }) => post<{ status: SignInStatus }>("/auth/mfa", input),
  signOut: () => post<{ ok: true }>("/auth/logout"),

  // Account
  savedEstimates: () => get<{ assessments: SavedEstimateRow[] }>("/me/assessments"),
  savedEstimate: (id: string) =>
    get<{ id: string; createdAt: string; applicant: ApplicantProfile; result: EstimateResponse }>(`/me/assessments/${id}`),
  deleteSavedEstimate: (id: string) => del<{ ok: true }>(`/me/assessments/${id}`),
  deleteAccount: () => del<{ ok: true }>("/me"),
  saveProfile: (name: string, acceptTerms?: boolean) => post<{ ok: true }>("/me/profile", { name, acceptTerms }),
  security: () => get<{ mfaEnabled: boolean; recoveryCodesLeft: number; sessions: DeviceSession[] }>("/me/security"),
  startMfaSetup: () => post<{ qr: string; secret: string; uri: string }>("/me/2fa/setup"),
  enableMfa: (code: string) => post<{ recoveryCodes: string[] }>("/me/2fa/enable", { code }),
  disableMfa: (input: { code: string } | { recoveryCode: string }) => post<{ ok: true }>("/me/2fa/disable", input),
  newRecoveryCodes: (code: string) => post<{ recoveryCodes: string[] }>("/me/2fa/recovery-codes", { code }),
  revokeSession: (id: string) => del<{ ok: true }>(`/me/sessions/${id}`),
  revokeOtherSessions: () => post<{ revoked: number }>("/me/sessions/revoke-others"),

  // Insurer workspace (sample portfolio)
  dashboard: () => get<DashboardData>("/dashboard"),
  portfolio: (params: { insuranceType?: string; riskCategory?: string; location?: string; limit?: number; offset?: number }) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "") qs.set(k, String(v));
    return get<{ total: number; limit: number; offset: number; applicants: PortfolioRow[] }>(`/applicants?${qs}`);
  },
  policyholder: (id: string) => get<any>(`/applicants/${id}`),
  usage: () => get<UsageStats>("/admin/usage"),
};
