export const eligibilityKey = "nuelexity:eligibility.v1";
export const eligibilityVersion = "adults-v1-2026-10-30";
export function hasEligibility(storage: Pick<Storage, "getItem">): boolean {
  try {
    const record = JSON.parse(storage.getItem(eligibilityKey) || "null");
    return record?.version === eligibilityVersion && record?.adult === true && record?.terms === true &&
      typeof record.confirmedAt === "string" && Number.isFinite(Date.parse(record.confirmedAt));
  } catch { return false; }
}
export function confirmEligibility(storage: Pick<Storage, "setItem">): void {
  storage.setItem(eligibilityKey, JSON.stringify({ version: eligibilityVersion, adult: true, terms: true, confirmedAt: new Date().toISOString() }));
}
