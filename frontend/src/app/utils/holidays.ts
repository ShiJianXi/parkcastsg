export const SINGAPORE_PUBLIC_HOLIDAYS_YYYY_MM_DD = new Set([
  // 2026 Public Holidays (Estimated/Confirmed for SGT)
  "2026-01-01", // New Year's Day
  "2026-02-17", // Chinese New Year
  "2026-02-18", // Chinese New Year (2nd Day)
  "2026-03-20", // Hari Raya Puasa
  "2026-04-03", // Good Friday
  "2026-05-01", // Labour Day
  "2026-05-26", // Hari Raya Haji
  "2026-05-31", // Vesak Day
  "2026-06-01", // Vesak Day (Observed)
  "2026-08-09", // National Day
  "2026-08-10", // National Day (Observed)
  "2026-11-08", // Deepavali
  "2026-11-09", // Deepavali (Observed)
  "2026-12-25", // Christmas Day

  // 2027 Public Holidays (Estimates)
  "2027-01-01",
  "2027-02-06",
  "2027-02-07",
  "2027-03-10",
  "2027-03-26",
  "2027-05-01",
  "2027-05-16",
  "2027-05-20",
  "2027-08-09",
  "2027-10-29",
  "2027-12-25"
]);

/**
 * Checks if a given Date object (in SGT) is a Public Holiday or a Sunday.
 * @param sgtDate Date object representing current SGT time
 */
export function isSundayOrPublicHoliday(sgtDate: Date): boolean {
  // 0 = Sunday
  if (sgtDate.getDay() === 0) {
    return true;
  }

  // Format date as YYYY-MM-DD in local time (which we assume is already SGT if constructed properly)
  const yyyy = sgtDate.getFullYear();
  const mm = String(sgtDate.getMonth() + 1).padStart(2, "0");
  const dd = String(sgtDate.getDate()).padStart(2, "0");
  
  return SINGAPORE_PUBLIC_HOLIDAYS_YYYY_MM_DD.has(`${yyyy}-${mm}-${dd}`);
}
