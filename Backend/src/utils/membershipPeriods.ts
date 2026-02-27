export interface MembershipPeriod {
  joinedAt: Date;
  leftAt: Date | null;
}

/**
 * Returns true if the given event date falls within any of the membership
 * periods (inclusive on both ends; leftAt: null means currently active).
 */
export function eventDuringMembership(
  eventDate: Date,
  periods: MembershipPeriod[]
): boolean {
  return periods.some(
    ({ joinedAt, leftAt }) =>
      eventDate >= joinedAt && (leftAt === null || eventDate <= leftAt)
  );
}

/**
 * Filter an array of events (each with a `date` field) to only those that fall
 * within at least one of the membership periods.
 */
export function filterEventsByMembership<T extends { date: Date }>(
  events: T[],
  periods: MembershipPeriod[]
): T[] {
  return events.filter((e) => eventDuringMembership(e.date, periods));
}
