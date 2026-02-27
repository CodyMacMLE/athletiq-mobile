import { prisma } from "../db.js";

// Build a map of userId -> Set<teamId> for non-athlete memberships in an org.
// Used to exclude non-athlete check-ins on a per-event-team basis so that a user
// who coaches Team A but is an athlete on Team B still has Team B data counted.
export async function getNonAthleteTeamMap(organizationId: string): Promise<Map<string, Set<string>>> {
  const nonAthleteMemberships = await prisma.teamMember.findMany({
    where: { team: { organizationId }, role: { notIn: ["MEMBER", "CAPTAIN"] } },
    select: { userId: true, teamId: true },
  });
  const map = new Map<string, Set<string>>();
  for (const m of nonAthleteMemberships) {
    if (!map.has(m.userId)) map.set(m.userId, new Set());
    map.get(m.userId)!.add(m.teamId);
  }
  return map;
}

// Returns true if a check-in should count toward athlete attendance analytics.
// Excludes check-ins where the user is not an athlete (MEMBER/CAPTAIN) on the event's team.
// Check-ins for org-wide events (no team) are always included.
export function isAthleteCheckIn(
  checkIn: { userId: string; event: { teamId: string | null } },
  nonAthleteTeamMap: Map<string, Set<string>>
): boolean {
  if (!checkIn.event.teamId) return true;
  const nonAthleteTeams = nonAthleteTeamMap.get(checkIn.userId);
  if (!nonAthleteTeams) return true;
  return !nonAthleteTeams.has(checkIn.event.teamId);
}
