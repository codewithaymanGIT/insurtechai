// Motor IDV and no-claim bonus rules, shared by the engine and the form so the
// number people see while typing is the number they get.
//
// IDV = ex-showroom price minus depreciation by age (India Motor Tariff GR 8,
// still applied by insurers). Over 5 years there is no schedule: the IDV is
// agreed between the owner and the insurer.
// NCB applies to the own-damage premium only: 20/25/35/45/50% after 1-5+
// consecutive claim-free years; it drops to 0 after a claim.
// Sources: IFFCO Tokio IDV table; Zurich Kotak (Sep 2026); Tata AIG on NCB.

export const IDV_DEPRECIATION: readonly { maxAge: number; percent: number; band: string }[] = [
  { maxAge: 0.5, percent: 5, band: "Up to 6 months" },
  { maxAge: 1, percent: 15, band: "6 months to 1 year" },
  { maxAge: 2, percent: 20, band: "1 to 2 years" },
  { maxAge: 3, percent: 30, band: "2 to 3 years" },
  { maxAge: 4, percent: 40, band: "3 to 4 years" },
  { maxAge: 5, percent: 50, band: "4 to 5 years" },
];

/** Values the form offers for vehicle age: the lower bound of each band. */
export const VEHICLE_AGE_STEPS = [0, 0.5, 1, 2, 3, 4, 5] as const;

/** NCB on own-damage premium after 0,1,2,3,4,5+ consecutive claim-free years. */
export const NCB_SLABS = [0, 20, 25, 35, 45, 50] as const;

export function clampClaimFreeYears(y: number | undefined): number {
  return Math.max(0, Math.min(5, Math.floor(y ?? 0)));
}

export function ncbFor(claimFreeYears: number | undefined): number {
  return NCB_SLABS[clampClaimFreeYears(claimFreeYears)];
}

/** Snaps any age to the band's lower bound used by the form. */
export function vehicleAgeStep(age: number): number {
  if (!Number.isFinite(age) || age < 0.5) return 0;
  if (age < 1) return 0.5;
  return Math.min(5, Math.floor(age));
}

/** ageYears is the lower bound of the band, so compare with "<". Null over 5 years. */
export function depreciationFor(ageYears: number): { percent: number; band: string } | null {
  const hit = IDV_DEPRECIATION.find((d) => ageYears < d.maxAge);
  return hit ? { percent: hit.percent, band: hit.band } : null;
}

/** IDV rounded to ₹100, or null when the vehicle is over 5 years old. */
export function idvFromExShowroom(exShowroom: number, ageYears: number): number | null {
  const dep = depreciationFor(ageYears);
  if (!dep || !(exShowroom > 0)) return null;
  return Math.round((exShowroom * (100 - dep.percent)) / 100 / 100) * 100;
}
