// Parse a date-only string (YYYY-MM-DD) to noon UTC to avoid timezone off-by-one.
// new Date("2026-02-11") parses as UTC midnight, which is Feb 10th in US timezones.
// Noon UTC is the same calendar date in every inhabited timezone.
export function parseDateInput(dateStr: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return new Date(dateStr + "T12:00:00.000Z");
  }
  return new Date(dateStr);
}

// Helper to safely serialize Date objects to ISO strings for GraphQL String fields
export const toISO = (val: any) => val instanceof Date ? val.toISOString() : val;

// Strip all non-digit characters from a phone number before persisting
export const sanitizePhone = (phone?: string | null): string | undefined => {
  if (!phone) return undefined;
  const digits = phone.replace(/\D/g, "");
  return digits || undefined;
};

// Helper to calculate date range
export function getDateRange(timeRange: string | undefined): { startDate: Date; endDate: Date } {
  const now = new Date();
  let startDate: Date;

  switch (timeRange) {
    case "WEEK":
      startDate = new Date(now);
      startDate.setDate(now.getDate() - 7);
      break;
    case "MONTH":
      startDate = new Date(now);
      startDate.setMonth(now.getMonth() - 1);
      break;
    case "ALL":
    default:
      startDate = new Date(0); // Beginning of time
  }

  return { startDate, endDate: now };
}

// Compute actual start/end Date objects for a season given its month range and year.
// The seasonYear represents the END year of the season (e.g. a Sep-Jun season
// spanning 2025-2026 has seasonYear=2026).
export function getSeasonDateRange(startMonth: number, endMonth: number, seasonYear: number): { start: Date; end: Date } {
  if (startMonth <= endMonth) {
    // Same-year season: e.g. Mar-Aug 2025
    const start = new Date(Date.UTC(seasonYear, startMonth - 1, 1));
    const end = new Date(Date.UTC(seasonYear, endMonth, 0, 23, 59, 59)); // last day of endMonth
    return { start, end };
  } else {
    // Cross-year season: e.g. Sep-Jun with seasonYear 2026 → Sep 1 2025 to Jun 30 2026
    const start = new Date(Date.UTC(seasonYear - 1, startMonth - 1, 1));
    const end = new Date(Date.UTC(seasonYear, endMonth, 0, 23, 59, 59));
    return { start, end };
  }
}

// Returns true if today falls within the team's computed season period.
// Legacy teams (no orgSeason) always return true.
export function isTeamInCurrentSeason(team: { orgSeasonId?: string | null; seasonYear?: number | null; orgSeason?: { startMonth: number; endMonth: number } | null }): boolean {
  if (!team.orgSeason || !team.seasonYear) return true;
  const now = new Date();
  const { start, end } = getSeasonDateRange(team.orgSeason.startMonth, team.orgSeason.endMonth, team.seasonYear);
  return now >= start && now <= end;
}

export function toWeekStart(date: Date): string {
  const d = new Date(date);
  const day = d.getUTCDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day; // shift to Monday
  d.setUTCDate(d.getUTCDate() + diff);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString().split("T")[0];
}

export const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function generateSeasonDisplayString(seasonName: string, seasonYear: number): string {
  return `${seasonName} ${seasonYear}`;
}

// Parse time strings like "6:00 PM" or "14:00" into hours/minutes
export function parseTimeString(timeStr: string): { hours: number; minutes: number } {
  const match = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (match) {
    let hours = parseInt(match[1]);
    const minutes = parseInt(match[2]);
    const period = match[3].toUpperCase();
    if (period === "PM" && hours !== 12) hours += 12;
    if (period === "AM" && hours === 12) hours = 0;
    return { hours, minutes };
  }
  const [h, m] = timeStr.split(":").map(Number);
  return { hours: h, minutes: m };
}

/**
 * Compute the duration of an event in hours given its startTime and endTime strings.
 * Returns 0 for "All Day" events or any unparseable/invalid input.
 */
export function computeEventDuration(startTime: string, endTime: string): number {
  if (!startTime || !endTime || startTime === "All Day" || endTime === "All Day") return 0;
  const start = parseTimeString(startTime);
  const end = parseTimeString(endTime);
  const minutes = (end.hours * 60 + end.minutes) - (start.hours * 60 + start.minutes);
  return Math.max(0, minutes / 60);
}
