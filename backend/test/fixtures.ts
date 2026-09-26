import type { ApplicantProfile } from "@insurtechai/shared";

const personal = { age: 32, gender: "MALE", occupation: "Engineer", location: "Pune", annualIncome: 1200000, maritalStatus: "MARRIED", dependents: 1 } as const;

export function motor(over: Partial<NonNullable<ApplicantProfile["motor"]>> = {}, income = 1200000): ApplicantProfile {
  return {
    personal: { ...personal, annualIncome: income },
    policy: { insuranceType: "MOTOR", coverageLevel: "STANDARD", deductible: 0 },
    claimsLast12Months: 0,
    recentClaimDatesIso: [],
    motor: {
      vehicleAgeYears: 2, exShowroomPrice: 1000000, vehicleValue: 700000, claimFreeYears: 2, vehicleType: "SEDAN", engineCapacityCC: 1200,
      annualMileageKm: 12000, previousAccidents: 0, previousClaims: 0, drivingExperienceYears: 8, trafficViolations: 0, hasTrackingDevice: false,
      ...over,
    },
  };
}

export function health(age = 32, income = 1200000): ApplicantProfile {
  return {
    personal: { ...personal, age, annualIncome: income },
    policy: { insuranceType: "HEALTH", coverageLevel: "STANDARD", deductible: 0 },
    claimsLast12Months: 0,
    recentClaimDatesIso: [],
    health: { bmi: 24, smoker: false, alcoholUse: "NONE", exerciseFrequency: "REGULAR", existingConditions: [], familyMedicalHistory: [] },
  };
}

export function life(coverageAmount = 10000000, income = 1200000): ApplicantProfile {
  return {
    personal: { ...personal, annualIncome: income },
    policy: { insuranceType: "LIFE", coverageLevel: "STANDARD", deductible: 0 },
    claimsLast12Months: 0,
    recentClaimDatesIso: [],
    life: { coverageAmount, policyTermYears: 30, occupationRiskClass: "LOW", smoker: false, preExistingConditions: false },
  };
}
