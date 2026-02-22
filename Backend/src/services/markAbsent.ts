import { prisma } from "../db.js";
import { TeamRole } from "@prisma/client";
import { parseTimeString } from "../utils/time.js";

interface MarkAbsentOptions {
  /** Scope to a single organization (for manual mutation). Omit for all orgs (cron). */
  organizationId?: string;
  /** How far back to look for ended events, in minutes. Defaults to 30. */
  lookbackMinutes?: number;
}

/**
 * Find recently-ended events and create ABSENT check-in records for athletes
 * who have no existing check-in. Uses skipDuplicates so re-processing is safe.
 */
export async function markAbsentForEndedEvents(options?: MarkAbsentOptions): Promise<number> {
  const lookbackMinutes = options?.lookbackMinutes ?? 30;
  const lookbackDate = new Date();
  lookbackDate.setMinutes(lookbackDate.getMinutes() - lookbackMinutes);

  const now = new Date();

  const events = await prisma.event.findMany({
    where: {
      isAdHoc: false,
      date: { gte: lookbackDate, lte: now },
      ...(options?.organizationId && { organizationId: options.organizationId }),
    },
    include: {
      participatingTeams: {
        include: {
          members: {
            where: { role: { in: ["MEMBER", "CAPTAIN"] as TeamRole[] } },
            select: { userId: true, joinedAt: true },
          },
        },
      },
      team: {
        include: {
          members: {
            where: { role: { in: ["MEMBER", "CAPTAIN"] as TeamRole[] } },
            select: { userId: true, joinedAt: true },
          },
        },
      },
    },
  });

  let totalCreated = 0;

  for (const event of events) {
    // Compute actual end datetime from date + endTime
    const eventDate = new Date(event.date);
    const { hours, minutes } = parseTimeString(event.endTime);
    eventDate.setHours(hours, minutes, 0, 0);

    if (eventDate >= now) continue; // Event hasn't ended yet

    // Collect athlete user IDs, excluding members who joined after the event date
    const userIds = new Set<string>();
    if (event.team) {
      for (const member of event.team.members) {
        if (member.joinedAt <= event.date) {
          userIds.add(member.userId);
        }
      }
    }
    for (const team of event.participatingTeams) {
      for (const member of team.members) {
        if (member.joinedAt <= event.date) {
          userIds.add(member.userId);
        }
      }
    }

    if (userIds.size === 0) continue;

    // Bulk create ABSENT records, skipping duplicates (unique constraint on userId_eventId)
    const result = await prisma.checkIn.createMany({
      data: Array.from(userIds).map((userId) => ({
        userId,
        eventId: event.id,
        status: "ABSENT" as const,
        hoursLogged: 0,
      })),
      skipDuplicates: true,
    });

    totalCreated += result.count;
  }

  return totalCreated;
}
