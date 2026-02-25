import { prisma } from "../db.js";
import { parseTimeString } from "../utils/time.js";

interface AutoCheckoutOptions {
  /** How far back to look for ended events, in minutes. Defaults to 30. */
  lookbackMinutes?: number;
}

/**
 * Find recently-ended events and auto-checkout any check-ins that are still
 * open (checkOutTime is null, status ON_TIME or LATE).
 *
 * Uses the event's end time as the effective checkout time and caps
 * hoursLogged at the event duration — matching the same effectiveStart
 * logic used by the manual checkOut resolver.
 */
export async function autoCheckoutEndedEvents(options?: AutoCheckoutOptions): Promise<number> {
  const lookbackMinutes = options?.lookbackMinutes ?? 30;
  const lookbackDate = new Date();
  lookbackDate.setMinutes(lookbackDate.getMinutes() - lookbackMinutes);

  const now = new Date();

  // Find events whose date falls in the lookback window.
  // We then verify the computed end datetime has passed before acting.
  const events = await prisma.event.findMany({
    where: {
      isAdHoc: false,
      date: { gte: lookbackDate, lte: now },
    },
    select: {
      id: true,
      date: true,
      startTime: true,
      endTime: true,
    },
  });

  let totalUpdated = 0;

  for (const event of events) {
    // Compute actual end datetime from date + endTime
    const eventDate = new Date(event.date);
    const { hours: endH, minutes: endM } = parseTimeString(event.endTime);
    const eventEnd = new Date(eventDate);
    eventEnd.setHours(endH, endM, 0, 0);

    if (eventEnd >= now) continue; // Event hasn't fully ended yet

    // Compute event start datetime (used as effective start floor)
    const { hours: startH, minutes: startM } = parseTimeString(event.startTime);
    const eventStart = new Date(eventDate);
    eventStart.setHours(startH, startM, 0, 0);

    // Find all open check-ins for this event (attended but never checked out)
    const openCheckIns = await prisma.checkIn.findMany({
      where: {
        eventId: event.id,
        checkOutTime: null,
        checkInTime: { not: null },
        status: { in: ["ON_TIME", "LATE"] },
      },
      select: { id: true, checkInTime: true },
    });

    if (openCheckIns.length === 0) continue;

    for (const checkIn of openCheckIns) {
      // Effective start: clamp checkInTime to event start (same logic as resolver)
      const effectiveStart =
        checkIn.checkInTime! < eventStart ? eventStart : checkIn.checkInTime!;

      const hoursLogged =
        Math.round(
          Math.max(0, (eventEnd.getTime() - effectiveStart.getTime()) / (1000 * 60 * 60)) * 100
        ) / 100;

      await prisma.checkIn.update({
        where: { id: checkIn.id },
        data: {
          checkOutTime: eventEnd,
          hoursLogged,
        },
      });

      totalUpdated++;
    }
  }

  return totalUpdated;
}
