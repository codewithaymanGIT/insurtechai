import type { ApplicantProfile, InsuranceType } from "@insurtechai/shared";

/** Starting values so the form is never blank. Every field is editable. */
export function defaultApplicant(insuranceType: InsuranceType, keepPersonal?: ApplicantProfile["personal"]): ApplicantProfile {
  const base: ApplicantProfile = {
    personal: keepPersonal ?? {
      age: 32,
      gender: "MALE",
      occupation: "Salaried, office-based",
      location: "Pune",
      annualIncome: 1200000,
      maritalStatus: "MARRIED",
      dependents: 1,
    },
    policy: {
      insuranceType,
      coverageLevel: "STANDARD",
      deductible: insuranceType === "MOTOR" ? 0 : insuranceType === "PROPERTY" ? 10000 : 0,
    },
    claimsLast12Months: 0,
    recentClaimDatesIso: [],
  };

  switch (insuranceType) {
    case "HEALTH":
      base.health = {
        bmi: 24.2,
        smoker: false,
        alcoholUse: "OCCASIONAL",
        exerciseFrequency: "OCCASIONAL",
        existingConditions: [],
        familyMedicalHistory: [],
      };
      break;
    case "MOTOR":
      base.motor = {
        vehicleAgeYears: 2,
        exShowroomPrice: 1000000,
        vehicleValue: 700000,
        claimFreeYears: 2,
        vehicleType: "SEDAN",
        engineCapacityCC: 1200,
        annualMileageKm: 12000,
        previousAccidents: 0,
        previousClaims: 0,
        drivingExperienceYears: 8,
        trafficViolations: 0,
        hasTrackingDevice: false,
      };
      break;
    case "PROPERTY":
      base.property = {
        propertyValue: 6500000,
        propertyAgeYears: 10,
        constructionType: "RCC_CONCRETE",
        hasSecuritySystem: false,
        previousClaims: 0,
        floodRiskZone: false,
        fireRiskZone: false,
        disasterExposureZone: false,
      };
      break;
    case "LIFE":
      base.life = {
        coverageAmount: 10000000,
        policyTermYears: 30,
        occupationRiskClass: "LOW",
        smoker: false,
        preExistingConditions: false,
      };
      break;
  }
  return base;
}
