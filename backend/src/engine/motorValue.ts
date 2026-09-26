// ============================================================================
// Motor IDV and no-claim bonus. The rules themselves live in the shared
// package (so the form previews the same IDV); this file applies them to a
// profile. See shared/src/motor.ts for sources.
// ============================================================================

import { ApplicantProfile, MotorValue, clampClaimFreeYears, depreciationFor, idvFromExShowroom, ncbFor } from "@insurtechai/shared";
import { tr } from "../i18n";

export { NCB_SLABS, ncbFor, depreciationFor } from "@insurtechai/shared";

/** Recomputes the IDV from the ex-showroom price where the schedule applies,
 * and returns the profile the rest of the engine should use. */
export function normaliseMotor(a: ApplicantProfile): ApplicantProfile {
  if (!a.motor?.exShowroomPrice) return a;
  const idv = idvFromExShowroom(a.motor.exShowroomPrice, a.motor.vehicleAgeYears);
  if (idv === null) return a;
  return { ...a, motor: { ...a.motor, vehicleValue: idv } };
}

export function describeMotorValue(a: ApplicantProfile): MotorValue | null {
  if (!a.motor) return null;
  const dep = a.motor.exShowroomPrice ? depreciationFor(a.motor.vehicleAgeYears) : null;
  const years = clampClaimFreeYears(a.motor.claimFreeYears);
  return {
    idv: a.motor.vehicleValue,
    exShowroomPrice: dep ? a.motor.exShowroomPrice ?? null : null,
    depreciationPercent: dep?.percent ?? null,
    ageBand: dep ? tr(dep.band) : a.motor.vehicleAgeYears >= 5 ? tr("Over 5 years (IDV agreed with the insurer)") : tr("IDV entered by you"),
    ncbPercent: ncbFor(years),
    claimFreeYears: years,
    nextNcbPercent: ncbFor(years + 1),
  };
}
