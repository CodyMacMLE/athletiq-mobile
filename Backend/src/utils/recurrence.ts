import { RecurrenceFrequency } from "@prisma/client";

// Generate recurring event dates based on frequency and pattern
export function generateRecurringDates(
  startDate: Date,
  endDate: Date,
  frequency: RecurrenceFrequency,
  daysOfWeek: number[]
): Date[] {
  const dates: Date[] = [];
  // Use UTC methods throughout to avoid local-timezone shifts
  const current = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate(), 12, 0, 0));
  const end = new Date(Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), endDate.getUTCDate(), 23, 59, 59));

  // Helper to push a noon-UTC copy of a date
  const pushNoonUTC = (d: Date) => {
    dates.push(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 12, 0, 0)));
  };

  switch (frequency) {
    case "DAILY":
      while (current <= end) {
        pushNoonUTC(current);
        current.setUTCDate(current.getUTCDate() + 1);
      }
      break;

    case "WEEKLY":
      while (current <= end) {
        if (daysOfWeek.includes(current.getUTCDay())) {
          pushNoonUTC(current);
        }
        current.setUTCDate(current.getUTCDate() + 1);
      }
      break;

    case "BIWEEKLY": {
      const weekStart = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate(), 12, 0, 0));
      weekStart.setUTCDate(weekStart.getUTCDate() - weekStart.getUTCDay());
      while (current <= end) {
        const daysSinceWeekStart = Math.floor(
          (current.getTime() - weekStart.getTime()) / (1000 * 60 * 60 * 24)
        );
        const weekNumber = Math.floor(daysSinceWeekStart / 7);
        if (weekNumber % 2 === 0 && daysOfWeek.includes(current.getUTCDay())) {
          pushNoonUTC(current);
        }
        current.setUTCDate(current.getUTCDate() + 1);
      }
      break;
    }

    case "MONTHLY": {
      const dayOfMonth = startDate.getUTCDate();
      const currentMonth = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), 1, 12, 0, 0));
      while (currentMonth <= end) {
        const targetDate = new Date(Date.UTC(currentMonth.getUTCFullYear(), currentMonth.getUTCMonth(), dayOfMonth, 12, 0, 0));
        if (targetDate >= startDate && targetDate <= end && targetDate.getUTCDate() === dayOfMonth) {
          pushNoonUTC(targetDate);
        }
        currentMonth.setUTCMonth(currentMonth.getUTCMonth() + 1);
      }
      break;
    }
  }

  return dates;
}
