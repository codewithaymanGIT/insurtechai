// InsurTechAI: Drizzle schema (SQLite via @libsql/client).
//
// SQLite keeps local setup to zero external services. Moving to Postgres
// means switching to drizzle-orm/node-postgres and pgTable column helpers;
// the table shapes and relations below stay the same.

import { sqliteTable, text, integer, real, index } from "drizzle-orm/sqlite-core";
import { relations, sql } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";

export const genId = () => createId();

// ---------------------------------------------------------------------------
// Auth: Google sign-in + email one-time codes, server-side sessions.
// See src/auth/ for the flow. Session tokens and OTP codes are only ever
// stored as hashes, never in plain text.
// ---------------------------------------------------------------------------

export const users = sqliteTable("users", {
  id: text("id").primaryKey().$defaultFn(genId),
  email: text("email").notNull().unique(), // always stored lowercased
  name: text("name").notNull(),
  role: text("role", { enum: ["USER", "ADMIN"] }).notNull().default("USER"),
  googleSub: text("google_sub").unique(),
  avatarUrl: text("avatar_url"),
  emailVerifiedAt: text("email_verified_at"),
  lastLoginAt: text("last_login_at"),
  // Set when the user completes signup (name + agreeing to the terms).
  termsAcceptedAt: text("terms_accepted_at"),
  // Authenticator-app 2FA. Secrets are AES-256-GCM encrypted with a key
  // derived from AUTH_SECRET; the pending secret is kept until confirmed.
  totpSecretEnc: text("totp_secret_enc"),
  totpPendingEnc: text("totp_pending_enc"),
  totpEnabledAt: text("totp_enabled_at"),
  totpLastStep: integer("totp_last_step"), // blocks reuse of a code
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const recoveryCodes = sqliteTable("recovery_codes", {
  id: text("id").primaryKey().$defaultFn(genId),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  codeHash: text("code_hash").notNull(),
  usedAt: text("used_at"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (t) => [index("recovery_codes_user_idx").on(t.userId)]);

// Short-lived state between the first factor (email code / Google) and the
// authenticator code. Token lives in an httpOnly cookie; only its hash here.
export const mfaChallenges = sqliteTable("mfa_challenges", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: text("expires_at").notNull(),
  attempts: integer("attempts").notNull().default(0),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const sessions = sqliteTable("sessions", {
  // SHA-256 of the random token held in the httpOnly cookie
  id: text("id").primaryKey(),
  // Safe-to-expose id for the "signed-in devices" list
  publicId: text("public_id").notNull().$defaultFn(genId),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: text("expires_at").notNull(),
  lastSeenAt: text("last_seen_at").notNull(),
  userAgent: text("user_agent"),
  ip: text("ip"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (t) => [index("sessions_user_idx").on(t.userId)]);

export const emailOtps = sqliteTable("email_otps", {
  id: text("id").primaryKey().$defaultFn(genId),
  email: text("email").notNull(),
  // HMAC-SHA256(AUTH_SECRET, email:code)
  codeHash: text("code_hash").notNull(),
  expiresAt: text("expires_at").notNull(),
  attempts: integer("attempts").notNull().default(0),
  consumedAt: text("consumed_at"),
  ip: text("ip"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (t) => [index("email_otps_email_idx").on(t.email, t.createdAt)]);

// A signed-in visitor's own saved estimates. Deliberately separate from the
// applicants/policies tables below, which hold the synthetic sample
// portfolio shown in the insurer workspace, so one visitor's details can
// never appear in anyone else's view.
export const savedAssessments = sqliteTable("saved_assessments", {
  id: text("id").primaryKey().$defaultFn(genId),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  insuranceType: text("insurance_type", { enum: ["HEALTH", "MOTOR", "PROPERTY", "LIFE"] }).notNull(),
  riskScore: real("risk_score").notNull(),
  finalPremium: real("final_premium").notNull(),
  applicantJson: text("applicant_json").notNull(),
  resultJson: text("result_json").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (t) => [index("saved_assessments_user_idx").on(t.userId, t.createdAt)]);

// Metered actions (currently: LLM chat messages) for per-user quotas and
// the admin usage panel.
export const usageEvents = sqliteTable("usage_events", {
  id: text("id").primaryKey().$defaultFn(genId),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  kind: text("kind", { enum: ["CHAT"] }).notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (t) => [index("usage_events_user_idx").on(t.userId, t.kind, t.createdAt)]);

// ---------------------------------------------------------------------------
// Core domain
// ---------------------------------------------------------------------------

export const applicants = sqliteTable("applicants", {
  id: text("id").primaryKey().$defaultFn(genId),
  userId: text("user_id").references(() => users.id),

  age: integer("age").notNull(),
  gender: text("gender").notNull(),
  occupation: text("occupation").notNull(),
  location: text("location").notNull(),
  annualIncome: real("annual_income").notNull(),
  maritalStatus: text("marital_status").notNull(),
  dependents: integer("dependents").notNull(),

  // JSON-serialized sub-profiles (only the ones relevant to the applicant's
  // insurance type(s) are populated)
  healthProfile: text("health_profile"),
  motorProfile: text("motor_profile"),
  propertyProfile: text("property_profile"),
  lifeProfile: text("life_profile"),

  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const policies = sqliteTable("policies", {
  id: text("id").primaryKey().$defaultFn(genId),
  applicantId: text("applicant_id").notNull().references(() => applicants.id),

  insuranceType: text("insurance_type", { enum: ["HEALTH", "MOTOR", "PROPERTY", "LIFE"] }).notNull(),
  coverageLevel: text("coverage_level").notNull(),
  deductible: real("deductible").notNull(),
  policyNumber: text("policy_number").notNull().unique(),
  status: text("status").notNull().default("ACTIVE"),
  startedAt: text("started_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const riskAssessments = sqliteTable("risk_assessments", {
  id: text("id").primaryKey().$defaultFn(genId),
  policyId: text("policy_id").notNull().references(() => policies.id),

  riskScore: real("risk_score").notNull(),
  rawScore: real("raw_score").notNull(),
  riskCategory: text("risk_category", {
    enum: ["VERY_LOW", "LOW", "MODERATE", "HIGH", "VERY_HIGH"],
  }).notNull(),
  categoryBreakdownJson: text("category_breakdown_json").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const riskFactors = sqliteTable("risk_factors", {
  id: text("id").primaryKey().$defaultFn(genId),
  riskAssessmentId: text("risk_assessment_id").notNull().references(() => riskAssessments.id),

  name: text("name").notNull(),
  category: text("category").notNull(),
  impact: real("impact").notNull(),
  direction: text("direction", { enum: ["positive", "negative"] }).notNull(),
  description: text("description").notNull(),
});

export const premiumCalculations = sqliteTable("premium_calculations", {
  id: text("id").primaryKey().$defaultFn(genId),
  policyId: text("policy_id").notNull().references(() => policies.id),
  riskAssessmentId: text("risk_assessment_id").notNull().references(() => riskAssessments.id).unique(),

  basePremium: real("base_premium").notNull(),
  riskMultiplier: real("risk_multiplier").notNull(),
  coverageMultiplier: real("coverage_multiplier").notNull(),
  locationFactor: real("location_factor").notNull(),
  claimHistoryFactor: real("claim_history_factor").notNull(),
  fraudAdjustment: real("fraud_adjustment").notNull(),
  deductibleFactor: real("deductible_factor").notNull(),
  finalPremium: real("final_premium").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const claims = sqliteTable("claims", {
  id: text("id").primaryKey().$defaultFn(genId),
  policyId: text("policy_id").notNull().references(() => policies.id),

  claimAmount: real("claim_amount").notNull(),
  claimDate: text("claim_date").notNull(),
  claimType: text("claim_type").notNull(),
  status: text("status").notNull().default("SETTLED"),
  description: text("description"),
});

export const fraudAssessments = sqliteTable("fraud_assessments", {
  id: text("id").primaryKey().$defaultFn(genId),
  policyId: text("policy_id").notNull().references(() => policies.id),
  riskAssessmentId: text("risk_assessment_id").references(() => riskAssessments.id).unique(),

  fraudScore: real("fraud_score").notNull(),
  anomalyLevel: text("anomaly_level", { enum: ["LOW", "MODERATE", "HIGH"] }).notNull(),
  signalsJson: text("signals_json").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const scenarios = sqliteTable("scenarios", {
  id: text("id").primaryKey().$defaultFn(genId),
  applicantId: text("applicant_id").notNull().references(() => applicants.id),

  label: text("label").notNull(),
  baselineJson: text("baseline_json").notNull(),
  scenarioJson: text("scenario_json").notNull(),
  riskScoreDelta: real("risk_score_delta").notNull(),
  premiumDelta: real("premium_delta").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const recommendations = sqliteTable("recommendations", {
  id: text("id").primaryKey().$defaultFn(genId),
  riskAssessmentId: text("risk_assessment_id").notNull().references(() => riskAssessments.id),

  title: text("title").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(),
  estimatedSavingAmount: real("estimated_saving_amount").notNull(),
  estimatedSavingPercent: real("estimated_saving_percent").notNull(),
  effort: text("effort", { enum: ["Low", "Medium", "High"] }).notNull(),
  impactPerEffort: real("impact_per_effort").notNull(),
});

// ---------------------------------------------------------------------------
// Relations (for Drizzle's relational query API)
// ---------------------------------------------------------------------------

export const applicantsRelations = relations(applicants, ({ many, one }) => ({
  user: one(users, { fields: [applicants.userId], references: [users.id] }),
  policies: many(policies),
  scenarios: many(scenarios),
}));

export const policiesRelations = relations(policies, ({ one, many }) => ({
  applicant: one(applicants, { fields: [policies.applicantId], references: [applicants.id] }),
  riskAssessments: many(riskAssessments),
  premiumCalculations: many(premiumCalculations),
  claims: many(claims),
  fraudAssessments: many(fraudAssessments),
}));

export const riskAssessmentsRelations = relations(riskAssessments, ({ one, many }) => ({
  policy: one(policies, { fields: [riskAssessments.policyId], references: [policies.id] }),
  factors: many(riskFactors),
  premium: one(premiumCalculations, {
    fields: [riskAssessments.id],
    references: [premiumCalculations.riskAssessmentId],
  }),
  fraudAssessment: one(fraudAssessments, {
    fields: [riskAssessments.id],
    references: [fraudAssessments.riskAssessmentId],
  }),
  recommendations: many(recommendations),
}));

export const riskFactorsRelations = relations(riskFactors, ({ one }) => ({
  riskAssessment: one(riskAssessments, {
    fields: [riskFactors.riskAssessmentId],
    references: [riskAssessments.id],
  }),
}));

export const premiumCalculationsRelations = relations(premiumCalculations, ({ one }) => ({
  policy: one(policies, { fields: [premiumCalculations.policyId], references: [policies.id] }),
  riskAssessment: one(riskAssessments, {
    fields: [premiumCalculations.riskAssessmentId],
    references: [riskAssessments.id],
  }),
}));

export const claimsRelations = relations(claims, ({ one }) => ({
  policy: one(policies, { fields: [claims.policyId], references: [policies.id] }),
}));

export const fraudAssessmentsRelations = relations(fraudAssessments, ({ one }) => ({
  policy: one(policies, { fields: [fraudAssessments.policyId], references: [policies.id] }),
  riskAssessment: one(riskAssessments, {
    fields: [fraudAssessments.riskAssessmentId],
    references: [riskAssessments.id],
  }),
}));

export const scenariosRelations = relations(scenarios, ({ one }) => ({
  applicant: one(applicants, { fields: [scenarios.applicantId], references: [applicants.id] }),
}));

export const recommendationsRelations = relations(recommendations, ({ one }) => ({
  riskAssessment: one(riskAssessments, {
    fields: [recommendations.riskAssessmentId],
    references: [riskAssessments.id],
  }),
}));

export const usersRelations = relations(users, ({ one }) => ({
  applicant: one(applicants, { fields: [users.id], references: [applicants.userId] }),
}));
