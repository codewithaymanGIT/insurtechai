import { z } from "zod";
import { LOCATIONS, ApplicantProfile } from "@insurtechai/shared";

const locationEnum = z.enum(LOCATIONS as unknown as [string, ...string[]]);

export const personalSchema = z.object({
  age: z.number().int().min(18).max(100),
  gender: z.enum(["MALE", "FEMALE", "OTHER"]),
  occupation: z.string().min(1).max(100),
  location: locationEnum,
  annualIncome: z.number().min(0).max(1_000_000_000),
  maritalStatus: z.enum(["SINGLE", "MARRIED", "DIVORCED", "WIDOWED"]),
  dependents: z.number().int().min(0).max(15),
});

export const healthSchema = z.object({
  bmi: z.number().min(10).max(70),
  smoker: z.boolean(),
  alcoholUse: z.enum(["NONE", "OCCASIONAL", "MODERATE", "HEAVY"]),
  exerciseFrequency: z.enum(["NONE", "OCCASIONAL", "REGULAR", "ATHLETE"]),
  existingConditions: z.array(z.string()).max(20),
  familyMedicalHistory: z.array(z.string()).max(20),
});

export const motorSchema = z.object({
  vehicleAgeYears: z.number().min(0).max(40),
  exShowroomPrice: z.number().min(10000).max(100_000_000).optional(),
  claimFreeYears: z.number().int().min(0).max(5).optional(),
  vehicleValue: z.number().min(10000).max(100_000_000),
  vehicleType: z.enum(["HATCHBACK", "SEDAN", "SUV", "TWO_WHEELER", "COMMERCIAL"]),
  engineCapacityCC: z.number().min(50).max(10000),
  annualMileageKm: z.number().min(0).max(200000),
  previousAccidents: z.number().int().min(0).max(20),
  previousClaims: z.number().int().min(0).max(20),
  drivingExperienceYears: z.number().int().min(0).max(70),
  trafficViolations: z.number().int().min(0).max(50),
  hasTrackingDevice: z.boolean(),
});

export const propertySchema = z.object({
  propertyValue: z.number().min(50000).max(1_000_000_000),
  propertyAgeYears: z.number().int().min(0).max(150),
  constructionType: z.enum(["RCC_CONCRETE", "BRICK_MASONRY", "WOODEN", "PREFAB", "OTHER"]),
  hasSecuritySystem: z.boolean(),
  previousClaims: z.number().int().min(0).max(20),
  floodRiskZone: z.boolean(),
  fireRiskZone: z.boolean(),
  disasterExposureZone: z.boolean(),
});

export const lifeSchema = z.object({
  coverageAmount: z.number().min(100000).max(500_000_000),
  policyTermYears: z.number().int().min(1).max(50),
  occupationRiskClass: z.enum(["LOW", "MEDIUM", "HIGH"]),
  smoker: z.boolean(),
  preExistingConditions: z.boolean(),
});

export const policyMetaSchema = z.object({
  insuranceType: z.enum(["HEALTH", "MOTOR", "PROPERTY", "LIFE"]),
  coverageLevel: z.enum(["BASIC", "STANDARD", "PREMIUM", "COMPREHENSIVE"]),
  deductible: z.number().min(0).max(10_000_000),
});

export const applicantProfileSchema = z
  .object({
    personal: personalSchema,
    health: healthSchema.optional(),
    motor: motorSchema.optional(),
    property: propertySchema.optional(),
    life: lifeSchema.optional(),
    policy: policyMetaSchema,
    claimsLast12Months: z.number().int().min(0).max(50).optional(),
    recentClaimDatesIso: z.array(z.string()).max(50).optional(),
  })
  .superRefine((val, ctx) => {
    const requiredMap: Record<string, keyof typeof val> = {
      MOTOR: "motor",
      PROPERTY: "property",
      LIFE: "life",
      HEALTH: "health",
    };
    const requiredKey = requiredMap[val.policy.insuranceType];
    if (!val[requiredKey]) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `"${requiredKey}" profile is required when policy.insuranceType is ${val.policy.insuranceType}`,
        path: [requiredKey],
      });
    }
  });

export const scenarioRequestSchema = z.object({
  baseline: applicantProfileSchema,
  modified: applicantProfileSchema,
  label: z.string().optional(),
});

export const advisorRequestSchema = z.object({
  questionId: z.enum([
    "WHY_PREMIUM_HIGH",
    "HOW_TO_REDUCE",
    "BIGGEST_RISK",
    "WHICH_FACTOR_MOST",
    "WHAT_SAVES_MOST",
    "WHAT_TO_IMPROVE_FIRST",
  ]),
  applicant: applicantProfileSchema,
});

// zod's z.enum() widens Location to `string` (see LOCATIONS cast above), so
// the parsed shape is structurally identical to ApplicantProfile but not
// nominally typed as one. These helpers make the intentional narrowing
// explicit and centralized, rather than casting at every call site.
export function parseApplicantProfile(input: unknown): ApplicantProfile {
  return applicantProfileSchema.parse(input) as unknown as ApplicantProfile;
}

export function parseScenarioRequest(input: unknown): { baseline: ApplicantProfile; modified: ApplicantProfile; label?: string } {
  return scenarioRequestSchema.parse(input) as unknown as { baseline: ApplicantProfile; modified: ApplicantProfile; label?: string };
}

export function parseAdvisorRequest(input: unknown): { questionId: import("@insurtechai/shared").AdvisorQuestionId; applicant: ApplicantProfile } {
  return advisorRequestSchema.parse(input) as unknown as { questionId: import("@insurtechai/shared").AdvisorQuestionId; applicant: ApplicantProfile };
}

export const chatRequestSchema = z.object({
  applicant: applicantProfileSchema,
  question: z.string().trim().min(1).max(500),
  previousInteractionId: z.string().max(200).optional(),
});

export function parseChatRequest(input: unknown): { applicant: ApplicantProfile; question: string; previousInteractionId?: string } {
  return chatRequestSchema.parse(input) as unknown as { applicant: ApplicantProfile; question: string; previousInteractionId?: string };
}
