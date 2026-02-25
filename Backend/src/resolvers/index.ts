import { prisma } from "../db.js";
import { AttendanceStatus, EventType, ExcuseRequestStatus, InviteStatus, OrgRole, RecurrenceFrequency, TeamRole, Platform, AnnouncementTarget, ReportFrequency, RsvpStatus } from "@prisma/client";
import { sendInviteEmail, sendFeedbackEmail } from "../email.js";
import { generateProfilePictureUploadUrl } from "../s3.js";
import { parseTimeString } from "../utils/time.js";
import { markAbsentForEndedEvents } from "../services/markAbsent.js";
import { CognitoIdentityProviderClient, AdminDeleteUserCommand, ListUsersCommand } from "@aws-sdk/client-cognito-identity-provider";
import { registerPushToken, sendPushToEndpoint } from "../notifications/sns.js";
import { sendPushNotification } from "../notifications/pushNotifications.js";
import { broadcastAnnouncement } from "../notifications/announcements.js";
import { generateGuardianReport } from "../notifications/emailReports.js";
import { sendExcuseStatusEmail } from "../notifications/emailNotifications.js";

const cognitoClient = new CognitoIdentityProviderClient({
  region: process.env.AWS_REGION || "us-east-2",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
  },
});
const COGNITO_USER_POOL_ID = process.env.COGNITO_USER_POOL_ID || "us-east-2_jHLnfwOqy";

// Helper to calculate date range
function getDateRange(timeRange: string | undefined) {
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

// Generate recurring event dates based on frequency and pattern
function generateRecurringDates(
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

// Build a map of userId -> Set<teamId> for non-athlete memberships in an org.
// Used to exclude non-athlete check-ins on a per-event-team basis so that a user
// who coaches Team A but is an athlete on Team B still has Team B data counted.
async function getNonAthleteTeamMap(organizationId: string): Promise<Map<string, Set<string>>> {
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
function isAthleteCheckIn(
  checkIn: { userId: string; event: { teamId: string | null } },
  nonAthleteTeamMap: Map<string, Set<string>>
): boolean {
  if (!checkIn.event.teamId) return true;
  const nonAthleteTeams = nonAthleteTeamMap.get(checkIn.userId);
  if (!nonAthleteTeams) return true;
  return !nonAthleteTeams.has(checkIn.event.teamId);
}

// Helper to safely serialize Date objects to ISO strings for GraphQL String fields
const toISO = (val: any) => val instanceof Date ? val.toISOString() : val;

// Strip all non-digit characters from a phone number before persisting
const sanitizePhone = (phone?: string | null): string | undefined => {
  if (!phone) return undefined;
  const digits = phone.replace(/\D/g, "");
  return digits || undefined;
};

// Compute actual start/end Date objects for a season given its month range and year.
// The seasonYear represents the END year of the season (e.g. a Sep-Jun season
// spanning 2025-2026 has seasonYear=2026).
function getSeasonDateRange(startMonth: number, endMonth: number, seasonYear: number): { start: Date; end: Date } {
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
function isTeamInCurrentSeason(team: { orgSeasonId?: string | null; seasonYear?: number | null; orgSeason?: { startMonth: number; endMonth: number } | null }): boolean {
  if (!team.orgSeason || !team.seasonYear) return true;
  const now = new Date();
  const { start, end } = getSeasonDateRange(team.orgSeason.startMonth, team.orgSeason.endMonth, team.seasonYear);
  return now >= start && now <= end;
}

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function generateSeasonDisplayString(seasonName: string, seasonYear: number): string {
  return `${seasonName} ${seasonYear}`;
}

// Parse a date-only string (YYYY-MM-DD) to noon UTC to avoid timezone off-by-one.
// new Date("2026-02-11") parses as UTC midnight, which is Feb 10th in US timezones.
// Noon UTC is the same calendar date in every inhabited timezone.
function parseDateInput(dateStr: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return new Date(dateStr + "T12:00:00.000Z");
  }
  return new Date(dateStr);
}

export const resolvers = {
  Query: {
    // User queries
    me: async (_: unknown, __: unknown, context: { userId?: string }) => {
      if (!context.userId) return null;
      return prisma.user.findUnique({ where: { id: context.userId } });
    },

    user: async (_: unknown, { id }: { id: string }) => {
      return prisma.user.findUnique({ where: { id } });
    },

    users: async () => {
      return prisma.user.findMany();
    },

    // Organization queries
    organization: async (_: unknown, { id }: { id: string }) => {
      return prisma.organization.findUnique({ where: { id } });
    },

    organizations: async () => {
      return prisma.organization.findMany();
    },

    myOrganizations: async (_: unknown, __: unknown, context: { userId?: string }) => {
      if (!context.userId) return [];
      const memberships = await prisma.organizationMember.findMany({
        where: { userId: context.userId },
        include: { organization: true },
      });
      return memberships.map((m) => m.organization);
    },

    // Season queries
    orgSeasons: async (_: unknown, { organizationId }: { organizationId: string }) => {
      return prisma.orgSeason.findMany({
        where: { organizationId },
        orderBy: { name: "asc" },
      });
    },

    // Team queries
    team: async (_: unknown, { id }: { id: string }) => {
      return prisma.team.findUnique({ where: { id } });
    },

    teams: async (_: unknown, { organizationId, includeArchived }: { organizationId: string; includeArchived?: boolean }) => {
      return prisma.team.findMany({
        where: {
          organizationId,
          ...(includeArchived ? {} : { archivedAt: null }),
        },
      });
    },

    // Venue queries
    venue: async (_: unknown, { id }: { id: string }) => {
      return prisma.venue.findUnique({ where: { id } });
    },

    organizationVenues: async (_: unknown, { organizationId }: { organizationId: string }) => {
      return prisma.venue.findMany({
        where: { organizationId },
        orderBy: { name: "asc" },
      });
    },

    // Calendar export
    exportCalendar: async (
      _: unknown,
      { organizationId, teamId, startDate, endDate }: { organizationId: string; teamId?: string; startDate?: string; endDate?: string },
      context: { userId?: string }
    ) => {
      if (!context.userId) throw new Error("Authentication required");

      const events = await prisma.event.findMany({
        where: {
          organizationId,
          isAdHoc: false,
          ...(teamId && {
            OR: [
              { teamId },
              { participatingTeams: { some: { id: teamId } } },
            ],
          }),
          ...(startDate && endDate && {
            date: { gte: new Date(startDate), lte: new Date(endDate) },
          }),
        },
        include: { venue: true, team: true },
        orderBy: { date: "asc" },
      });

      // Helper: parse "6:00 PM" → { hours, minutes }
      function parseTime(timeStr: string): { h: number; m: number } {
        const match = timeStr?.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
        if (!match) return { h: 12, m: 0 };
        let h = parseInt(match[1]);
        const m = parseInt(match[2]);
        const ampm = match[3].toUpperCase();
        if (ampm === "PM" && h !== 12) h += 12;
        if (ampm === "AM" && h === 12) h = 0;
        return { h, m };
      }

      // Format Date + time to iCal datetime: YYYYMMDDTHHMMSSZ
      function toICalDate(date: Date, timeStr: string): string {
        const year = date.getUTCFullYear();
        const month = date.getUTCMonth();
        const day = date.getUTCDate();
        const { h, m } = parseTime(timeStr);
        const dt = new Date(Date.UTC(year, month, day, h, m, 0));
        return dt.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
      }

      // Escape special iCal characters
      function escIcal(str: string): string {
        return str.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
      }

      const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

      const vevents = events.map((e) => {
        const isAllDay = e.startTime === "All Day";
        let dtstart: string;
        let dtend: string;

        if (isAllDay) {
          const d = e.date;
          const y = d.getUTCFullYear();
          const mo = String(d.getUTCMonth() + 1).padStart(2, "0");
          const da = String(d.getUTCDate()).padStart(2, "0");
          dtstart = `DTSTART;VALUE=DATE:${y}${mo}${da}`;
          const endD = e.endDate || e.date;
          const nextDay = new Date(endD);
          nextDay.setUTCDate(nextDay.getUTCDate() + 1);
          const ey = nextDay.getUTCFullYear();
          const emo = String(nextDay.getUTCMonth() + 1).padStart(2, "0");
          const eda = String(nextDay.getUTCDate()).padStart(2, "0");
          dtend = `DTEND;VALUE=DATE:${ey}${emo}${eda}`;
        } else {
          dtstart = `DTSTART:${toICalDate(e.date, e.startTime)}`;
          dtend = `DTEND:${toICalDate(e.endDate || e.date, e.endTime)}`;
        }

        const location = e.venue
          ? [e.venue.name, e.venue.address, e.venue.city, e.venue.country].filter(Boolean).join(", ")
          : e.location || "";

        const lines = [
          "BEGIN:VEVENT",
          `UID:event-${e.id}@athletiq.app`,
          `DTSTAMP:${stamp}`,
          dtstart,
          dtend,
          `SUMMARY:${escIcal(e.title)}`,
          ...(location ? [`LOCATION:${escIcal(location)}`] : []),
          ...(e.description ? [`DESCRIPTION:${escIcal(e.description)}`] : []),
          "END:VEVENT",
        ];
        return lines.join("\r\n");
      });

      return [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//AthletiQ//Events//EN",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        ...vevents,
        "END:VCALENDAR",
      ].join("\r\n");
    },

    // Event queries
    event: async (_: unknown, { id }: { id: string }) => {
      return prisma.event.findUnique({ where: { id } });
    },

    events: async (
      _: unknown,
      { organizationId, type, teamId, startDate, endDate, limit, offset }: {
        organizationId: string;
        type?: string;
        teamId?: string;
        startDate?: string;
        endDate?: string;
        limit?: number;
        offset?: number;
      },
      context: { userId?: string }
    ) => {
      if (!context.userId) throw new Error("Authentication required");

      const teamMemberships = await prisma.teamMember.findMany({
        where: { userId: context.userId, team: { organizationId } },
        select: { teamId: true },
      });
      const userTeamIds = teamMemberships.map((m) => m.teamId);

      // If a specific teamId filter is requested, scope to that team only
      const teamFilter = teamId
        ? [
            { teamId },
            { participatingTeams: { some: { id: teamId } } },
          ]
        : [
            { teamId: { in: userTeamIds } },
            { participatingTeams: { some: { id: { in: userTeamIds } } } },
            { teamId: null },
          ];

      return prisma.event.findMany({
        where: {
          organizationId,
          isAdHoc: false,
          ...(type && { type: type as any }),
          OR: teamFilter,
          ...(startDate && endDate && {
            date: { gte: new Date(startDate), lte: new Date(endDate) },
          }),
        },
        orderBy: { date: "desc" },
        ...(limit !== undefined && { take: limit }),
        ...(offset !== undefined && { skip: offset }),
      });
    },

    eventsCount: async (
      _: unknown,
      { organizationId, teamId }: { organizationId: string; teamId?: string },
      context: { userId?: string }
    ) => {
      if (!context.userId) throw new Error("Authentication required");

      const teamMemberships = await prisma.teamMember.findMany({
        where: { userId: context.userId, team: { organizationId } },
        select: { teamId: true },
      });
      const userTeamIds = teamMemberships.map((m) => m.teamId);

      const teamFilter = teamId
        ? [
            { teamId },
            { participatingTeams: { some: { id: teamId } } },
          ]
        : [
            { teamId: { in: userTeamIds } },
            { participatingTeams: { some: { id: { in: userTeamIds } } } },
            { teamId: null },
          ];

      const baseWhere = { organizationId, isAdHoc: false, OR: teamFilter };

      const [practice, meeting, event] = await Promise.all([
        prisma.event.count({ where: { ...baseWhere, type: "PRACTICE" } }),
        prisma.event.count({ where: { ...baseWhere, type: "MEETING" } }),
        prisma.event.count({ where: { ...baseWhere, type: "EVENT" } }),
      ]);

      return { PRACTICE: practice, MEETING: meeting, EVENT: event };
    },

    upcomingEvents: async (
      _: unknown,
      { organizationId, teamId, limit }: { organizationId: string; teamId?: string; limit?: number },
      context: { userId?: string }
    ) => {
      if (!context.userId) throw new Error("Authentication required");

      const teamMemberships = await prisma.teamMember.findMany({
        where: { userId: context.userId, team: { organizationId } },
        select: { teamId: true },
      });
      const teamIds = teamMemberships.map((m) => m.teamId);

      const teamFilter = teamId
        ? [
            { teamId },
            { participatingTeams: { some: { id: teamId } } },
          ]
        : [
            { teamId: { in: teamIds } },
            { participatingTeams: { some: { id: { in: teamIds } } } },
            { teamId: null },
          ];

      return prisma.event.findMany({
        where: {
          organizationId,
          isAdHoc: false,
          date: { gte: new Date() },
          OR: teamFilter,
        },
        orderBy: { date: "asc" },
        take: limit || 10,
      });
    },

    // Recurring event queries
    recurringEvent: async (_: unknown, { id }: { id: string }) => {
      return prisma.recurringEvent.findUnique({ where: { id } });
    },

    recurringEvents: async (_: unknown, { organizationId }: { organizationId: string }) => {
      return prisma.recurringEvent.findMany({
        where: { organizationId },
        orderBy: { startDate: "desc" },
      });
    },

    // Invite queries
    invite: async (_: unknown, { token }: { token: string }) => {
      return prisma.invite.findUnique({ where: { token } });
    },

    myPendingInvites: async (_: unknown, __: unknown, context: { userId?: string }) => {
      if (!context.userId) throw new Error("Authentication required");
      const user = await prisma.user.findUnique({ where: { id: context.userId }, select: { email: true } });
      if (!user) throw new Error("User not found");
      return prisma.invite.findMany({
        where: {
          email: { equals: user.email, mode: "insensitive" },
          status: "PENDING",
          expiresAt: { gt: new Date() },
        },
      });
    },

    // Guardian queries
    myGuardians: async (
      _: unknown,
      { organizationId }: { organizationId: string },
      context: { userId?: string }
    ) => {
      if (!context.userId) throw new Error("Authentication required");
      return prisma.guardianLink.findMany({
        where: { athleteId: context.userId, organizationId },
        include: { guardian: true, athlete: true, organization: true },
      });
    },

    myLinkedAthletes: async (
      _: unknown,
      { organizationId }: { organizationId: string },
      context: { userId?: string }
    ) => {
      if (!context.userId) throw new Error("Authentication required");
      return prisma.guardianLink.findMany({
        where: { guardianId: context.userId, organizationId },
        include: { guardian: true, athlete: true, organization: true },
      });
    },

    athleteGuardians: async (
      _: unknown,
      { userId, organizationId }: { userId: string; organizationId: string },
      context: { userId?: string }
    ) => {
      if (!context.userId) throw new Error("Authentication required");
      return prisma.guardianLink.findMany({
        where: { athleteId: userId, organizationId },
        include: { guardian: true, athlete: true, organization: true },
        orderBy: { createdAt: "asc" },
      });
    },

    athleteStatusHistory: async (
      _: unknown,
      { userId, organizationId }: { userId: string; organizationId: string },
      context: { userId?: string }
    ) => {
      if (!context.userId) throw new Error("Authentication required");
      return prisma.athleteStatusRecord.findMany({
        where: { userId, organizationId },
        include: { changedByUser: true },
        orderBy: { createdAt: "desc" },
      });
    },

    gymnasticsProfile: async (
      _: unknown,
      { userId, organizationId }: { userId: string; organizationId: string },
      context: { userId?: string }
    ) => {
      if (!context.userId) throw new Error("Authentication required");
      return prisma.gymnasticsProfile.findUnique({
        where: { userId_organizationId: { userId, organizationId } },
      });
    },

    // NFC queries
    organizationNfcTags: async (_: unknown, { organizationId }: { organizationId: string }) => {
      return prisma.nfcTag.findMany({ where: { organizationId, isActive: true } });
    },

    pendingAdHocCheckIns: async (
      _: unknown,
      { organizationId }: { organizationId: string },
      context: { userId?: string }
    ) => {
      if (!context.userId) throw new Error("Authentication required");
      const orgMembership = await prisma.organizationMember.findUnique({
        where: { userId_organizationId: { userId: context.userId, organizationId } },
      });
      if (!orgMembership || !["OWNER", "ADMIN", "MANAGER", "COACH"].includes(orgMembership.role)) {
        throw new Error("Only owners, admins, managers, or coaches can view pending check-ins");
      }

      // OWNER/ADMIN/MANAGER see all pending; COACH only sees teams they coach
      if (orgMembership.role === "COACH") {
        const coachedTeams = await prisma.teamMember.findMany({
          where: { userId: context.userId, role: { in: ["COACH", "ADMIN"] }, team: { organizationId } },
          select: { teamId: true },
        });
        const coachedTeamIds = coachedTeams.map((t) => t.teamId);
        return prisma.checkIn.findMany({
          where: { isAdHoc: true, approved: false, event: { organizationId, teamId: { in: coachedTeamIds } } },
          orderBy: { createdAt: "desc" },
        });
      }

      return prisma.checkIn.findMany({
        where: { isAdHoc: true, approved: false, event: { organizationId } },
        orderBy: { createdAt: "desc" },
      });
    },

    // Active check-in query (for dashboard check-out button)
    activeCheckIn: async (
      _: unknown,
      { userId }: { userId?: string },
      context: { userId?: string }
    ) => {
      if (!context.userId) return null;

      let targetUserId = context.userId;
      if (userId && userId !== context.userId) {
        // Verify caller is a guardian of the target user
        const guardianLink = await prisma.guardianLink.findFirst({
          where: { guardianId: context.userId, athleteId: userId },
        });
        if (!guardianLink) throw new Error("Not authorized to view this user's check-ins");
        targetUserId = userId;
      }

      const now = new Date();
      const todayStart = new Date(now);
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date(now);
      todayEnd.setHours(23, 59, 59, 999);

      return prisma.checkIn.findFirst({
        where: {
          userId: targetUserId,
          checkInTime: { not: null },
          checkOutTime: null,
          approved: true,
          event: {
            date: { gte: todayStart, lte: todayEnd },
          },
        },
        orderBy: { checkInTime: "desc" },
      });
    },

    // Check-in queries
    checkIn: async (_: unknown, { id }: { id: string }) => {
      return prisma.checkIn.findUnique({ where: { id } });
    },

    checkInHistory: async (_: unknown, { userId, teamId, limit }: { userId: string; teamId?: string; limit?: number }) => {
      return prisma.checkIn.findMany({
        where: {
          userId,
          ...(teamId && {
            event: {
              OR: [
                { teamId },
                { participatingTeams: { some: { id: teamId } } },
              ],
            },
          }),
        },
        orderBy: { createdAt: "desc" },
        take: limit || 20,
      });
    },

    eventAttendance: async (_: unknown, { eventId }: { eventId: string }) => {
      return prisma.checkIn.findMany({
        where: { eventId },
        include: { user: true },
      });
    },

    eventUncheckedAthletes: async (_: unknown, { eventId }: { eventId: string }) => {
      const event = await prisma.event.findUnique({
        where: { id: eventId },
        include: {
          participatingTeams: {
            include: { members: { where: { role: { in: ["MEMBER", "CAPTAIN"] as TeamRole[] } }, include: { user: true } } },
          },
          team: {
            include: { members: { where: { role: { in: ["MEMBER", "CAPTAIN"] as TeamRole[] } }, include: { user: true } } },
          },
        },
      });
      if (!event) throw new Error("Event not found");

      // Collect all athletes from participating teams and the direct team
      type UserRecord = { id: string; email: string; firstName: string; lastName: string; [key: string]: unknown };
      const userMap = new Map<string, UserRecord>();
      if (event.team) {
        for (const member of event.team.members) {
          userMap.set(member.user.id, member.user);
        }
      }
      for (const team of event.participatingTeams) {
        for (const member of team.members) {
          userMap.set(member.user.id, member.user);
        }
      }

      // Get already checked-in user IDs
      const existingCheckIns = await prisma.checkIn.findMany({
        where: { eventId },
        select: { userId: true },
      });
      const checkedInIds = new Set(existingCheckIns.map((c) => c.userId));

      // Apply include/exclude overrides
      const excludeRows = await prisma.eventAthleteExclude.findMany({ where: { eventId: event.id } });
      const excludedIds = new Set(excludeRows.map(r => r.userId));
      const includeRows = await prisma.eventAthleteInclude.findMany({
        where: { eventId: event.id },
        include: { user: true },
      });
      const includedUsers = includeRows.map(r => r.user);

      // Filter out excluded, add included, deduplicate
      const filteredAthletes = Array.from(userMap.values()).filter(u => !excludedIds.has(u.id));
      const allIds = new Set(filteredAthletes.map(u => u.id));
      for (const u of includedUsers) {
        if (!allIds.has(u.id)) filteredAthletes.push(u as any);
      }

      // Apply recurring-event-level overrides
      if (event.recurringEventId) {
        const reExcludeRows = await prisma.recurringEventAthleteExclude.findMany({
          where: { recurringEventId: event.recurringEventId },
        });
        for (const r of reExcludeRows) excludedIds.add(r.userId);
        const reIncludeRows = await prisma.recurringEventAthleteInclude.findMany({
          where: { recurringEventId: event.recurringEventId },
          include: { user: true },
        });
        for (const r of reIncludeRows) {
          if (!allIds.has(r.userId) && !excludedIds.has(r.userId)) {
            filteredAthletes.push(r.user as any);
          }
        }
      }

      // Return users not yet checked in
      return filteredAthletes.filter((u) => !excludedIds.has(u.id) && !checkedInIds.has(u.id));
    },

    // Excuse queries
    excuseRequest: async (_: unknown, { id }: { id: string }) => {
      return prisma.excuseRequest.findUnique({ where: { id } });
    },

    myExcuseRequests: async (_: unknown, { userId }: { userId: string }) => {
      return prisma.excuseRequest.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
      });
    },

    pendingExcuseRequests: async (_: unknown, { organizationId }: { organizationId: string }) => {
      return prisma.excuseRequest.findMany({
        where: {
          status: "PENDING",
          event: { organizationId },
        },
        orderBy: { createdAt: "asc" },
      });
    },

    orgExcuseRequests: async (
      _: unknown,
      {
        organizationId,
        status,
        requesterType,
        search,
        sortBy,
        sortDir,
        limit = 15,
        offset = 0,
      }: {
        organizationId: string;
        status?: string;
        requesterType?: string;
        search?: string;
        sortBy?: string;
        sortDir?: string;
        limit?: number;
        offset?: number;
      }
    ) => {
      const STAFF_ROLES = ["OWNER", "ADMIN", "MANAGER", "COACH"] as any[];

      const conditions: any[] = [{ event: { organizationId } }];

      if (status === "PENDING") {
        conditions.push({ status: "PENDING" });
      } else if (status === "HANDLED") {
        conditions.push({ status: { in: ["APPROVED", "DENIED"] } });
      }

      if (requesterType === "STAFF" || requesterType === "ATHLETE") {
        const roles: any[] = requesterType === "STAFF" ? STAFF_ROLES : ["ATHLETE"];
        const members = await prisma.organizationMember.findMany({
          where: { organizationId, role: { in: roles } },
          select: { userId: true },
        });
        conditions.push({ userId: { in: members.map((m: any) => m.userId) } });
      }

      if (search && search.trim()) {
        const q = search.trim();
        conditions.push({
          OR: [
            { reason: { contains: q, mode: "insensitive" } },
            { event: { title: { contains: q, mode: "insensitive" } } },
            { user: { firstName: { contains: q, mode: "insensitive" } } },
            { user: { lastName: { contains: q, mode: "insensitive" } } },
          ],
        });
      }

      const where: any = { AND: conditions };

      const dir = sortDir === "asc" ? "asc" : "desc";
      let orderBy: any = { createdAt: "desc" };
      if (sortBy === "name") orderBy = { user: { lastName: dir } };
      else if (sortBy === "event") orderBy = { event: { title: dir } };
      else if (sortBy === "date") orderBy = { event: { date: dir } };

      const [total, items] = await prisma.$transaction([
        prisma.excuseRequest.count({ where }),
        prisma.excuseRequest.findMany({ where, orderBy, take: limit, skip: offset }),
      ]);

      return { items, total };
    },

    // RSVP queries
    myRsvps: async (_: unknown, { userId }: { userId: string }) => {
      return prisma.eventRsvp.findMany({
        where: { userId },
        include: { user: true, event: true },
      });
    },

    // Attendance log queries
    attendanceLog: async (
      _: unknown,
      { organizationId, limit, offset }: { organizationId: string; limit?: number; offset?: number }
    ) => {
      const coachTeamMap = await getNonAthleteTeamMap(organizationId);
      const checkIns = await prisma.checkIn.findMany({
        where: {
          event: { organizationId },
          status: { in: ["ON_TIME", "LATE"] },
          approved: true,
        },
        orderBy: { createdAt: "desc" },
        include: { event: { select: { teamId: true } } },
      });
      const filtered = checkIns.filter(c => isAthleteCheckIn(c, coachTeamMap));
      return filtered.slice(offset || 0, (offset || 0) + (limit || 30));
    },

    absentExcusedLog: async (
      _: unknown,
      { organizationId, limit, offset }: { organizationId: string; limit?: number; offset?: number }
    ) => {
      const coachTeamMap = await getNonAthleteTeamMap(organizationId);
      const checkIns = await prisma.checkIn.findMany({
        where: {
          event: { organizationId },
          status: { in: ["ABSENT", "EXCUSED"] },
          approved: true,
        },
        orderBy: { createdAt: "desc" },
        include: { event: { select: { teamId: true } } },
      });
      const filtered = checkIns.filter(c => isAthleteCheckIn(c, coachTeamMap));
      return filtered.slice(offset || 0, (offset || 0) + (limit || 30));
    },

    allAttendanceRecords: async (
      _: unknown,
      { organizationId, search, status, teamId, userId, startDate, endDate, sortField, sortDir, limit, offset }: {
        organizationId: string;
        search?: string;
        status?: string;
        teamId?: string;
        userId?: string;
        startDate?: string;
        endDate?: string;
        sortField?: string;
        sortDir?: string;
        limit?: number;
        offset?: number;
      }
    ) => {
      const coachTeamMap = await getNonAthleteTeamMap(organizationId);
      const dir = sortDir === "asc" ? "asc" : "desc";
      const orderBy: any[] = (() => {
        switch (sortField) {
          case "name": return [{ user: { firstName: dir } }, { user: { lastName: dir } }];
          case "event": return [{ event: { title: dir } }];
          case "status": return [{ status: dir }, { event: { date: "desc" } }];
          case "checkIn": return [{ checkInTime: dir }];
          case "checkOut": return [{ checkOutTime: dir }];
          case "hours": return [{ hoursLogged: dir }];
          default: return [{ event: { date: "desc" } }];
        }
      })();

      const eventFilter: any = { organizationId };
      if (teamId) eventFilter.teamId = teamId;
      if (startDate || endDate) {
        eventFilter.date = {
          ...(startDate && { gte: new Date(startDate) }),
          ...(endDate && { lte: new Date(endDate) }),
        };
      }

      const where: any = {
        event: eventFilter,
        approved: true,
        ...(status && status !== "ALL" && { status }),
        ...(userId && { userId }),
        ...(search && {
          OR: [
            { user: { firstName: { contains: search, mode: "insensitive" } } },
            { user: { lastName: { contains: search, mode: "insensitive" } } },
            { event: { title: { contains: search, mode: "insensitive" } } },
          ],
        }),
      };

      const checkIns = await prisma.checkIn.findMany({
        where,
        orderBy,
        include: { event: { select: { teamId: true } } },
      });
      const filtered = checkIns.filter(c => isAthleteCheckIn(c, coachTeamMap));
      return filtered.slice(offset || 0, (offset || 0) + (limit || 20));
    },

    attendanceRecordsCount: async (
      _: unknown,
      { organizationId, search, status, teamId, userId, startDate, endDate }: {
        organizationId: string;
        search?: string;
        status?: string;
        teamId?: string;
        userId?: string;
        startDate?: string;
        endDate?: string;
      }
    ) => {
      const coachTeamMap = await getNonAthleteTeamMap(organizationId);

      const eventFilter: any = { organizationId };
      if (teamId) eventFilter.teamId = teamId;
      if (startDate || endDate) {
        eventFilter.date = {
          ...(startDate && { gte: new Date(startDate) }),
          ...(endDate && { lte: new Date(endDate) }),
        };
      }

      const where: any = {
        event: eventFilter,
        approved: true,
        ...(status && status !== "ALL" && { status }),
        ...(userId && { userId }),
        ...(search && {
          OR: [
            { user: { firstName: { contains: search, mode: "insensitive" } } },
            { user: { lastName: { contains: search, mode: "insensitive" } } },
            { event: { title: { contains: search, mode: "insensitive" } } },
          ],
        }),
      };
      // Load minimal fields for the athlete filter, then count
      const checkIns = await prisma.checkIn.findMany({
        where,
        select: { userId: true, event: { select: { teamId: true } } },
      });
      return checkIns.filter(c => isAthleteCheckIn(c, coachTeamMap)).length;
    },

    attendanceInsights: async (
      _: unknown,
      { organizationId, teamId, timeRange }: { organizationId: string; teamId?: string; timeRange?: string }
    ) => {
      const coachTeamMap = await getNonAthleteTeamMap(organizationId);

      // Get season date range - if teamId provided, use that team's season, otherwise use first current season team
      let startDate: Date, endDate: Date;
      if (teamId) {
        const team = await prisma.team.findUnique({
          where: { id: teamId },
          include: { orgSeason: true },
        });
        const range = team?.orgSeason && team?.seasonYear
          ? getSeasonDateRange(team.orgSeason.startMonth, team.orgSeason.endMonth, team.seasonYear)
          : { start: new Date(0), end: new Date() };
        startDate = range.start;
        endDate = range.end;
      } else {
        // Get first current season team for org-wide insights
        const teams = await prisma.team.findMany({
          where: { organizationId, archivedAt: null },
          include: { orgSeason: true },
        });
        const currentSeasonTeams = teams.filter(isTeamInCurrentSeason);
        const firstTeam = currentSeasonTeams[0];
        const range = firstTeam?.orgSeason && firstTeam?.seasonYear
          ? getSeasonDateRange(firstTeam.orgSeason.startMonth, firstTeam.orgSeason.endMonth, firstTeam.seasonYear)
          : { start: new Date(0), end: new Date() };
        startDate = range.start;
        endDate = range.end;
      }

      const eventWhere: any = { organizationId, date: { gte: startDate, lte: endDate } };
      if (teamId) {
        eventWhere.OR = [
          { teamId },
          { participatingTeams: { some: { id: teamId } } },
        ];
      }

      const allCheckIns = await prisma.checkIn.findMany({
        where: {
          event: eventWhere,
          approved: true,
        },
        include: { event: { select: { teamId: true } } },
      });

      const filtered = allCheckIns.filter(c => isAthleteCheckIn(c, coachTeamMap));

      const onTimeCount = filtered.filter(c => c.status === "ON_TIME").length;
      const lateCount = filtered.filter(c => c.status === "LATE").length;
      const absentCount = filtered.filter(c => c.status === "ABSENT").length;
      const excusedCount = filtered.filter(c => c.status === "EXCUSED").length;
      const eventCount = await prisma.event.count({ where: eventWhere });

      const totalExpected = onTimeCount + lateCount + absentCount + excusedCount;
      const attendanceRate = totalExpected > 0 ? (onTimeCount + lateCount) / totalExpected : 0;

      return { totalExpected, onTimeCount, lateCount, absentCount, excusedCount, attendanceRate, eventCount };
    },

    teamAttendanceRecords: async (
      _: unknown,
      { teamId, limit, offset }: { teamId: string; limit?: number; offset?: number }
    ) => {
      return prisma.checkIn.findMany({
        where: {
          event: {
            OR: [
              { teamId },
              { participatingTeams: { some: { id: teamId } } },
            ],
          },
          approved: true,
        },
        orderBy: { createdAt: "desc" },
        skip: offset || 0,
        take: limit || 30,
      });
    },

    // Analytics queries
    userStats: async (
      _: unknown,
      { userId, organizationId, teamId, timeRange }: { userId: string; organizationId: string; teamId?: string; timeRange?: string }
    ) => {
      const emptyStats = {
        hoursLogged: 0,
        hoursRequired: 0,
        attendancePercent: 0,
        teamRank: 0,
        teamSize: 0,
        orgRank: 0,
        orgSize: 0,
        currentStreak: 0,
        bestStreak: 0,
      };

      // When teamId is provided, scope stats to that team only
      if (teamId) {
        const membership = await prisma.teamMember.findFirst({
          where: { userId, teamId },
        });

        if (!membership) return emptyStats;

        // Fetch team with season info to use season date range
        const team = await prisma.team.findUnique({
          where: { id: teamId },
          include: { orgSeason: true },
        });

        const { start: startDate, end: endDate } = team?.orgSeason && team?.seasonYear
          ? getSeasonDateRange(team.orgSeason.startMonth, team.orgSeason.endMonth, team.seasonYear)
          : { start: new Date(0), end: new Date() }; // Fallback for legacy teams

        // Get check-ins for events belonging to this team
        const checkIns = await prisma.checkIn.findMany({
          where: {
            userId,
            event: {
              OR: [
                { teamId },
                { participatingTeams: { some: { id: teamId } } },
              ],
            },
            createdAt: { gte: startDate, lte: endDate },
            approved: true,
          },
        });

        const hoursLogged = checkIns.reduce((sum, c) => sum + (c.hoursLogged || 0), 0);
        const hoursRequired = membership.hoursRequired;
        const attendancePercent = hoursRequired > 0 ? (hoursLogged / hoursRequired) * 100 : 0;

        // Team rank — athletes only
        const teamMembers = await prisma.teamMember.findMany({
          where: { teamId, role: { in: ["MEMBER", "CAPTAIN"] as TeamRole[] } },
        });

        // Org rank — athletes only across all org teams
        const orgMembers = await prisma.teamMember.findMany({
          where: { team: { organizationId }, role: { in: ["MEMBER", "CAPTAIN"] as TeamRole[] } },
        });

        return {
          hoursLogged,
          hoursRequired,
          attendancePercent: Math.min(100, attendancePercent),
          teamRank: 1,
          teamSize: teamMembers.length,
          orgRank: 1,
          orgSize: orgMembers.length,
          currentStreak: 0,
          bestStreak: 0,
        };
      }

      // No teamId — aggregate all-around stats across the entire org
      const memberships = await prisma.teamMember.findMany({
        where: { userId, team: { organizationId } },
        include: { team: { include: { orgSeason: true } } },
      });

      if (memberships.length === 0) return emptyStats;

      // For org-wide stats, we need to aggregate across all current season teams
      // Use the first team's season as reference (they should all be in current season)
      const firstTeam = memberships[0].team;
      const { start: startDate, end: endDate } = firstTeam?.orgSeason && firstTeam?.seasonYear
        ? getSeasonDateRange(firstTeam.orgSeason.startMonth, firstTeam.orgSeason.endMonth, firstTeam.seasonYear)
        : { start: new Date(0), end: new Date() }; // Fallback for legacy teams

      // Get all check-ins across the org
      const checkIns = await prisma.checkIn.findMany({
        where: {
          userId,
          event: { organizationId },
          createdAt: { gte: startDate, lte: endDate },
          approved: true,
        },
      });

      const hoursLogged = checkIns.reduce((sum, c) => sum + (c.hoursLogged || 0), 0);
      const hoursRequired = memberships.reduce((sum, m) => sum + m.hoursRequired, 0);
      const attendancePercent = hoursRequired > 0 ? (hoursLogged / hoursRequired) * 100 : 0;

      // Org rank — athletes only
      const orgMembers = await prisma.teamMember.findMany({
        where: { team: { organizationId }, role: { in: ["MEMBER", "CAPTAIN"] as TeamRole[] } },
      });

      return {
        hoursLogged,
        hoursRequired,
        attendancePercent: Math.min(100, attendancePercent),
        teamRank: 0,
        teamSize: 0,
        orgRank: 1,
        orgSize: orgMembers.length,
        currentStreak: 0,
        bestStreak: 0,
      };
    },

    teamLeaderboard: async (
      _: unknown,
      { teamId, timeRange, limit }: { teamId: string; timeRange?: string; limit?: number }
    ) => {
      const members = await prisma.teamMember.findMany({
        where: { teamId, role: { in: ["MEMBER", "CAPTAIN"] as TeamRole[] } },
        include: {
          user: true,
          team: { include: { orgSeason: true } },
        },
      });

      // Use season date range instead of timeRange
      const team = members[0]?.team;
      const { start: startDate, end: endDate } = team?.orgSeason && team?.seasonYear
        ? getSeasonDateRange(team.orgSeason.startMonth, team.orgSeason.endMonth, team.seasonYear)
        : { start: new Date(0), end: new Date() }; // Fallback for legacy teams

      const leaderboard = await Promise.all(
        members.map(async (member) => {
          const checkIns = await prisma.checkIn.findMany({
            where: {
              userId: member.userId,
              event: { teamId },
              createdAt: { gte: startDate, lte: endDate },
              approved: true,
            },
          });

          const hoursLogged = checkIns.reduce((sum, c) => sum + (c.hoursLogged || 0), 0);
          const attendancePercent =
            member.hoursRequired > 0 ? Math.min(100, (hoursLogged / member.hoursRequired) * 100) : 0;

          return {
            user: member.user,
            hoursLogged,
            hoursRequired: member.hoursRequired,
            attendancePercent,
          };
        })
      );

      // Sort by attendance percent descending
      leaderboard.sort((a, b) => b.attendancePercent - a.attendancePercent);

      return leaderboard.slice(0, limit || 10).map((entry, index) => ({
        ...entry,
        rank: index + 1,
      }));
    },

    organizationLeaderboard: async (
      _: unknown,
      { organizationId, timeRange, limit }: { organizationId: string; timeRange?: string; limit?: number }
    ) => {
      const members = await prisma.teamMember.findMany({
        where: { team: { organizationId }, role: { in: ["MEMBER", "CAPTAIN"] as TeamRole[] } },
        include: {
          user: true,
          team: { include: { orgSeason: true } },
        },
      });

      // Filter to only members of current-season teams
      const currentSeasonMembers = members.filter(m => isTeamInCurrentSeason(m.team));

      // Deduplicate users (they might be in multiple teams)
      const uniqueUsers = Array.from(new Map(currentSeasonMembers.map((m) => [m.userId, m])).values());

      // Use season date range from first team (all should be in current season)
      const firstTeam = currentSeasonMembers[0]?.team;
      const { start: startDate, end: endDate } = firstTeam?.orgSeason && firstTeam?.seasonYear
        ? getSeasonDateRange(firstTeam.orgSeason.startMonth, firstTeam.orgSeason.endMonth, firstTeam.seasonYear)
        : { start: new Date(0), end: new Date() }; // Fallback for legacy teams

      const leaderboard = await Promise.all(
        uniqueUsers.map(async (member) => {
          const checkIns = await prisma.checkIn.findMany({
            where: {
              userId: member.userId,
              event: { organizationId },
              createdAt: { gte: startDate, lte: endDate },
              approved: true,
            },
          });

          const hoursLogged = checkIns.reduce((sum, c) => sum + (c.hoursLogged || 0), 0);
          const attendancePercent =
            member.hoursRequired > 0 ? Math.min(100, (hoursLogged / member.hoursRequired) * 100) : 0;

          return {
            user: member.user,
            hoursLogged,
            hoursRequired: member.hoursRequired,
            attendancePercent,
          };
        })
      );

      leaderboard.sort((a, b) => b.attendancePercent - a.attendancePercent);

      return leaderboard.slice(0, limit || 10).map((entry, index) => ({
        ...entry,
        rank: index + 1,
      }));
    },

    teamRankings: async (
      _: unknown,
      { organizationId, timeRange }: { organizationId: string; timeRange?: string }
    ) => {
      const allTeams = await prisma.team.findMany({
        where: { organizationId, archivedAt: null },
        include: { members: { where: { role: { in: ["MEMBER", "CAPTAIN"] as TeamRole[] } } }, orgSeason: true },
      });
      const teams = allTeams.filter(isTeamInCurrentSeason);

      const rankings = await Promise.all(
        teams.map(async (team) => {
          // Use season date range instead of timeRange
          const { start: startDate, end: endDate } = team.orgSeason && team.seasonYear
            ? getSeasonDateRange(team.orgSeason.startMonth, team.orgSeason.endMonth, team.seasonYear)
            : { start: new Date(0), end: new Date() }; // Fallback for legacy teams

          const athleteUserIds = team.members.map(m => m.userId);
          const checkIns = await prisma.checkIn.findMany({
            where: {
              event: { teamId: team.id },
              createdAt: { gte: startDate, lte: endDate },
              userId: { in: athleteUserIds },
              approved: true,
            },
          });

          const totalHoursLogged = checkIns.reduce((sum, c) => sum + (c.hoursLogged || 0), 0);
          const totalHoursRequired = team.members.reduce((sum, m) => sum + m.hoursRequired, 0);
          const attendancePercent =
            totalHoursRequired > 0 ? Math.min(100, (totalHoursLogged / totalHoursRequired) * 100) : 0;

          return {
            team,
            attendancePercent,
          };
        })
      );

      rankings.sort((a, b) => b.attendancePercent - a.attendancePercent);

      return rankings.map((entry, index) => ({
        ...entry,
        rank: index + 1,
      }));
    },

    recentActivity: async (
      _: unknown,
      { organizationId, teamId, limit }: { organizationId: string; teamId?: string; limit?: number },
      context: { userId?: string }
    ) => {
      if (!context.userId) throw new Error("Authentication required");

      const teamMemberships = await prisma.teamMember.findMany({
        where: { userId: context.userId, team: { organizationId } },
        select: { teamId: true },
      });
      const teamIds = teamMemberships.map((m) => m.teamId);

      const teamFilter = teamId
        ? [
            { teamId },
            { participatingTeams: { some: { id: teamId } } },
          ]
        : [
            { teamId: { in: teamIds } },
            { participatingTeams: { some: { id: { in: teamIds } } } },
            { teamId: null },
          ];

      const checkIns = await prisma.checkIn.findMany({
        where: {
          event: {
            organizationId,
            OR: teamFilter,
          },
          approved: true,
          status: { not: "ABSENT" },
        },
        orderBy: { createdAt: "desc" },
        take: limit || 20,
        include: { user: true, event: true },
      });

      return checkIns.map((checkIn) => {
        let type = "check-in";
        if (checkIn.status === "EXCUSED") {
          type = "excused";
        } else if (checkIn.checkOutTime) {
          type = "check-out";
        }

        return {
          id: checkIn.id,
          user: checkIn.user,
          type,
          time: (checkIn.checkOutTime || checkIn.checkInTime)?.toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
          }) || "",
          date: checkIn.createdAt.toISOString(),
          eventTitle: checkIn.event.title,
          eventType: checkIn.event.type,
        };
      });
    },

    // Notification queries
    myNotificationPreferences: async (
      _: unknown,
      __: unknown,
      context: { userId?: string }
    ) => {
      if (!context.userId) throw new Error("Authentication required");

      // Return existing preferences or create default ones
      let prefs = await prisma.notificationPreferences.findUnique({
        where: { userId: context.userId },
      });

      if (!prefs) {
        prefs = await prisma.notificationPreferences.create({
          data: { userId: context.userId },
        });
      }

      return prefs;
    },

    myDeviceTokens: async (
      _: unknown,
      __: unknown,
      context: { userId?: string }
    ) => {
      if (!context.userId) throw new Error("Authentication required");

      return prisma.deviceToken.findMany({
        where: { userId: context.userId },
        orderBy: { createdAt: "desc" },
      });
    },

    myEmailReportConfigs: async (
      _: unknown,
      __: unknown,
      context: { userId?: string }
    ) => {
      if (!context.userId) throw new Error("Authentication required");

      return prisma.emailReportConfig.findMany({
        where: { userId: context.userId },
        include: { organization: true },
        orderBy: { createdAt: "desc" },
      });
    },

    organizationAnnouncements: async (
      _: unknown,
      { organizationId, limit }: { organizationId: string; limit?: number },
      context: { userId?: string }
    ) => {
      if (!context.userId) throw new Error("Authentication required");

      // Verify user is a member of the organization
      const membership = await prisma.organizationMember.findUnique({
        where: {
          userId_organizationId: {
            userId: context.userId,
            organizationId,
          },
        },
      });

      if (!membership) {
        throw new Error("Not a member of this organization");
      }

      return prisma.announcement.findMany({
        where: { organizationId },
        include: { creator: true, organization: true },
        orderBy: { createdAt: "desc" },
        take: limit || 50,
      });
    },

    notificationHistory: async (
      _: unknown,
      { limit }: { limit?: number },
      context: { userId?: string }
    ) => {
      if (!context.userId) throw new Error("Authentication required");

      return prisma.notificationDelivery.findMany({
        where: { userId: context.userId },
        include: { user: true },
        orderBy: { createdAt: "desc" },
        take: limit || 100,
      });
    },

    coachMyHours: async (
      _: unknown,
      { organizationId, month, year }: { organizationId?: string; month: number; year: number },
      context: { userId?: string }
    ) => {
      if (!context.userId) throw new Error("Authentication required");

      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 1);

      // Fetch check-ins — optionally scoped to one org, otherwise all orgs
      const checkIns = await prisma.checkIn.findMany({
        where: {
          userId: context.userId,
          event: {
            ...(organizationId ? { organizationId } : {}),
            date: { gte: startDate, lt: endDate },
          },
          status: { in: ["ON_TIME", "LATE"] as any[] },
        },
        include: { event: true },
        orderBy: { event: { date: "asc" } },
      });

      // Aggregate pay across all orgs represented in the check-ins
      const orgIds = organizationId
        ? [organizationId]
        : [...new Set(checkIns.map((c: any) => c.event.organizationId as string))];

      let grossPay = 0;
      let totalDeductions = 0;
      const appliedDeductions: { name: string; type: string; value: number; amount: number }[] = [];
      let firstHourlyRate: number | null = null;
      let firstSalaryAmount: number | null = null;

      await Promise.all(
        orgIds.map(async (orgId) => {
          const [membership, org] = await Promise.all([
            prisma.organizationMember.findUnique({
              where: { userId_organizationId: { userId: context.userId!, organizationId: orgId } },
            }),
            prisma.organization.findUnique({ where: { id: orgId } }),
          ]);

          const orgCheckIns = checkIns.filter((c: any) => c.event.organizationId === orgId);
          const orgHours = orgCheckIns.reduce((s: number, c: any) => s + (c.hoursLogged ?? 0), 0);
          const payrollConfig = (org?.payrollConfig as any) ?? {};
          const deductions: any[] = payrollConfig?.deductions ?? [];

          let orgGross = 0;
          if (membership?.salaryAmount != null) {
            orgGross = membership.salaryAmount;
            firstSalaryAmount = firstSalaryAmount ?? membership.salaryAmount;
          } else if (membership?.hourlyRate != null) {
            orgGross = Math.round(orgHours * membership.hourlyRate * 100) / 100;
            firstHourlyRate = firstHourlyRate ?? membership.hourlyRate;
          }

          grossPay += orgGross;

          for (const ded of deductions) {
            const amount =
              ded.type === "FLAT"
                ? ded.value
                : Math.round((orgGross * ded.value) / 100 * 100) / 100;
            totalDeductions += amount;
            appliedDeductions.push({ name: ded.name, type: ded.type, value: ded.value, amount });
          }
        })
      );

      const totalHours = checkIns.reduce((s: number, c: any) => s + (c.hoursLogged ?? 0), 0);
      const roundedGross = Math.round(grossPay * 100) / 100;
      const netPay = roundedGross > 0 ? Math.round((roundedGross - totalDeductions) * 100) / 100 : null;

      return {
        userId: context.userId,
        user: await prisma.user.findUnique({ where: { id: context.userId } }),
        totalHours: Math.round(totalHours * 100) / 100,
        totalPay: netPay,
        grossPay: roundedGross,
        netPay,
        hourlyRate: firstHourlyRate,
        salaryAmount: firstSalaryAmount,
        appliedDeductions,
        entries: checkIns.map((c: any) => ({
          event: c.event,
          checkIn: c,
          hoursLogged: c.hoursLogged ?? 0,
        })),
      };
    },

    orgCoachHours: async (
      _: unknown,
      { organizationId, month, year }: { organizationId: string; month: number; year: number },
      context: { userId?: string }
    ) => {
      if (!context.userId) throw new Error("Authentication required");

      const callerMembership = await prisma.organizationMember.findUnique({
        where: { userId_organizationId: { userId: context.userId, organizationId } },
      });
      if (!callerMembership || !["OWNER", "ADMIN", "MANAGER"].includes(callerMembership.role)) {
        throw new Error("Not authorized");
      }

      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 1);

      const [orgData, staffMembers] = await Promise.all([
        prisma.organization.findUnique({ where: { id: organizationId }, select: { payrollConfig: true } }),
        prisma.organizationMember.findMany({
          where: { organizationId, role: { in: ["OWNER", "ADMIN", "MANAGER", "COACH"] as OrgRole[] } },
          include: { user: true },
        }),
      ]);

      const payrollDeductions: any[] = (orgData?.payrollConfig as any)?.deductions ?? [];

      const coaches = await Promise.all(
        staffMembers.map(async (member: any) => {
          const checkIns = await prisma.checkIn.findMany({
            where: {
              userId: member.userId,
              event: { organizationId, date: { gte: startDate, lt: endDate } },
              status: { in: ["ON_TIME", "LATE"] },
            },
            include: { event: true },
            orderBy: { event: { date: "asc" } },
          });

          const totalHours = Math.round(checkIns.reduce((s: number, c: any) => s + (c.hoursLogged ?? 0), 0) * 100) / 100;
          const hourlyRate = member.hourlyRate ?? null;
          const salaryAmount = member.salaryAmount ?? null;
          // Salary takes priority over hourly when both are set
          const grossPay = salaryAmount != null
            ? Math.round(salaryAmount * 100) / 100
            : hourlyRate != null
              ? Math.round(totalHours * hourlyRate * 100) / 100
              : null;

          const appliedDeductions: any[] = [];
          let netPay = grossPay;
          if (grossPay != null) {
            for (const d of payrollDeductions) {
              const amount = d.type === "PERCENT"
                ? Math.round(grossPay * d.value / 100 * 100) / 100
                : Math.round(d.value * 100) / 100;
              netPay = Math.round(((netPay ?? 0) - amount) * 100) / 100;
              appliedDeductions.push({ name: d.name, type: d.type, value: d.value, amount });
            }
          }

          return {
            userId: member.userId,
            user: member.user,
            totalHours,
            totalPay: grossPay,
            grossPay,
            netPay,
            hourlyRate,
            salaryAmount,
            appliedDeductions,
            entries: checkIns.map((c: any) => ({
              event: c.event,
              checkIn: c,
              hoursLogged: c.hoursLogged ?? 0,
            })),
          };
        })
      );

      return { coaches, month, year };
    },
  },

  Mutation: {
    // User mutations
    createUser: async (_: unknown, { input }: { input: { email: string; firstName: string; lastName: string; phone?: string; address?: string; city?: string; country?: string; image?: string } }) => {
      const sanitized = { ...input, phone: sanitizePhone(input.phone) };
      return prisma.user.upsert({
        where: { email: input.email },
        update: { firstName: input.firstName, lastName: input.lastName },
        create: sanitized,
      });
    },

    updateUser: async (_: unknown, { id, input }: { id: string; input: { firstName?: string; lastName?: string; dateOfBirth?: string; phone?: string; address?: string; city?: string; country?: string; image?: string } }) => {
      const { dateOfBirth, phone, ...rest } = input;
      return prisma.user.update({
        where: { id },
        data: {
          ...rest,
          ...(phone !== undefined ? { phone: sanitizePhone(phone) } : {}),
          ...(dateOfBirth !== undefined ? { dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null } : {}),
        },
      });
    },

    deleteUser: async (_: unknown, { id }: { id: string }) => {
      const user = await prisma.user.findUnique({ where: { id } });
      if (!user) throw new Error("User not found");

      await prisma.$transaction(async (tx) => {
        // Delete check-ins
        await tx.checkIn.deleteMany({ where: { userId: id } });
        // Delete excuse requests
        await tx.excuseRequest.deleteMany({ where: { userId: id } });
        // Delete guardian links (as guardian or athlete)
        await tx.guardianLink.deleteMany({ where: { OR: [{ guardianId: id }, { athleteId: id }] } });
        // Delete team memberships
        await tx.teamMember.deleteMany({ where: { userId: id } });
        // Delete org memberships
        await tx.organizationMember.deleteMany({ where: { userId: id } });
        // Delete emergency contacts and medical info
        await tx.emergencyContact.deleteMany({ where: { userId: id } });
        await tx.medicalInfo.deleteMany({ where: { userId: id } });
        // Delete user
        await tx.user.delete({ where: { id } });
      });

      // Delete from Cognito by looking up username via email
      try {
        const listResult = await cognitoClient.send(new ListUsersCommand({
          UserPoolId: COGNITO_USER_POOL_ID,
          Filter: `email = "${user.email}"`,
          Limit: 1,
        }));
        const cognitoUsername = listResult.Users?.[0]?.Username;
        if (cognitoUsername) {
          await cognitoClient.send(new AdminDeleteUserCommand({
            UserPoolId: COGNITO_USER_POOL_ID,
            Username: cognitoUsername,
          }));
        }
      } catch (err) {
        console.error("Failed to delete Cognito user:", err);
      }

      return true;
    },

    deleteMyAccount: async (
      _: unknown,
      __: unknown,
      context: { userId?: string; cognitoUsername?: string }
    ) => {
      if (!context.userId || !context.cognitoUsername) throw new Error("Authentication required");

      const user = await prisma.user.findUnique({ where: { id: context.userId } });
      if (!user) throw new Error("User not found");

      // Prevent org owners from deleting without transferring ownership
      const ownedOrgs = await prisma.organizationMember.findMany({
        where: { userId: context.userId, role: "OWNER" },
      });
      if (ownedOrgs.length > 0) {
        throw new Error("You must transfer ownership of your organizations before deleting your account.");
      }

      // Delete from Cognito first so the user can't sign back in
      await cognitoClient.send(new AdminDeleteUserCommand({
        UserPoolId: COGNITO_USER_POOL_ID,
        Username: context.cognitoUsername,
      }));

      // Then cascade delete from database
      await prisma.$transaction(async (tx) => {
        await tx.checkIn.deleteMany({ where: { userId: context.userId! } });
        await tx.excuseRequest.deleteMany({ where: { userId: context.userId! } });
        await tx.guardianLink.deleteMany({ where: { OR: [{ guardianId: context.userId! }, { athleteId: context.userId! }] } });
        await tx.teamMember.deleteMany({ where: { userId: context.userId! } });
        await tx.organizationMember.deleteMany({ where: { userId: context.userId! } });
        await tx.user.delete({ where: { id: context.userId! } });
      });

      return true;
    },

    // Upload mutations
    generateUploadUrl: async (
      _: unknown,
      { fileType }: { fileType: string },
      context: { userId?: string }
    ) => {
      if (!context.userId) throw new Error("Authentication required");
      return generateProfilePictureUploadUrl(context.userId, fileType);
    },

    // Organization mutations
    createOrganization: async (_: unknown, { input }: { input: { name: string; image?: string } }, context: { userId?: string }) => {
      if (!context.userId) throw new Error("Authentication required");

      const org = await prisma.organization.create({ data: input });
      await prisma.organizationMember.create({
        data: {
          userId: context.userId,
          organizationId: org.id,
          role: "OWNER",
        },
      });
      return org;
    },

    updateOrganization: async (_: unknown, { id, name, image }: { id: string; name?: string; image?: string }) => {
      return prisma.organization.update({
        where: { id },
        data: { ...(name && { name }), ...(image && { image }) },
      });
    },

    deleteOrganization: async (_: unknown, { id }: { id: string }) => {
      await prisma.organization.delete({ where: { id } });
      return true;
    },

    // Organization member mutations
    addOrgMember: async (
      _: unknown,
      { input }: { input: { userId: string; organizationId: string; role?: OrgRole } }
    ) => {
      return prisma.organizationMember.upsert({
        where: {
          userId_organizationId: {
            userId: input.userId,
            organizationId: input.organizationId,
          },
        },
        update: {},
        create: {
          userId: input.userId,
          organizationId: input.organizationId,
          role: input.role || "ATHLETE",
        },
      });
    },

    updateOrgMemberRole: async (
      _: unknown,
      { userId, organizationId, role }: { userId: string; organizationId: string; role: OrgRole }
    ) => {
      return prisma.organizationMember.update({
        where: { userId_organizationId: { userId, organizationId } },
        data: { role },
      });
    },

    updateAthleteStatus: async (
      _: unknown,
      { userId, organizationId, status, note }: { userId: string; organizationId: string; status: string; note?: string },
      context: { userId?: string }
    ) => {
      if (!context.userId) throw new Error("Authentication required");
      // Only OWNER, ADMIN, MANAGER can change athlete status
      const viewer = await prisma.organizationMember.findUnique({
        where: { userId_organizationId: { userId: context.userId, organizationId } },
      });
      if (!viewer || !["OWNER", "ADMIN", "MANAGER"].includes(viewer.role)) {
        throw new Error("Only admins and managers can update athlete status");
      }
      const [updated] = await prisma.$transaction([
        prisma.organizationMember.update({
          where: { userId_organizationId: { userId, organizationId } },
          data: { athleteStatus: status as any },
        }),
        prisma.athleteStatusRecord.create({
          data: { userId, organizationId, status: status as any, note: note || null, changedByUserId: context.userId },
        }),
      ]);
      return updated;
    },

    updateCoachHourlyRate: async (
      _: unknown,
      { organizationId, userId, hourlyRate }: { organizationId: string; userId: string; hourlyRate?: number | null },
      context: { userId?: string }
    ) => {
      if (!context.userId) throw new Error("Authentication required");
      const viewer = await prisma.organizationMember.findUnique({
        where: { userId_organizationId: { userId: context.userId, organizationId } },
      });
      if (!viewer || !["OWNER", "ADMIN", "MANAGER"].includes(viewer.role)) {
        throw new Error("Not authorized");
      }
      return prisma.organizationMember.update({
        where: { userId_organizationId: { userId, organizationId } },
        data: { hourlyRate: hourlyRate ?? null },
        include: { user: true },
      });
    },

    updateCoachPayRate: async (
      _: unknown,
      { organizationId, userId, hourlyRate, salaryAmount }: {
        organizationId: string; userId: string; hourlyRate?: number | null; salaryAmount?: number | null;
      },
      context: { userId?: string }
    ) => {
      if (!context.userId) throw new Error("Authentication required");
      const viewer = await prisma.organizationMember.findUnique({
        where: { userId_organizationId: { userId: context.userId, organizationId } },
      });
      if (!viewer || !["OWNER", "ADMIN", "MANAGER"].includes(viewer.role)) {
        throw new Error("Not authorized");
      }
      // Mutually exclusive: setting one clears the other
      const data: any = {};
      if (salaryAmount !== undefined) {
        data.salaryAmount = salaryAmount ?? null;
        data.hourlyRate = null; // clear hourly when salary is set
      } else if (hourlyRate !== undefined) {
        data.hourlyRate = hourlyRate ?? null;
        data.salaryAmount = null; // clear salary when hourly is set
      }
      return prisma.organizationMember.update({
        where: { userId_organizationId: { userId, organizationId } },
        data,
        include: { user: true },
      });
    },

    updatePayrollConfig: async (
      _: unknown,
      {
        organizationId,
        payPeriod,
        defaultHourlyRate,
        deductions,
      }: {
        organizationId: string;
        payPeriod?: string;
        defaultHourlyRate?: number | null;
        deductions?: Array<{ id?: string; name: string; type: string; value: number }>;
      },
      context: { userId?: string }
    ) => {
      if (!context.userId) throw new Error("Authentication required");
      const viewer = await prisma.organizationMember.findUnique({
        where: { userId_organizationId: { userId: context.userId, organizationId } },
      });
      if (!viewer || !["OWNER", "ADMIN"].includes(viewer.role)) {
        throw new Error("Not authorized");
      }
      // Merge with existing config to allow partial updates
      const existing = await prisma.organization.findUnique({
        where: { id: organizationId },
        select: { payrollConfig: true },
      });
      const prev: any = existing?.payrollConfig ?? {};
      const updated: any = { ...prev };
      if (payPeriod !== undefined) updated.payPeriod = payPeriod;
      if (defaultHourlyRate !== undefined) updated.defaultHourlyRate = defaultHourlyRate;
      if (deductions !== undefined) {
        updated.deductions = deductions.map((d, i) => ({
          id: d.id || `ded_${Date.now()}_${i}`,
          name: d.name,
          type: d.type,
          value: d.value,
        }));
      }
      return prisma.organization.update({
        where: { id: organizationId },
        data: { payrollConfig: updated },
      });
    },

    upsertGymnasticsProfile: async (
      _: unknown,
      { userId, organizationId, level, discipline, apparatus, notes }: {
        userId: string; organizationId: string; level?: string; discipline?: string;
        apparatus?: string[]; notes?: string;
      },
      context: { userId?: string }
    ) => {
      if (!context.userId) throw new Error("Authentication required");
      const viewer = await prisma.organizationMember.findUnique({
        where: { userId_organizationId: { userId: context.userId, organizationId } },
      });
      if (!viewer || !["OWNER", "ADMIN", "MANAGER", "COACH"].includes(viewer.role)) {
        throw new Error("Only admins, managers, and coaches can update athlete profiles");
      }
      return prisma.gymnasticsProfile.upsert({
        where: { userId_organizationId: { userId, organizationId } },
        create: { userId, organizationId, level, discipline, apparatus: apparatus || [], notes },
        update: { level, discipline, apparatus: apparatus ?? undefined, notes },
      });
    },

    removeOrgMember: async (_: unknown, { userId, organizationId }: { userId: string; organizationId: string }, context: { userId?: string }) => {
      // Look up the target member's role
      const targetMember = await prisma.organizationMember.findUnique({
        where: { userId_organizationId: { userId, organizationId } },
      });
      if (!targetMember) throw new Error("Member not found");

      // Owner can never be removed
      if (targetMember.role === "OWNER") {
        throw new Error("The organization owner cannot be removed");
      }

      // Non-owner callers cannot remove ADMINs; non-owner/non-admin callers cannot remove MANAGERs
      if (context.userId) {
        const callerMember = await prisma.organizationMember.findUnique({
          where: { userId_organizationId: { userId: context.userId, organizationId } },
        });
        if (callerMember && callerMember.role !== "OWNER") {
          if (targetMember.role === "ADMIN") {
            throw new Error("Only the owner can remove admins");
          }
          if (targetMember.role === "MANAGER" && callerMember.role !== "ADMIN") {
            throw new Error("Only the owner or an admin can remove managers");
          }
          if (userId === context.userId) {
            throw new Error("You cannot remove yourself from the organization");
          }
        }
      }

      // Find all teams in this organization
      const orgTeams = await prisma.team.findMany({
        where: { organizationId },
        select: { id: true },
      });
      const teamIds = orgTeams.map((t) => t.id);

      // Remove user from all teams in this org, then remove org membership and report configs
      await prisma.$transaction([
        prisma.teamMember.deleteMany({
          where: { userId, teamId: { in: teamIds } },
        }),
        prisma.emailReportConfig.deleteMany({
          where: { userId, organizationId },
        }),
        prisma.organizationMember.delete({
          where: { userId_organizationId: { userId, organizationId } },
        }),
      ]);
      return true;
    },

    leaveOrganization: async (_: unknown, { organizationId }: { organizationId: string }, context: { userId?: string }) => {
      if (!context.userId) throw new Error("Authentication required");

      const member = await prisma.organizationMember.findUnique({
        where: { userId_organizationId: { userId: context.userId, organizationId } },
      });
      if (!member) throw new Error("You are not a member of this organization");
      if (member.role === "OWNER") throw new Error("Owners cannot leave the organization. Transfer ownership first.");

      const orgTeams = await prisma.team.findMany({
        where: { organizationId },
        select: { id: true },
      });
      const teamIds = orgTeams.map((t) => t.id);

      await prisma.$transaction([
        prisma.teamMember.deleteMany({
          where: { userId: context.userId, teamId: { in: teamIds } },
        }),
        prisma.emailReportConfig.deleteMany({
          where: { userId: context.userId, organizationId },
        }),
        prisma.organizationMember.delete({
          where: { userId_organizationId: { userId: context.userId, organizationId } },
        }),
      ]);
      return true;
    },

    transferOwnership: async (_: unknown, { organizationId, newOwnerId }: { organizationId: string; newOwnerId: string }, context: { userId?: string }) => {
      if (!context.userId) throw new Error("Authentication required");

      const callerMember = await prisma.organizationMember.findUnique({
        where: { userId_organizationId: { userId: context.userId, organizationId } },
      });
      if (!callerMember || callerMember.role !== "OWNER") throw new Error("Only the owner can transfer ownership");
      if (newOwnerId === context.userId) throw new Error("You are already the owner");

      const newOwnerMember = await prisma.organizationMember.findUnique({
        where: { userId_organizationId: { userId: newOwnerId, organizationId } },
      });
      if (!newOwnerMember) throw new Error("The selected user is not a member of this organization");

      await prisma.$transaction([
        prisma.organizationMember.update({
          where: { userId_organizationId: { userId: newOwnerId, organizationId } },
          data: { role: "OWNER" },
        }),
        prisma.organizationMember.update({
          where: { userId_organizationId: { userId: context.userId, organizationId } },
          data: { role: "ADMIN" },
        }),
      ]);
      return true;
    },

    // Team mutations
    // Season mutations
    createOrgSeason: async (_: unknown, { input }: { input: { name: string; startMonth: number; endMonth: number; organizationId: string } }) => {
      if (input.startMonth < 1 || input.startMonth > 12 || input.endMonth < 1 || input.endMonth > 12) {
        throw new Error("Months must be between 1 and 12");
      }
      return prisma.orgSeason.create({ data: input });
    },

    updateOrgSeason: async (_: unknown, { id, name, startMonth, endMonth }: { id: string; name?: string; startMonth?: number; endMonth?: number }) => {
      if ((startMonth !== undefined && (startMonth < 1 || startMonth > 12)) ||
          (endMonth !== undefined && (endMonth < 1 || endMonth > 12))) {
        throw new Error("Months must be between 1 and 12");
      }
      return prisma.orgSeason.update({
        where: { id },
        data: {
          ...(name !== undefined && { name }),
          ...(startMonth !== undefined && { startMonth }),
          ...(endMonth !== undefined && { endMonth }),
        },
      });
    },

    deleteOrgSeason: async (_: unknown, { id }: { id: string }) => {
      const teamsUsingThis = await prisma.team.count({ where: { orgSeasonId: id } });
      if (teamsUsingThis > 0) {
        throw new Error(`Cannot delete season: ${teamsUsingThis} team(s) are still assigned to it`);
      }
      await prisma.orgSeason.delete({ where: { id } });
      return true;
    },

    createTeam: async (_: unknown, { input }: { input: { name: string; season?: string; sport?: string; color?: string; description?: string; organizationId: string; orgSeasonId?: string; seasonYear?: number } }) => {
      let season = input.season;
      if (input.orgSeasonId && input.seasonYear) {
        const orgSeason = await prisma.orgSeason.findUnique({ where: { id: input.orgSeasonId } });
        if (orgSeason) {
          season = generateSeasonDisplayString(orgSeason.name, input.seasonYear);
        }
      }
      return prisma.team.create({
        data: {
          name: input.name,
          season,
          sport: input.sport,
          color: input.color,
          description: input.description,
          organizationId: input.organizationId,
          orgSeasonId: input.orgSeasonId,
          seasonYear: input.seasonYear,
        },
      });
    },

    updateTeam: async (_: unknown, { id, name, season, sport, color, description, orgSeasonId, seasonYear }: { id: string; name?: string; season?: string; sport?: string; color?: string; description?: string; orgSeasonId?: string; seasonYear?: number }) => {
      let computedSeason = season;
      if (orgSeasonId !== undefined && seasonYear !== undefined) {
        if (orgSeasonId) {
          const orgSeason = await prisma.orgSeason.findUnique({ where: { id: orgSeasonId } });
          if (orgSeason) {
            computedSeason = generateSeasonDisplayString(orgSeason.name, seasonYear);
          }
        } else {
          // Clearing the season assignment
          computedSeason = season || null as any;
        }
      }
      return prisma.team.update({
        where: { id },
        data: {
          ...(name !== undefined && { name }),
          ...(computedSeason !== undefined && { season: computedSeason }),
          ...(sport !== undefined && { sport }),
          ...(color !== undefined && { color }),
          ...(description !== undefined && { description }),
          ...(orgSeasonId !== undefined && { orgSeasonId: orgSeasonId || null }),
          ...(seasonYear !== undefined && { seasonYear: seasonYear || null }),
        },
      });
    },

    deleteTeam: async (_: unknown, { id, hardDelete }: { id: string; hardDelete?: boolean }) => {
      await prisma.$transaction(async (tx) => {
        // Remove all team members
        await tx.teamMember.deleteMany({ where: { teamId: id } });
        // Disconnect from any participatingEvents join table
        const participatingEvents = await tx.event.findMany({
          where: { participatingTeams: { some: { id } } },
          select: { id: true },
        });
        for (const event of participatingEvents) {
          await tx.event.update({
            where: { id: event.id },
            data: { participatingTeams: { disconnect: { id } } },
          });
        }

        if (hardDelete) {
          // Collect all event IDs owned by this team
          const teamEventIds = (
            await tx.event.findMany({ where: { teamId: id }, select: { id: true } })
          ).map((e) => e.id);

          if (teamEventIds.length > 0) {
            // Delete child records in dependency order before deleting events
            await tx.checkIn.deleteMany({ where: { eventId: { in: teamEventIds } } });
            await tx.excuseRequest.deleteMany({ where: { eventId: { in: teamEventIds } } });
            await tx.eventRsvp.deleteMany({ where: { eventId: { in: teamEventIds } } });
            await tx.event.deleteMany({ where: { id: { in: teamEventIds } } });
          }

          // Delete recurring event templates tied to this team
          await tx.recurringEvent.deleteMany({ where: { teamId: id } });
          // Hard delete the team
          await tx.team.delete({ where: { id } });
        } else {
          // Archive the team
          await tx.team.update({
            where: { id },
            data: { archivedAt: new Date() },
          });
        }
      });
      return true;
    },

    restoreTeam: async (_: unknown, { id }: { id: string }) => {
      return prisma.team.update({
        where: { id },
        data: { archivedAt: null },
      });
    },

    addTeamMember: async (
      _: unknown,
      { input }: { input: { userId: string; teamId: string; role?: TeamRole; hoursRequired?: number } }
    ) => {
      return prisma.teamMember.upsert({
        where: {
          userId_teamId: {
            userId: input.userId,
            teamId: input.teamId,
          },
        },
        update: {},
        create: {
          userId: input.userId,
          teamId: input.teamId,
          role: input.role || "MEMBER",
          hoursRequired: input.hoursRequired || 0,
        },
      });
    },

    removeTeamMember: async (_: unknown, { userId, teamId }: { userId: string; teamId: string }) => {
      await prisma.teamMember.delete({
        where: { userId_teamId: { userId, teamId } },
      });
      return true;
    },

    updateTeamMemberRole: async (
      _: unknown,
      { userId, teamId, role }: { userId: string; teamId: string; role: TeamRole }
    ) => {
      return prisma.teamMember.update({
        where: { userId_teamId: { userId, teamId } },
        data: { role },
      });
    },

    // Venue mutations
    createVenue: async (
      _: unknown,
      { input }: { input: { name: string; address?: string; city?: string; state?: string; country?: string; notes?: string; organizationId: string } }
    ) => {
      return prisma.venue.create({ data: input });
    },

    updateVenue: async (
      _: unknown,
      { id, input }: { id: string; input: { name?: string; address?: string; city?: string; state?: string; country?: string; notes?: string } }
    ) => {
      return prisma.venue.update({ where: { id }, data: input });
    },

    deleteVenue: async (_: unknown, { id }: { id: string }) => {
      // Unlink venue from events first, then delete
      await prisma.event.updateMany({ where: { venueId: id }, data: { venueId: null } });
      await prisma.recurringEvent.updateMany({ where: { venueId: id }, data: { venueId: null } });
      await prisma.venue.delete({ where: { id } });
      return true;
    },

    // Event mutations
    createEvent: async (
      _: unknown,
      {
        input,
      }: {
        input: {
          title: string;
          type: EventType;
          date: string;
          endDate?: string;
          startTime: string;
          endTime: string;
          location?: string;
          description?: string;
          organizationId: string;
          teamId?: string;
          venueId?: string;
          participatingTeamIds?: string[];
        };
      }
    ) => {
      const { participatingTeamIds, endDate, ...eventData } = input;
      return prisma.event.create({
        data: {
          ...eventData,
          date: parseDateInput(input.date),
          ...(endDate && { endDate: parseDateInput(endDate) }),
          ...(participatingTeamIds && participatingTeamIds.length > 0 && {
            participatingTeams: {
              connect: participatingTeamIds.map((id) => ({ id })),
            },
          }),
        },
      });
    },

    updateEvent: async (
      _: unknown,
      {
        id,
        title,
        type,
        date,
        endDate,
        startTime,
        endTime,
        location,
        description,
        venueId,
      }: {
        id: string;
        title?: string;
        type?: EventType;
        date?: string;
        endDate?: string | null;
        startTime?: string;
        endTime?: string;
        location?: string;
        description?: string;
        venueId?: string | null;
      }
    ) => {
      return prisma.event.update({
        where: { id },
        data: {
          ...(title && { title }),
          ...(type && { type }),
          ...(date && { date: parseDateInput(date) }),
          ...(endDate !== undefined && { endDate: endDate ? parseDateInput(endDate) : null }),
          ...(startTime && { startTime }),
          ...(endTime && { endTime }),
          ...(location !== undefined && { location }),
          ...(description !== undefined && { description }),
          ...(venueId !== undefined && { venueId: venueId || null }),
        },
      });
    },

    deleteEvent: async (_: unknown, { id }: { id: string }) => {
      await prisma.$transaction(async (tx) => {
        await tx.checkIn.deleteMany({ where: { eventId: id } });
        await tx.excuseRequest.deleteMany({ where: { eventId: id } });
        await tx.eventRsvp.deleteMany({ where: { eventId: id } });
        await tx.event.delete({ where: { id } });
      });
      return true;
    },

    // Recurring event mutations
    createRecurringEvent: async (
      _: unknown,
      {
        input,
      }: {
        input: {
          title: string;
          type: EventType;
          startTime: string;
          endTime: string;
          location?: string;
          description?: string;
          frequency: RecurrenceFrequency;
          daysOfWeek?: number[];
          startDate: string;
          endDate: string;
          organizationId: string;
          teamId?: string;
          venueId?: string;
          includedUserIds?: string[];
          excludedUserIds?: string[];
        };
      }
    ) => {
      const start = parseDateInput(input.startDate);
      const end = parseDateInput(input.endDate);

      if (end <= start) {
        throw new Error("End date must be after start date");
      }

      if (
        (input.frequency === "WEEKLY" || input.frequency === "BIWEEKLY") &&
        (!input.daysOfWeek || input.daysOfWeek.length === 0)
      ) {
        throw new Error("daysOfWeek is required for WEEKLY and BIWEEKLY frequencies");
      }

      const dates = generateRecurringDates(start, end, input.frequency, input.daysOfWeek || []);

      if (dates.length === 0) {
        throw new Error("No event occurrences generated for the given parameters");
      }
      if (dates.length > 365) {
        throw new Error("Too many occurrences (max 365). Please shorten the date range.");
      }

      const recurringEvent = await prisma.$transaction(async (tx) => {
        const re = await tx.recurringEvent.create({
          data: {
            title: input.title,
            type: input.type,
            startTime: input.startTime,
            endTime: input.endTime,
            location: input.location,
            description: input.description,
            frequency: input.frequency,
            daysOfWeek: input.daysOfWeek || [],
            startDate: start,
            endDate: end,
            organizationId: input.organizationId,
            teamId: input.teamId,
            venueId: input.venueId,
          },
        });

        await tx.event.createMany({
          data: dates.map((date) => ({
            title: input.title,
            type: input.type,
            date,
            startTime: input.startTime,
            endTime: input.endTime,
            location: input.location,
            description: input.description,
            organizationId: input.organizationId,
            teamId: input.teamId,
            venueId: input.venueId,
            recurringEventId: re.id,
          })),
        });

        if (input.includedUserIds?.length) {
          await tx.recurringEventAthleteInclude.createMany({
            data: input.includedUserIds.map((userId: string) => ({ recurringEventId: re.id, userId })),
            skipDuplicates: true,
          });
        }
        if (input.excludedUserIds?.length) {
          await tx.recurringEventAthleteExclude.createMany({
            data: input.excludedUserIds.map((userId: string) => ({ recurringEventId: re.id, userId })),
            skipDuplicates: true,
          });
        }

        return re;
      });

      return recurringEvent;
    },

    deleteRecurringEvent: async (_: unknown, { id, futureOnly }: { id: string; futureOnly?: boolean }) => {
      await prisma.$transaction(async (tx) => {
        const now = new Date();

        if (futureOnly) {
          // Preserve past events by detaching them from the recurring series
          await tx.event.updateMany({
            where: { recurringEventId: id, date: { lt: now } },
            data: { recurringEventId: null },
          });
        }

        const eventIds = (
          await tx.event.findMany({
            where: { recurringEventId: id },
            select: { id: true },
          })
        ).map((e) => e.id);

        await tx.checkIn.deleteMany({ where: { eventId: { in: eventIds } } });
        await tx.excuseRequest.deleteMany({ where: { eventId: { in: eventIds } } });
        await tx.eventRsvp.deleteMany({ where: { eventId: { in: eventIds } } });
        await tx.event.deleteMany({ where: { recurringEventId: id } });
        await tx.recurringEvent.delete({ where: { id } });
      });
      return true;
    },

    // Check-in mutations
    markAbsentForPastEvents: async (
      _: unknown,
      { organizationId }: { organizationId: string }
    ) => {
      return markAbsentForEndedEvents({ organizationId, lookbackMinutes: 10080 });
    },

    checkIn: async (
      _: unknown,
      { input }: { input: { userId: string; eventId: string } },
      context: { userId?: string }
    ) => {
      if (!context.userId) throw new Error("Authentication required");

      // If checking in for someone else, verify guardian relationship
      if (input.userId !== context.userId) {
        const event = await prisma.event.findUnique({ where: { id: input.eventId } });
        if (!event) throw new Error("Event not found");
        const guardianLink = await prisma.guardianLink.findFirst({
          where: { guardianId: context.userId, athleteId: input.userId, organizationId: event.organizationId },
        });
        if (!guardianLink) throw new Error("Not authorized to check in this user");
      }

      const event = await prisma.event.findUnique({ where: { id: input.eventId } });
      if (!event) throw new Error("Event not found");

      const now = new Date();
      const eventStart = new Date(event.date);
      const { hours, minutes } = parseTimeString(event.startTime);
      eventStart.setHours(hours, minutes);

      // Determine if on time or late (on-time = before start, late = after start)
      const status: AttendanceStatus = now.getTime() <= eventStart.getTime() ? "ON_TIME" : "LATE";

      const checkIn = await prisma.checkIn.create({
        data: {
          userId: input.userId,
          eventId: input.eventId,
          status,
          checkInTime: now,
        },
      });

      // Check for attendance milestones (non-blocking)
      (async () => {
        try {
          const prefs = await prisma.notificationPreferences.findUnique({
            where: { userId: input.userId },
          });

          // Skip if milestone notifications are disabled
          if (prefs && !prefs.milestonesEnabled) {
            return;
          }

          // Count total successful check-ins (ON_TIME or LATE)
          const totalCheckIns = await prisma.checkIn.count({
            where: {
              userId: input.userId,
              status: { in: ["ON_TIME", "LATE"] },
              approved: true,
            },
          });

          // Milestone check-in counts
          const milestones = [10, 25, 50, 100, 250, 500, 1000];
          if (milestones.includes(totalCheckIns)) {
            const title = `🎉 ${totalCheckIns} Check-ins!`;
            const message = `Congratulations! You've reached ${totalCheckIns} check-ins. Keep up the great work!`;

            // Send push notification
            if (!prefs || prefs.pushEnabled) {
              sendPushNotification(input.userId, title, message, {
                type: "ATTENDANCE_MILESTONE",
                milestone: totalCheckIns,
              }).catch((err) => console.error("Failed to send milestone notification:", err));
            }
          }

          // Check attendance percentage milestone (only for users with at least 10 events)
          const allCheckIns = await prisma.checkIn.count({
            where: {
              userId: input.userId,
              approved: true,
            },
          });

          if (allCheckIns >= 10) {
            const successfulCheckIns = await prisma.checkIn.count({
              where: {
                userId: input.userId,
                status: { in: ["ON_TIME", "LATE"] },
                approved: true,
              },
            });

            const attendancePercent = (successfulCheckIns / allCheckIns) * 100;

            // Perfect attendance milestone
            if (attendancePercent === 100 && allCheckIns % 10 === 0) {
              const title = "🏆 Perfect Attendance!";
              const message = `Amazing! You've maintained 100% attendance across ${allCheckIns} events!`;

              if (!prefs || prefs.pushEnabled) {
                sendPushNotification(input.userId, title, message, {
                  type: "ATTENDANCE_MILESTONE",
                  milestone: "perfect_attendance",
                  totalEvents: allCheckIns,
                }).catch((err) => console.error("Failed to send milestone notification:", err));
              }
            }
          }
        } catch (err) {
          console.error("Failed to check attendance milestones:", err);
        }
      })();

      return checkIn;
    },

    checkOut: async (
      _: unknown,
      { input }: { input: { checkInId: string } },
      context: { userId?: string }
    ) => {
      if (!context.userId) throw new Error("Authentication required");

      const checkIn = await prisma.checkIn.findUnique({
        where: { id: input.checkInId },
        include: { event: true },
      });
      if (!checkIn) throw new Error("Check-in not found");
      if (!checkIn.checkInTime) throw new Error("No check-in time recorded");

      // If checking out for someone else, verify guardian relationship
      if (checkIn.userId !== context.userId) {
        const guardianLink = await prisma.guardianLink.findFirst({
          where: { guardianId: context.userId, athleteId: checkIn.userId, organizationId: checkIn.event.organizationId },
        });
        if (!guardianLink) throw new Error("Not authorized to check out this user");
      }

      const now = new Date();

      // Use event start time as effective start if athlete checked in early
      let effectiveStart = checkIn.checkInTime;
      if (checkIn.event) {
        const eventDate = new Date(checkIn.event.date);
        const { hours, minutes } = parseTimeString(checkIn.event.startTime);
        const eventStart = new Date(eventDate);
        eventStart.setHours(hours, minutes, 0, 0);
        if (checkIn.checkInTime < eventStart) {
          effectiveStart = eventStart;
        }
      }

      const hoursLogged = Math.max(0, (now.getTime() - effectiveStart.getTime()) / (1000 * 60 * 60));

      return prisma.checkIn.update({
        where: { id: input.checkInId },
        data: {
          checkOutTime: now,
          hoursLogged: Math.round(hoursLogged * 100) / 100,
        },
      });
    },

    adminCheckIn: async (
      _: unknown,
      { input }: { input: { userId: string; eventId: string; status: AttendanceStatus; note?: string; checkInTime?: string | null; checkOutTime?: string | null } }
    ) => {
      // null = explicitly cleared, undefined = auto-set, string = provided value
      let checkInTime: Date | null;
      if (input.checkInTime) {
        checkInTime = new Date(input.checkInTime);
      } else if (input.checkInTime === null) {
        checkInTime = null;
      } else {
        checkInTime = input.status !== "EXCUSED" && input.status !== "ABSENT" ? new Date() : null;
      }
      const checkOutTime = input.checkOutTime ? new Date(input.checkOutTime) : null;

      // Absent status: zero out hours and clear times
      if (input.status === "ABSENT") {
        return prisma.checkIn.upsert({
          where: { userId_eventId: { userId: input.userId, eventId: input.eventId } },
          create: {
            userId: input.userId,
            eventId: input.eventId,
            status: "ABSENT",
            checkInTime: null,
            checkOutTime: null,
            hoursLogged: 0,
            note: input.note,
          },
          update: {
            status: "ABSENT",
            checkInTime: null,
            checkOutTime: null,
            hoursLogged: 0,
            note: input.note,
          },
        });
      }

      // Calculate hoursLogged when both times are provided
      let hoursLogged: number | null = null;
      if (checkInTime && checkOutTime) {
        // Use event start as effective start if check-in was early
        const event = await prisma.event.findUnique({ where: { id: input.eventId } });
        let effectiveStart = checkInTime;
        if (event) {
          const eventDate = new Date(event.date);
          const evTime = parseTimeString(event.startTime);
          const evStart = new Date(eventDate);
          evStart.setHours(evTime.hours, evTime.minutes, 0, 0);
          if (checkInTime < evStart) {
            effectiveStart = evStart;
          }
        }
        hoursLogged = Math.round(Math.max(0, (checkOutTime.getTime() - effectiveStart.getTime()) / (1000 * 60 * 60)) * 100) / 100;
      }

      return prisma.checkIn.upsert({
        where: { userId_eventId: { userId: input.userId, eventId: input.eventId } },
        create: {
          userId: input.userId,
          eventId: input.eventId,
          status: input.status,
          checkInTime,
          checkOutTime,
          ...(hoursLogged !== null && { hoursLogged }),
          note: input.note,
        },
        update: {
          status: input.status,
          checkInTime,
          checkOutTime,
          ...(hoursLogged !== null && { hoursLogged }),
          note: input.note,
        },
      });
    },

    deleteCheckIn: async (_: unknown, { userId, eventId }: { userId: string; eventId: string }) => {
      await prisma.checkIn.deleteMany({ where: { userId, eventId } });
      return true;
    },

    markAbsent: async (_: unknown, { userId, eventId }: { userId: string; eventId: string }) => {
      return prisma.checkIn.upsert({
        where: { userId_eventId: { userId, eventId } },
        create: {
          userId,
          eventId,
          status: "ABSENT",
          checkInTime: null,
          checkOutTime: null,
          hoursLogged: 0,
        },
        update: {
          status: "ABSENT",
          checkInTime: null,
          checkOutTime: null,
          hoursLogged: 0,
        },
      });
    },

    // Invite mutations
    createInvite: async (
      _: unknown,
      { input }: { input: { email: string; organizationId: string; role?: OrgRole; teamIds?: string[] } }
    ) => {
      // Check if email is already an active org member
      const existingMember = await prisma.organizationMember.findFirst({
        where: {
          organizationId: input.organizationId,
          user: { email: input.email },
        },
      });
      if (existingMember) {
        throw new Error("This email is already a member of the organization");
      }

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      const invite = await prisma.invite.upsert({
        where: {
          email_organizationId: {
            email: input.email,
            organizationId: input.organizationId,
          },
        },
        update: {
          role: input.role || "ATHLETE",
          teamIds: input.teamIds || [],
          status: "PENDING",
          expiresAt,
        },
        create: {
          email: input.email,
          organizationId: input.organizationId,
          role: input.role || "ATHLETE",
          teamIds: input.teamIds || [],
          expiresAt,
        },
      });

      // Send invite email (non-blocking — admin can resend if it fails)
      try {
        const org = await prisma.organization.findUnique({ where: { id: input.organizationId } });
        if (org) {
          await sendInviteEmail({
            to: input.email,
            organizationName: org.name,
            role: invite.role,
            token: invite.token,
          });
        }
      } catch (err) {
        console.error("Failed to send invite email:", err);
      }

      return invite;
    },

    acceptInvite: async (
      _: unknown,
      { token }: { token: string },
      context: { userId?: string }
    ) => {
      if (!context.userId) throw new Error("Authentication required");

      const invite = await prisma.invite.findUnique({ where: { token } });
      if (!invite) throw new Error("Invite not found");
      if (invite.status !== "PENDING") throw new Error("Invite is no longer valid");
      if (invite.expiresAt < new Date()) throw new Error("Invite has expired");

      const result = await prisma.$transaction(async (tx) => {
        // Upsert org membership
        const orgMember = await tx.organizationMember.upsert({
          where: {
            userId_organizationId: {
              userId: context.userId!,
              organizationId: invite.organizationId,
            },
          },
          update: {},
          create: {
            userId: context.userId!,
            organizationId: invite.organizationId,
            role: invite.role,
          },
        });

        // For guardian invites, create a GuardianLink instead of team memberships
        if (invite.role === "GUARDIAN" && invite.athleteId) {
          // Hard-enforce no circular guardian relationships (org-independent):
          // Reject if the athlete being guarded is already a guardian of the acceptor.
          const circularLink = await tx.guardianLink.findFirst({
            where: { guardianId: invite.athleteId, athleteId: context.userId! },
          });
          if (circularLink) {
            throw new Error(
              "Mutual guardian relationships are not allowed. This athlete is already your guardian."
            );
          }

          // Prevent org athletes from becoming guardians for other org members.
          // Check whether the acceptor is an ATHLETE in the same organization.
          const acceptorOrgMembership = await tx.organizationMember.findUnique({
            where: {
              userId_organizationId: {
                userId: context.userId!,
                organizationId: invite.organizationId,
              },
            },
          });
          if (acceptorOrgMembership?.role === "ATHLETE") {
            throw new Error(
              "You are an athlete in this organization. To be a guardian here, an admin must change your org role to Guardian first."
            );
          }

          await tx.guardianLink.upsert({
            where: {
              guardianId_athleteId_organizationId: {
                guardianId: context.userId!,
                athleteId: invite.athleteId,
                organizationId: invite.organizationId,
              },
            },
            update: {},
            create: {
              guardianId: context.userId!,
              athleteId: invite.athleteId,
              organizationId: invite.organizationId,
            },
          });
        } else {
          // Add to teams with role derived from invite org role
          const teamRole: TeamRole =
            invite.role === "COACH" ? "COACH" :
            ["ADMIN", "MANAGER"].includes(invite.role) ? "ADMIN" :
            "MEMBER";
          for (const teamId of invite.teamIds) {
            await tx.teamMember.upsert({
              where: { userId_teamId: { userId: context.userId!, teamId } },
              update: {},
              create: {
                userId: context.userId!,
                teamId,
                role: teamRole,
              },
            });
          }
        }

        // Mark invite as accepted
        await tx.invite.update({
          where: { id: invite.id },
          data: { status: "ACCEPTED" },
        });

        return orgMember;
      });

      return result;
    },

    cancelInvite: async (_: unknown, { id }: { id: string }) => {
      await prisma.invite.delete({ where: { id } });
      return true;
    },

    resendInvite: async (_: unknown, { id }: { id: string }) => {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      const invite = await prisma.invite.update({
        where: { id },
        data: {
          status: "PENDING",
          expiresAt,
        },
      });

      try {
        const org = await prisma.organization.findUnique({ where: { id: invite.organizationId } });
        if (org) {
          await sendInviteEmail({
            to: invite.email,
            organizationName: org.name,
            role: invite.role,
            token: invite.token,
          });
        }
      } catch (err) {
        console.error("Failed to resend invite email:", err);
      }

      return invite;
    },

    // Guardian mutations
    inviteGuardian: async (
      _: unknown,
      { email, organizationId, athleteId: explicitAthleteId }: { email: string; organizationId: string; athleteId?: string },
      context: { userId?: string }
    ) => {
      if (!context.userId) throw new Error("Authentication required");

      // If an explicit athleteId is provided, the caller must be an admin/manager in the org
      const subjectUserId = explicitAthleteId || context.userId;
      if (explicitAthleteId && explicitAthleteId !== context.userId) {
        const callerMembership = await prisma.organizationMember.findUnique({
          where: { userId_organizationId: { userId: context.userId, organizationId } },
        });
        if (!callerMembership || !["OWNER", "ADMIN", "MANAGER"].includes(callerMembership.role)) {
          throw new Error("Only admins and managers can invite guardians on behalf of an athlete");
        }
      }

      // Prevent inviting yourself (as the athlete)
      const self = await prisma.user.findUnique({ where: { id: subjectUserId } });
      if (self && self.email.toLowerCase() === email.toLowerCase()) {
        throw new Error("You cannot invite yourself as a guardian");
      }

      // Prevent mutual/circular guardian relationships:
      // If the invitee already has an account and the current user is already
      // their guardian, reject early (org-independent check).
      const invitee = await prisma.user.findFirst({
        where: { email: { equals: email, mode: "insensitive" } },
      });
      if (invitee) {
        const circularLink = await prisma.guardianLink.findFirst({
          where: { guardianId: subjectUserId, athleteId: invitee.id },
        });
        if (circularLink) {
          throw new Error(
            "Mutual guardian relationships are not allowed. You are already a guardian for this person."
          );
        }

        // Prevent org athletes from being guardians for other org members.
        // An athlete in the same organization cannot be a guardian — this would
        // let teammates check each other in without being physically present.
        const inviteeOrgMembership = await prisma.organizationMember.findUnique({
          where: {
            userId_organizationId: { userId: invitee.id, organizationId },
          },
        });
        if (inviteeOrgMembership?.role === "ATHLETE") {
          throw new Error(
            "This person is an athlete in the same organization. To allow them to be a guardian, an admin must change their org role to Guardian first."
          );
        }
      }

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      const invite = await prisma.invite.upsert({
        where: {
          email_organizationId: {
            email,
            organizationId,
          },
        },
        update: {
          role: "GUARDIAN",
          teamIds: [],
          athleteId: subjectUserId,
          status: "PENDING",
          expiresAt,
        },
        create: {
          email,
          organizationId,
          role: "GUARDIAN",
          teamIds: [],
          athleteId: subjectUserId,
          expiresAt,
        },
      });

      const org = await prisma.organization.findUnique({ where: { id: organizationId } });

      // Send invite email (non-blocking)
      if (org) {
        sendInviteEmail({
          to: email,
          organizationName: org.name,
          role: invite.role,
          token: invite.token,
        }).catch((err) => console.error("Failed to send guardian invite email:", err));
      }

      // If the invited guardian already has an account, deliver an in-app notification
      // and attempt a push notification to all their registered devices
      const guardianUser = await prisma.user.findFirst({
        where: { email: { equals: email, mode: "insensitive" } },
      });
      if (guardianUser) {
        const athleteUser = subjectUserId !== context.userId
          ? (await prisma.user.findUnique({ where: { id: subjectUserId } })) ?? self!
          : self!;
        const athleteName = `${athleteUser.firstName} ${athleteUser.lastName}`;
        const orgName = org?.name ?? "your organization";
        const notifTitle = "Guardian Invite";
        const notifMessage = `${athleteName} has invited you to be their guardian in ${orgName}`;
        const notifMeta = {
          type: "GUARDIAN_INVITE",
          inviteToken: invite.token,
          athleteName,
          organizationName: orgName,
        };

        // Always create the in-app delivery record so it shows in the notifications screen
        await prisma.notificationDelivery.create({
          data: {
            userId: guardianUser.id,
            type: "GUARDIAN_INVITE",
            channel: "PUSH",
            title: notifTitle,
            message: notifMessage,
            metadata: notifMeta,
            status: "SENT",
            sentAt: new Date(),
          },
        });

        // Best-effort SNS push to any registered devices (don't use sendPushNotification
        // here — that would create duplicate NotificationDelivery records per device)
        prisma.deviceToken
          .findMany({ where: { userId: guardianUser.id, isActive: true } })
          .then((tokens) =>
            Promise.allSettled(
              tokens
                .filter((t) => !!t.endpoint)
                .map((t) => sendPushToEndpoint(t.endpoint!, notifTitle, notifMessage, notifMeta))
            )
          )
          .catch((err) => console.error("Failed to send guardian invite push:", err));
      }

      return invite;
    },

    removeGuardian: async (
      _: unknown,
      { guardianLinkId }: { guardianLinkId: string },
      context: { userId?: string }
    ) => {
      if (!context.userId) throw new Error("Authentication required");

      const link = await prisma.guardianLink.findUnique({ where: { id: guardianLinkId } });
      if (!link) throw new Error("Guardian link not found");

      // Only the guardian (removing themselves) or an org admin can remove
      const isGuardian = link.guardianId === context.userId;
      if (!isGuardian) {
        const orgMembership = await prisma.organizationMember.findUnique({
          where: { userId_organizationId: { userId: context.userId, organizationId: link.organizationId } },
        });
        if (!orgMembership || !["OWNER", "ADMIN", "MANAGER"].includes(orgMembership.role)) {
          throw new Error("Only the guardian or an org admin can remove a guardian link");
        }
      }

      await prisma.guardianLink.delete({ where: { id: guardianLinkId } });
      return true;
    },

    // NFC mutations
    registerNfcTag: async (
      _: unknown,
      { input }: { input: { token: string; name: string; organizationId: string } },
      context: { userId?: string }
    ) => {
      if (!context.userId) throw new Error("Authentication required");

      // Verify caller is OWNER or MANAGER of the org
      const membership = await prisma.organizationMember.findUnique({
        where: { userId_organizationId: { userId: context.userId, organizationId: input.organizationId } },
      });
      if (!membership || !["OWNER", "ADMIN", "MANAGER"].includes(membership.role)) {
        throw new Error("Only owners, admins, and managers can register NFC tags");
      }

      // Check for duplicate token
      const existing = await prisma.nfcTag.findUnique({ where: { token: input.token } });
      if (existing) throw new Error("A tag with this token already exists");

      return prisma.nfcTag.create({
        data: {
          token: input.token,
          name: input.name,
          organizationId: input.organizationId,
          createdBy: context.userId,
        },
      });
    },

    deactivateNfcTag: async (
      _: unknown,
      { id }: { id: string },
      context: { userId?: string }
    ) => {
      if (!context.userId) throw new Error("Authentication required");

      const tag = await prisma.nfcTag.findUnique({ where: { id } });
      if (!tag) throw new Error("NFC tag not found");

      // Verify caller is OWNER or MANAGER of the tag's org
      const membership = await prisma.organizationMember.findUnique({
        where: { userId_organizationId: { userId: context.userId, organizationId: tag.organizationId } },
      });
      if (!membership || !["OWNER", "ADMIN", "MANAGER"].includes(membership.role)) {
        throw new Error("Only owners, admins, and managers can deactivate NFC tags");
      }

      return prisma.nfcTag.update({ where: { id }, data: { isActive: false } });
    },

    nfcCheckIn: async (
      _: unknown,
      { token, forUserId }: { token: string; forUserId?: string },
      context: { userId?: string }
    ) => {
      if (!context.userId) throw new Error("Authentication required");

      // 1. Look up NFC tag by token
      const tag = await prisma.nfcTag.findUnique({ where: { token } });
      if (!tag) throw new Error("Unrecognized tag");
      if (!tag.isActive) throw new Error("Tag deactivated");

      // Determine target user — if forUserId is provided, verify guardian relationship
      let targetUserId = context.userId;
      if (forUserId && forUserId !== context.userId) {
        const guardianLink = await prisma.guardianLink.findFirst({
          where: { guardianId: context.userId, athleteId: forUserId, organizationId: tag.organizationId },
        });
        if (!guardianLink) throw new Error("Not authorized to check in this user");
        targetUserId = forUserId;
      }

      // 2. Verify target user is org member
      const orgMembership = await prisma.organizationMember.findUnique({
        where: { userId_organizationId: { userId: targetUserId, organizationId: tag.organizationId } },
      });
      if (!orgMembership) throw new Error("You are not a member of this organization");

      // 3. Get target user's teamIds in this org
      const teamMemberships = await prisma.teamMember.findMany({
        where: { userId: targetUserId, team: { organizationId: tag.organizationId } },
        select: { teamId: true },
      });
      const teamIds = teamMemberships.map((m) => m.teamId);

      // 4. Find today's events matching those teams
      const now = new Date();
      const todayStart = new Date(now);
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date(now);
      todayEnd.setHours(23, 59, 59, 999);

      const todaysEvents = await prisma.event.findMany({
        where: {
          organizationId: tag.organizationId,
          date: { gte: todayStart, lte: todayEnd },
          OR: [
            { teamId: { in: teamIds } },
            { participatingTeams: { some: { id: { in: teamIds } } } },
            { teamId: null }, // org-wide events
          ],
        },
        orderBy: { date: "asc" },
      });

      if (todaysEvents.length === 0) throw new Error("No events today");

      // Pre-fetch user's check-ins for today's events to skip already-checked-out ones
      const todayCheckIns = await prisma.checkIn.findMany({
        where: {
          userId: targetUserId,
          eventId: { in: todaysEvents.map((e) => e.id) },
        },
      });
      const checkedOutEventIds = new Set(
        todayCheckIns.filter((ci) => ci.checkOutTime !== null).map((ci) => ci.eventId)
      );

      // Find event in check-in window (30 min before start to event end)
      const CHECK_IN_WINDOW_MINUTES = 30;
      let selectedEvent = null;

      for (const event of todaysEvents) {
        if (checkedOutEventIds.has(event.id)) continue;

        const eventDate = new Date(event.date);
        const start = parseTimeString(event.startTime);
        const end = parseTimeString(event.endTime);

        const eventStart = new Date(eventDate);
        eventStart.setHours(start.hours, start.minutes, 0, 0);
        const windowStart = new Date(eventStart.getTime() - CHECK_IN_WINDOW_MINUTES * 60 * 1000);

        const eventEnd = new Date(eventDate);
        eventEnd.setHours(end.hours, end.minutes, 0, 0);

        if (now >= windowStart && now <= eventEnd) {
          selectedEvent = event;
          break;
        }
      }

      // If no event in window, find the next upcoming event and tell user to wait
      if (!selectedEvent) {
        for (const event of todaysEvents) {
          if (checkedOutEventIds.has(event.id)) continue;
          const eventDate = new Date(event.date);
          const start = parseTimeString(event.startTime);
          const eventStart = new Date(eventDate);
          eventStart.setHours(start.hours, start.minutes, 0, 0);
          if (eventStart > now) {
            throw new Error(`TOO_EARLY:${event.title}:${event.startTime}`);
          }
        }
        // All remaining events already ended
        throw new Error("No events today");
      }

      // 5. Toggle logic
      const existingCheckIn = await prisma.checkIn.findUnique({
        where: { userId_eventId: { userId: targetUserId, eventId: selectedEvent.id } },
      });

      if (existingCheckIn) {
        if (existingCheckIn.checkOutTime) {
          throw new Error("Already checked out");
        }
        // Check out — use event start time as effective start if checked in early
        if (!existingCheckIn.checkInTime) throw new Error("No check-in time recorded");
        let effectiveStart = existingCheckIn.checkInTime;
        {
          const evDate = new Date(selectedEvent.date);
          const evTime = parseTimeString(selectedEvent.startTime);
          const evStart = new Date(evDate);
          evStart.setHours(evTime.hours, evTime.minutes, 0, 0);
          if (existingCheckIn.checkInTime < evStart) {
            effectiveStart = evStart;
          }
        }
        const hoursLogged = Math.max(0, (now.getTime() - effectiveStart.getTime()) / (1000 * 60 * 60));
        const updatedCheckIn = await prisma.checkIn.update({
          where: { id: existingCheckIn.id },
          data: {
            checkOutTime: now,
            hoursLogged: Math.round(hoursLogged * 100) / 100,
          },
        });
        return { checkIn: updatedCheckIn, action: "CHECKED_OUT", event: selectedEvent };
      }

      // Check in — determine ON_TIME vs LATE (on-time = before start, late = after start)
      const eventDate = new Date(selectedEvent.date);
      const { hours, minutes } = parseTimeString(selectedEvent.startTime);
      const eventStart = new Date(eventDate);
      eventStart.setHours(hours, minutes, 0, 0);
      const status: AttendanceStatus = now.getTime() <= eventStart.getTime() ? "ON_TIME" : "LATE";

      const newCheckIn = await prisma.checkIn.create({
        data: {
          userId: targetUserId,
          eventId: selectedEvent.id,
          status,
          checkInTime: now,
        },
      });
      return { checkIn: newCheckIn, action: "CHECKED_IN", event: selectedEvent };
    },

    adHocNfcCheckIn: async (
      _: unknown,
      { input }: { input: { token: string; teamId: string; startTime: string; endTime: string; note?: string } },
      context: { userId?: string }
    ) => {
      if (!context.userId) throw new Error("Authentication required");

      // Validate NFC tag
      const tag = await prisma.nfcTag.findUnique({ where: { token: input.token } });
      if (!tag) throw new Error("Unrecognized tag");
      if (!tag.isActive) throw new Error("Tag deactivated");

      // Verify user is org member
      const orgMembership = await prisma.organizationMember.findUnique({
        where: { userId_organizationId: { userId: context.userId, organizationId: tag.organizationId } },
      });
      if (!orgMembership) throw new Error("You are not a member of this organization");

      // Verify user is member of specified team
      const teamMembership = await prisma.teamMember.findUnique({
        where: { userId_teamId: { userId: context.userId, teamId: input.teamId } },
      });
      if (!teamMembership) throw new Error("You are not a member of this team");

      // Verify team belongs to the org
      const team = await prisma.team.findUnique({ where: { id: input.teamId } });
      if (!team || team.organizationId !== tag.organizationId) {
        throw new Error("Team does not belong to this organization");
      }

      // Create ad-hoc event for today
      const now = new Date();
      const todayStart = new Date(now);
      todayStart.setHours(0, 0, 0, 0);

      const adHocEvent = await prisma.event.create({
        data: {
          title: "Ad-Hoc Check-In",
          type: "PRACTICE",
          date: todayStart,
          startTime: input.startTime,
          endTime: input.endTime,
          organizationId: tag.organizationId,
          teamId: input.teamId,
          isAdHoc: true,
        },
      });

      // Create check-in (pending approval)
      const checkIn = await prisma.checkIn.create({
        data: {
          userId: context.userId,
          eventId: adHocEvent.id,
          status: "ON_TIME",
          checkInTime: now,
          note: input.note || null,
          isAdHoc: true,
          approved: false,
        },
      });

      return { checkIn, action: "CHECKED_IN", event: adHocEvent };
    },

    approveAdHocCheckIn: async (
      _: unknown,
      { checkInId }: { checkInId: string },
      context: { userId?: string }
    ) => {
      if (!context.userId) throw new Error("Authentication required");

      const checkIn = await prisma.checkIn.findUnique({
        where: { id: checkInId },
        include: { event: true },
      });
      if (!checkIn || !checkIn.isAdHoc) throw new Error("Ad-hoc check-in not found");

      // Verify caller is OWNER, MANAGER, or COACH in the org
      const orgMembership = await prisma.organizationMember.findUnique({
        where: { userId_organizationId: { userId: context.userId, organizationId: checkIn.event.organizationId } },
      });
      if (!orgMembership || !["OWNER", "ADMIN", "MANAGER", "COACH"].includes(orgMembership.role)) {
        throw new Error("Only owners, admins, managers, or coaches can approve ad-hoc check-ins");
      }

      // COACH must be a coach on the specific team
      if (orgMembership.role === "COACH" && checkIn.event.teamId) {
        const teamMembership = await prisma.teamMember.findUnique({
          where: { userId_teamId: { userId: context.userId, teamId: checkIn.event.teamId } },
        });
        if (!teamMembership || !["COACH", "ADMIN"].includes(teamMembership.role)) {
          throw new Error("You can only approve check-ins for teams you coach");
        }
      }

      return prisma.checkIn.update({
        where: { id: checkInId },
        data: { approved: true },
      });
    },

    denyAdHocCheckIn: async (
      _: unknown,
      { checkInId }: { checkInId: string },
      context: { userId?: string }
    ) => {
      if (!context.userId) throw new Error("Authentication required");

      const checkIn = await prisma.checkIn.findUnique({
        where: { id: checkInId },
        include: { event: true },
      });
      if (!checkIn || !checkIn.isAdHoc) throw new Error("Ad-hoc check-in not found");

      // Verify caller is OWNER, MANAGER, or COACH in the org
      const orgMembership = await prisma.organizationMember.findUnique({
        where: { userId_organizationId: { userId: context.userId, organizationId: checkIn.event.organizationId } },
      });
      if (!orgMembership || !["OWNER", "ADMIN", "MANAGER", "COACH"].includes(orgMembership.role)) {
        throw new Error("Only owners, admins, managers, or coaches can deny ad-hoc check-ins");
      }

      // COACH must be a coach on the specific team
      if (orgMembership.role === "COACH" && checkIn.event.teamId) {
        const teamMembership = await prisma.teamMember.findUnique({
          where: { userId_teamId: { userId: context.userId, teamId: checkIn.event.teamId } },
        });
        if (!teamMembership || !["COACH", "ADMIN"].includes(teamMembership.role)) {
          throw new Error("You can only deny check-ins for teams you coach");
        }
      }

      // Delete the check-in and the auto-created ad-hoc event
      await prisma.checkIn.delete({ where: { id: checkInId } });
      await prisma.event.delete({ where: { id: checkIn.eventId } });
      return true;
    },

    // Feedback mutations
    submitFeedback: async (
      _: unknown,
      { input }: { input: { category: string; message: string } },
      context: { userId?: string }
    ) => {
      if (!context.userId) throw new Error("Authentication required");

      const user = await prisma.user.findUnique({ where: { id: context.userId } });
      if (!user) throw new Error("User not found");

      await sendFeedbackEmail({
        userEmail: user.email,
        userName: `${user.firstName} ${user.lastName}`,
        category: input.category,
        message: input.message,
      });

      return true;
    },

    // Excuse mutations
    createExcuseRequest: async (
      _: unknown,
      { input }: { input: { userId: string; eventId: string; reason: string } },
      context: { userId?: string }
    ) => {
      if (!context.userId) throw new Error("Authentication required");
      if (input.userId !== context.userId) {
        const guardianLink = await prisma.guardianLink.findFirst({
          where: { guardianId: context.userId, athleteId: input.userId },
        });
        if (!guardianLink) throw new Error("Not authorized to submit excuse for this user");
      }

      const existing = await prisma.excuseRequest.findUnique({
        where: { userId_eventId: { userId: input.userId, eventId: input.eventId } },
      });

      if (!existing) {
        return prisma.excuseRequest.create({ data: { ...input, attemptCount: 1 } });
      }
      if (existing.status === "PENDING") {
        throw new Error("You already have a pending excuse request for this event.");
      }
      if (existing.status === "APPROVED") {
        throw new Error("Your excuse for this event has already been approved.");
      }
      // DENIED — allow resubmission up to 3 attempts
      if (existing.attemptCount >= 3) {
        throw new Error("You have reached the maximum of 3 excuse requests for this event.");
      }
      return prisma.excuseRequest.update({
        where: { id: existing.id },
        data: { status: "PENDING", reason: input.reason, attemptCount: existing.attemptCount + 1 },
      });
    },

    updateExcuseRequest: async (
      _: unknown,
      { input }: { input: { id: string; status: ExcuseRequestStatus } }
    ) => {
      const updated = await prisma.excuseRequest.update({
        where: { id: input.id },
        data: { status: input.status },
        include: {
          user: true,
          event: true,
        },
      });

      // If approved, update or create the check-in as excused
      if (input.status === "APPROVED") {
        await prisma.checkIn.upsert({
          where: {
            userId_eventId: {
              userId: updated.userId,
              eventId: updated.eventId,
            },
          },
          create: {
            userId: updated.userId,
            eventId: updated.eventId,
            status: "EXCUSED",
            checkInTime: null,
            checkOutTime: null,
            hoursLogged: 0,
          },
          update: {
            status: "EXCUSED",
            checkInTime: null,
            checkOutTime: null,
            hoursLogged: 0,
          },
        });
      }

      // Send notification (non-blocking)
      if (input.status === "APPROVED" || input.status === "DENIED") {
        (async () => {
          try {
            const prefs = await prisma.notificationPreferences.findUnique({
              where: { userId: updated.userId },
            });

            // Skip if excuse status notifications are disabled
            if (prefs && !prefs.excuseStatusEnabled) {
              return;
            }

            const title = input.status === "APPROVED" ? "Excuse Approved" : "Excuse Denied";
            const message = `Your excuse for ${updated.event.title} was ${input.status.toLowerCase()}`;

            // Send push notification
            if (!prefs || prefs.pushEnabled) {
              sendPushNotification(updated.userId, title, message, {
                type: "EXCUSE_STATUS",
                excuseRequestId: input.id,
                eventId: updated.eventId,
              }).catch((err) => console.error("Failed to send push notification:", err));
            }

            // Send email notification
            if (!prefs || prefs.emailEnabled) {
              sendExcuseStatusEmail(
                updated.user.email,
                input.status as "APPROVED" | "DENIED",
                updated.event.title,
                updated.reason
              ).catch((err) => console.error("Failed to send email notification:", err));
            }
          } catch (err) {
            console.error("Failed to send excuse status notification:", err);
          }
        })();
      }

      return updated;
    },

    cancelExcuseRequest: async (_: unknown, { id }: { id: string }) => {
      await prisma.excuseRequest.delete({ where: { id } });
      return true;
    },

    // Notification read mutations
    markNotificationRead: async (
      _: unknown,
      { id }: { id: string },
      context: { userId?: string }
    ) => {
      if (!context.userId) throw new Error("Authentication required");
      return prisma.notificationDelivery.update({
        where: { id },
        data: { readAt: new Date() },
      });
    },

    markAllNotificationsRead: async (
      _: unknown,
      __: unknown,
      context: { userId?: string }
    ) => {
      if (!context.userId) throw new Error("Authentication required");
      const result = await prisma.notificationDelivery.updateMany({
        where: { userId: context.userId, readAt: null },
        data: { readAt: new Date() },
      });
      return result.count;
    },

    // RSVP mutations
    upsertRsvp: async (
      _: unknown,
      { input }: { input: { userId: string; eventId: string; status: RsvpStatus; note?: string } },
      context: { userId?: string }
    ) => {
      if (!context.userId) throw new Error("Authentication required");
      if (input.userId !== context.userId) {
        const guardianLink = await prisma.guardianLink.findFirst({
          where: { guardianId: context.userId, athleteId: input.userId },
        });
        if (!guardianLink) throw new Error("Not authorized to RSVP for this user");
      }
      const { userId, eventId, status, note } = input;
      const prev = await prisma.eventRsvp.findUnique({
        where: { userId_eventId: { userId, eventId } },
      });
      const rsvp = await prisma.eventRsvp.upsert({
        where: { userId_eventId: { userId, eventId } },
        create: { userId, eventId, status, note },
        update: { status, note },
        include: { user: true, event: true },
      });
      if (status === "NOT_GOING") {
        // Auto-create excuse request
        await prisma.excuseRequest.upsert({
          where: { userId_eventId: { userId, eventId } },
          create: { userId, eventId, reason: note || "Unable to attend" },
          update: { reason: note || "Unable to attend", status: "PENDING" },
        });
      } else if (prev?.status === "NOT_GOING") {
        // Switched away from NOT_GOING — cancel pending auto-excuse
        await prisma.excuseRequest.deleteMany({
          where: { userId, eventId, status: "PENDING" },
        });
      }
      return rsvp;
    },

    deleteRsvp: async (_: unknown, { userId, eventId }: { userId: string; eventId: string }) => {
      const existing = await prisma.eventRsvp.findUnique({
        where: { userId_eventId: { userId, eventId } },
      });
      if (!existing) return false;
      if (existing.status === "NOT_GOING") {
        await prisma.excuseRequest.deleteMany({
          where: { userId, eventId, status: "PENDING" },
        });
      }
      await prisma.eventRsvp.delete({ where: { userId_eventId: { userId, eventId } } });
      return true;
    },

    // Notification mutations
    registerDeviceToken: async (
      _: unknown,
      { input }: { input: { token: string; platform: Platform } },
      context: { userId?: string }
    ) => {
      if (!context.userId) throw new Error("Authentication required");

      // Register with SNS
      const endpoint = await registerPushToken(input.token, input.platform as "IOS" | "ANDROID");

      // Upsert device token
      const deviceToken = await prisma.deviceToken.upsert({
        where: {
          userId_token: {
            userId: context.userId,
            token: input.token,
          },
        },
        update: {
          endpoint,
          platform: input.platform,
          isActive: true,
        },
        create: {
          userId: context.userId,
          token: input.token,
          platform: input.platform,
          endpoint,
          isActive: true,
        },
      });

      return deviceToken;
    },

    unregisterDeviceToken: async (
      _: unknown,
      { tokenId }: { tokenId: string },
      context: { userId?: string }
    ) => {
      if (!context.userId) throw new Error("Authentication required");

      await prisma.deviceToken.update({
        where: { id: tokenId },
        data: { isActive: false },
      });

      return true;
    },

    updateNotificationPreferences: async (
      _: unknown,
      { input }: { input: any },
      context: { userId?: string }
    ) => {
      if (!context.userId) throw new Error("Authentication required");

      const prefs = await prisma.notificationPreferences.upsert({
        where: { userId: context.userId },
        update: input,
        create: {
          userId: context.userId,
          ...input,
        },
      });

      return prefs;
    },

    createAnnouncement: async (
      _: unknown,
      { input }: { input: any },
      context: { userId?: string }
    ) => {
      if (!context.userId) throw new Error("Authentication required");

      // Verify user has permission (OWNER, ADMIN, MANAGER, or COACH)
      const membership = await prisma.organizationMember.findUnique({
        where: {
          userId_organizationId: {
            userId: context.userId,
            organizationId: input.organizationId,
          },
        },
      });

      if (!membership || !["OWNER", "ADMIN", "MANAGER", "COACH"].includes(membership.role)) {
        throw new Error("Insufficient permissions to create announcements");
      }

      // Create announcement
      const announcement = await prisma.announcement.create({
        data: {
          title: input.title,
          message: input.message,
          organizationId: input.organizationId,
          createdBy: context.userId,
          targetType: input.targetType || "ALL_TEAMS",
          teamIds: input.teamIds || [],
          userIds: input.userIds || [],
          eventDate: input.eventDate ? new Date(input.eventDate) : null,
          scheduledFor: input.scheduledFor ? new Date(input.scheduledFor) : null,
        },
        include: {
          organization: true,
          creator: true,
        },
      });

      return announcement;
    },

    sendAnnouncement: async (
      _: unknown,
      { id }: { id: string },
      context: { userId?: string }
    ) => {
      if (!context.userId) throw new Error("Authentication required");

      // Verify user is the creator or has admin permission
      const announcement = await prisma.announcement.findUnique({
        where: { id },
        include: { organization: true },
      });

      if (!announcement) {
        throw new Error("Announcement not found");
      }

      if (announcement.createdBy !== context.userId) {
        const membership = await prisma.organizationMember.findUnique({
          where: {
            userId_organizationId: {
              userId: context.userId,
              organizationId: announcement.organizationId,
            },
          },
        });

        if (!membership || !["OWNER", "ADMIN", "MANAGER", "COACH"].includes(membership.role)) {
          throw new Error("Insufficient permissions");
        }
      }

      // If the announcement has a future scheduledFor, skip immediate broadcast — cron will handle it
      const now = new Date();
      if (announcement.scheduledFor && announcement.scheduledFor > now) {
        return true;
      }

      // Mark as sent immediately so the UI reflects the sent state right away
      await prisma.announcement.update({
        where: { id },
        data: { sentAt: now },
      });

      // Broadcast announcement in background (non-blocking)
      broadcastAnnouncement(id).catch((err) => {
        console.error(`Failed to broadcast announcement ${id}:`, err);
      });

      return true;
    },

    deleteAnnouncement: async (
      _: unknown,
      { id }: { id: string },
      context: { userId?: string }
    ) => {
      if (!context.userId) throw new Error("Authentication required");

      // Verify user is the creator or has admin permission
      const announcement = await prisma.announcement.findUnique({
        where: { id },
      });

      if (!announcement) {
        throw new Error("Announcement not found");
      }

      if (announcement.createdBy !== context.userId) {
        const membership = await prisma.organizationMember.findUnique({
          where: {
            userId_organizationId: {
              userId: context.userId,
              organizationId: announcement.organizationId,
            },
          },
        });

        if (!membership || !["OWNER", "ADMIN"].includes(membership.role)) {
          throw new Error("Insufficient permissions");
        }
      }

      await prisma.announcement.delete({ where: { id } });
      return true;
    },

    createEmailReportConfig: async (
      _: unknown,
      { input }: { input: { organizationId: string; frequency: ReportFrequency } },
      context: { userId?: string }
    ) => {
      if (!context.userId) throw new Error("Authentication required");

      // Verify user is a GUARDIAN in the organization
      const membership = await prisma.organizationMember.findUnique({
        where: {
          userId_organizationId: {
            userId: context.userId,
            organizationId: input.organizationId,
          },
        },
      });

      if (!membership || membership.role !== "GUARDIAN") {
        throw new Error("Only guardians can configure email reports");
      }

      // Verify guardian has linked athletes
      const guardianLinks = await prisma.guardianLink.findMany({
        where: {
          guardianId: context.userId,
          organizationId: input.organizationId,
        },
      });

      if (guardianLinks.length === 0) {
        throw new Error("No athletes linked to this guardian");
      }

      const config = await prisma.emailReportConfig.create({
        data: {
          userId: context.userId,
          organizationId: input.organizationId,
          frequency: input.frequency,
          enabled: true,
        },
        include: {
          user: true,
          organization: true,
        },
      });

      return config;
    },

    updateEmailReportConfig: async (
      _: unknown,
      { id, frequency, enabled }: { id: string; frequency?: ReportFrequency; enabled?: boolean },
      context: { userId?: string }
    ) => {
      if (!context.userId) throw new Error("Authentication required");

      // Verify ownership
      const config = await prisma.emailReportConfig.findUnique({
        where: { id },
      });

      if (!config || config.userId !== context.userId) {
        throw new Error("Not found or unauthorized");
      }

      const updated = await prisma.emailReportConfig.update({
        where: { id },
        data: {
          ...(frequency && { frequency }),
          ...(enabled !== undefined && { enabled }),
        },
        include: {
          user: true,
          organization: true,
        },
      });

      return updated;
    },

    deleteEmailReportConfig: async (
      _: unknown,
      { id }: { id: string },
      context: { userId?: string }
    ) => {
      if (!context.userId) throw new Error("Authentication required");

      // Verify ownership
      const config = await prisma.emailReportConfig.findUnique({
        where: { id },
      });

      if (!config || config.userId !== context.userId) {
        throw new Error("Not found or unauthorized");
      }

      await prisma.emailReportConfig.delete({ where: { id } });
      return true;
    },

    sendTestReport: async (
      _: unknown,
      { configId }: { configId: string },
      context: { userId?: string }
    ) => {
      if (!context.userId) throw new Error("Authentication required");

      // Verify ownership
      const config = await prisma.emailReportConfig.findUnique({
        where: { id: configId },
      });

      if (!config || config.userId !== context.userId) {
        throw new Error("Not found or unauthorized");
      }

      // Generate and send report in background (non-blocking)
      generateGuardianReport(configId).catch((err) => {
        console.error(`Failed to generate test report for config ${configId}:`, err);
      });

      return true;
    },

    // Health & Safety mutations
    createEmergencyContact: async (_: unknown, { input }: { input: { userId: string; organizationId: string; name: string; relationship: string; phone: string; email?: string; isPrimary?: boolean } }) => {
      if (input.isPrimary) {
        await prisma.emergencyContact.updateMany({
          where: { userId: input.userId, organizationId: input.organizationId },
          data: { isPrimary: false },
        });
      }
      return prisma.emergencyContact.create({ data: { ...input, phone: sanitizePhone(input.phone) || input.phone } });
    },

    updateEmergencyContact: async (_: unknown, { id, input }: { id: string; input: { name?: string; relationship?: string; phone?: string; email?: string; isPrimary?: boolean } }) => {
      if (input.isPrimary) {
        const existing = await prisma.emergencyContact.findUnique({ where: { id } });
        if (existing) {
          await prisma.emergencyContact.updateMany({
            where: { userId: existing.userId, organizationId: existing.organizationId, id: { not: id } },
            data: { isPrimary: false },
          });
        }
      }
      const { phone, ...rest } = input;
      return prisma.emergencyContact.update({
        where: { id },
        data: { ...rest, ...(phone !== undefined ? { phone: sanitizePhone(phone) || phone } : {}) },
      });
    },

    deleteEmergencyContact: async (_: unknown, { id }: { id: string }) => {
      await prisma.emergencyContact.delete({ where: { id } });
      return true;
    },

    upsertMedicalInfo: async (_: unknown, { input }: { input: { userId: string; organizationId: string; conditions?: string; allergies?: string; medications?: string; insuranceProvider?: string; insurancePolicyNumber?: string; insuranceGroupNumber?: string; notes?: string } }) => {
      const { userId, organizationId, ...data } = input;
      return prisma.medicalInfo.upsert({
        where: { userId_organizationId: { userId, organizationId } },
        create: { userId, organizationId, ...data },
        update: data,
      });
    },

    updateOrganizationSettings: async (_: unknown, { id, adminHealthAccess, coachHealthAccess, allowCoachHourEdit, reportFrequencies }: { id: string; adminHealthAccess?: string; coachHealthAccess?: string; allowCoachHourEdit?: boolean; reportFrequencies?: string[] }) => {
      if (reportFrequencies !== undefined) {
        await prisma.orgReportSendRecord.deleteMany({
          where: { organizationId: id, frequency: { notIn: reportFrequencies } },
        });
      }
      return prisma.organization.update({
        where: { id },
        data: {
          ...(adminHealthAccess !== undefined && { adminHealthAccess: adminHealthAccess as any }),
          ...(coachHealthAccess !== undefined && { coachHealthAccess: coachHealthAccess as any }),
          ...(allowCoachHourEdit !== undefined && { allowCoachHourEdit }),
          ...(reportFrequencies !== undefined && { reportFrequencies }),
        },
      });
    },

    updateCheckInTimes: async (
      _: unknown,
      { checkInId, checkInTime, checkOutTime }: { checkInId: string; checkInTime?: string | null; checkOutTime?: string | null },
      context: { userId?: string }
    ) => {
      if (!context.userId) throw new Error("Authentication required");

      const checkIn = await prisma.checkIn.findUnique({
        where: { id: checkInId },
        include: { event: true },
      });
      if (!checkIn) throw new Error("Check-in not found");

      const membership = await prisma.organizationMember.findUnique({
        where: { userId_organizationId: { userId: context.userId, organizationId: checkIn.event.organizationId } },
      });
      if (!membership) throw new Error("Not a member of this organization");

      const isAdmin = ["OWNER", "ADMIN", "MANAGER"].includes(membership.role);
      if (!isAdmin) {
        if (checkIn.userId !== context.userId) throw new Error("Not authorized");
        if (membership.role !== "COACH") throw new Error("Not authorized");
        const org = await prisma.organization.findUnique({ where: { id: checkIn.event.organizationId } });
        if (!org?.allowCoachHourEdit) throw new Error("Coach hour editing is not enabled for this organization");
      }

      let hoursLogged = checkIn.hoursLogged;
      if (checkInTime && checkOutTime) {
        const diffMs = new Date(checkOutTime).getTime() - new Date(checkInTime).getTime();
        hoursLogged = Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100;
      }

      return prisma.checkIn.update({
        where: { id: checkInId },
        data: {
          ...(checkInTime !== undefined && { checkInTime: checkInTime ? new Date(checkInTime) : null }),
          ...(checkOutTime !== undefined && { checkOutTime: checkOutTime ? new Date(checkOutTime) : null }),
          ...(hoursLogged !== null && { hoursLogged }),
        },
        include: { user: true, event: true },
      });
    },

    // Athlete include/exclude mutations
    addAthleteToEvent: async (_: unknown, { eventId, userId }: { eventId: string; userId: string }) => {
      await prisma.eventAthleteInclude.upsert({
        where: { eventId_userId: { eventId, userId } },
        create: { eventId, userId },
        update: {},
      });
      await prisma.eventAthleteExclude.deleteMany({ where: { eventId, userId } });
      return prisma.event.findUnique({ where: { id: eventId } });
    },

    removeAthleteFromEvent: async (_: unknown, { eventId, userId }: { eventId: string; userId: string }) => {
      await prisma.eventAthleteInclude.deleteMany({ where: { eventId, userId } });
      return prisma.event.findUnique({ where: { id: eventId } });
    },

    excludeAthleteFromEvent: async (_: unknown, { eventId, userId }: { eventId: string; userId: string }) => {
      await prisma.eventAthleteExclude.upsert({
        where: { eventId_userId: { eventId, userId } },
        create: { eventId, userId },
        update: {},
      });
      await prisma.eventAthleteInclude.deleteMany({ where: { eventId, userId } });
      return prisma.event.findUnique({ where: { id: eventId } });
    },

    unexcludeAthleteFromEvent: async (_: unknown, { eventId, userId }: { eventId: string; userId: string }) => {
      await prisma.eventAthleteExclude.deleteMany({ where: { eventId, userId } });
      return prisma.event.findUnique({ where: { id: eventId } });
    },

    // Recurring event athlete include/exclude mutations
    addAthleteToRecurringEvent: async (_: unknown, { recurringEventId, userId }: { recurringEventId: string; userId: string }) => {
      await prisma.recurringEventAthleteInclude.upsert({
        where: { recurringEventId_userId: { recurringEventId, userId } },
        create: { recurringEventId, userId },
        update: {},
      });
      await prisma.recurringEventAthleteExclude.deleteMany({ where: { recurringEventId, userId } });
      return prisma.recurringEvent.findUnique({ where: { id: recurringEventId } });
    },

    removeAthleteFromRecurringEvent: async (_: unknown, { recurringEventId, userId }: { recurringEventId: string; userId: string }) => {
      await prisma.recurringEventAthleteInclude.deleteMany({ where: { recurringEventId, userId } });
      return prisma.recurringEvent.findUnique({ where: { id: recurringEventId } });
    },

    excludeAthleteFromRecurringEvent: async (_: unknown, { recurringEventId, userId }: { recurringEventId: string; userId: string }) => {
      await prisma.recurringEventAthleteExclude.upsert({
        where: { recurringEventId_userId: { recurringEventId, userId } },
        create: { recurringEventId, userId },
        update: {},
      });
      await prisma.recurringEventAthleteInclude.deleteMany({ where: { recurringEventId, userId } });
      return prisma.recurringEvent.findUnique({ where: { id: recurringEventId } });
    },

    unexcludeAthleteFromRecurringEvent: async (_: unknown, { recurringEventId, userId }: { recurringEventId: string; userId: string }) => {
      await prisma.recurringEventAthleteExclude.deleteMany({ where: { recurringEventId, userId } });
      return prisma.recurringEvent.findUnique({ where: { id: recurringEventId } });
    },
  },

  // Field resolvers
  User: {
    memberships: (parent: { id: string }) => prisma.teamMember.findMany({ where: { userId: parent.id } }),
    organizationMemberships: (parent: { id: string }) =>
      prisma.organizationMember.findMany({ where: { userId: parent.id } }),
    checkIns: (parent: { id: string }) => prisma.checkIn.findMany({ where: { userId: parent.id } }),
    emergencyContacts: (parent: { id: string }, { organizationId }: { organizationId: string }) =>
      prisma.emergencyContact.findMany({
        where: { userId: parent.id, organizationId },
        orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
      }),
    medicalInfo: (parent: { id: string }, { organizationId }: { organizationId: string }) =>
      prisma.medicalInfo.findUnique({
        where: { userId_organizationId: { userId: parent.id, organizationId } },
      }),
    dateOfBirth: (parent: any) => parent.dateOfBirth ? toISO(parent.dateOfBirth) : null,
    createdAt: (parent: any) => toISO(parent.createdAt),
    updatedAt: (parent: any) => toISO(parent.updatedAt),
  },

  Organization: {
    teams: (parent: { id: string }) => prisma.team.findMany({ where: { organizationId: parent.id, archivedAt: null } }),
    events: (parent: { id: string }) => prisma.event.findMany({ where: { organizationId: parent.id, isAdHoc: false } }),
    members: (parent: { id: string }) =>
      prisma.organizationMember.findMany({ where: { organizationId: parent.id } }),
    invites: (parent: { id: string }) =>
      prisma.invite.findMany({ where: { organizationId: parent.id, status: "PENDING" } }),
    nfcTags: (parent: { id: string }) =>
      prisma.nfcTag.findMany({ where: { organizationId: parent.id, isActive: true } }),
    seasons: (parent: { id: string }) =>
      prisma.orgSeason.findMany({ where: { organizationId: parent.id }, orderBy: { name: "asc" } }),
    memberCount: async (parent: { id: string }) => {
      return prisma.teamMember.count({
        where: { team: { organizationId: parent.id, archivedAt: null }, role: { in: ["MEMBER", "CAPTAIN"] as TeamRole[] } },
      });
    },
    payrollConfig: (parent: any) => {
      const config = parent.payrollConfig as any;
      if (!config) return { payPeriod: null, defaultHourlyRate: null, deductions: [] };
      return {
        payPeriod: config.payPeriod ?? null,
        defaultHourlyRate: config.defaultHourlyRate ?? null,
        deductions: (config.deductions ?? []).map((d: any) => ({
          id: d.id ?? String(Math.random()),
          name: d.name,
          type: d.type,
          value: d.value,
        })),
      };
    },
    createdAt: (parent: any) => toISO(parent.createdAt),
    updatedAt: (parent: any) => toISO(parent.updatedAt),
  },

  OrgSeason: {
    createdAt: (parent: any) => toISO(parent.createdAt),
    updatedAt: (parent: any) => toISO(parent.updatedAt),
  },

  EmergencyContact: {
    createdAt: (parent: any) => toISO(parent.createdAt),
    updatedAt: (parent: any) => toISO(parent.updatedAt),
  },

  MedicalInfo: {
    updatedAt: (parent: any) => toISO(parent.updatedAt),
  },

  Team: {
    organization: (parent: { organizationId: string }) =>
      prisma.organization.findUnique({ where: { id: parent.organizationId } }),
    orgSeason: (parent: { orgSeasonId?: string | null }) =>
      parent.orgSeasonId ? prisma.orgSeason.findUnique({ where: { id: parent.orgSeasonId } }) : null,
    members: (parent: { id: string }) => prisma.teamMember.findMany({ where: { teamId: parent.id } }),
    events: (parent: { id: string }) =>
      prisma.event.findMany({
        where: {
          isAdHoc: false,
          OR: [
            { teamId: parent.id },
            { participatingTeams: { some: { id: parent.id } } },
          ],
        },
        orderBy: { date: "asc" },
      }),
    recurringEvents: (parent: { id: string }) =>
      prisma.recurringEvent.findMany({ where: { teamId: parent.id } }),
    memberCount: (parent: { id: string }) => prisma.teamMember.count({ where: { teamId: parent.id, role: { in: ["MEMBER", "CAPTAIN"] as TeamRole[] } } }),
    attendancePercent: async (parent: { id: string; orgSeasonId?: string | null; seasonYear?: number | null }, { timeRange }: { timeRange?: string }) => {
      // Fetch team with season info to use season date range
      const team = await prisma.team.findUnique({
        where: { id: parent.id },
        include: { orgSeason: true },
      });

      const { start: startDate, end: endDate } = team?.orgSeason && team?.seasonYear
        ? getSeasonDateRange(team.orgSeason.startMonth, team.orgSeason.endMonth, team.seasonYear)
        : { start: new Date(0), end: new Date() }; // Fallback for legacy teams

      const members = await prisma.teamMember.findMany({ where: { teamId: parent.id, role: { in: ["MEMBER", "CAPTAIN"] as TeamRole[] } } });
      const athleteUserIds = members.map(m => m.userId);
      const checkIns = await prisma.checkIn.findMany({
        where: {
          event: { teamId: parent.id },
          createdAt: { gte: startDate, lte: endDate },
          userId: { in: athleteUserIds },
          approved: true,
        },
      });
      const totalHoursLogged = checkIns.reduce((sum, c) => sum + (c.hoursLogged || 0), 0);
      const totalHoursRequired = members.reduce((sum, m) => sum + m.hoursRequired, 0);
      return totalHoursRequired > 0 ? Math.min(100, (totalHoursLogged / totalHoursRequired) * 100) : 0;
    },
    createdAt: (parent: any) => toISO(parent.createdAt),
    updatedAt: (parent: any) => toISO(parent.updatedAt),
  },

  TeamMember: {
    user: (parent: { userId: string }) => prisma.user.findUnique({ where: { id: parent.userId } }),
    team: (parent: { teamId: string }) => prisma.team.findUnique({ where: { id: parent.teamId } }),
    hoursLogged: async (parent: { userId: string; teamId: string }, { timeRange }: { timeRange?: string }) => {
      // Fetch team with season info to use season date range
      const team = await prisma.team.findUnique({
        where: { id: parent.teamId },
        include: { orgSeason: true },
      });

      const { start: startDate, end: endDate } = team?.orgSeason && team?.seasonYear
        ? getSeasonDateRange(team.orgSeason.startMonth, team.orgSeason.endMonth, team.seasonYear)
        : { start: new Date(0), end: new Date() }; // Fallback for legacy teams

      const checkIns = await prisma.checkIn.findMany({
        where: {
          userId: parent.userId,
          event: { teamId: parent.teamId },
          createdAt: { gte: startDate, lte: endDate },
          approved: true,
        },
      });
      return checkIns.reduce((sum, c) => sum + (c.hoursLogged || 0), 0);
    },
    attendancePercent: async (
      parent: { userId: string; teamId: string; hoursRequired: number },
      { timeRange }: { timeRange?: string }
    ) => {
      // Fetch team with season info to use season date range
      const team = await prisma.team.findUnique({
        where: { id: parent.teamId },
        include: { orgSeason: true },
      });

      const { start: startDate, end: endDate } = team?.orgSeason && team?.seasonYear
        ? getSeasonDateRange(team.orgSeason.startMonth, team.orgSeason.endMonth, team.seasonYear)
        : { start: new Date(0), end: new Date() }; // Fallback for legacy teams

      const checkIns = await prisma.checkIn.findMany({
        where: {
          userId: parent.userId,
          event: { teamId: parent.teamId },
          createdAt: { gte: startDate, lte: endDate },
          approved: true,
        },
      });
      const hoursLogged = checkIns.reduce((sum, c) => sum + (c.hoursLogged || 0), 0);
      return parent.hoursRequired > 0 ? Math.min(100, (hoursLogged / parent.hoursRequired) * 100) : 0;
    },
    joinedAt: (parent: any) => toISO(parent.joinedAt),
  },

  Venue: {
    createdAt: (parent: any) => toISO(parent.createdAt),
    updatedAt: (parent: any) => toISO(parent.updatedAt),
  },

  Event: {
    organization: (parent: { organizationId: string }) =>
      prisma.organization.findUnique({ where: { id: parent.organizationId } }),
    team: (parent: { teamId: string | null }) =>
      parent.teamId ? prisma.team.findUnique({ where: { id: parent.teamId } }) : null,
    venue: (parent: { venueId: string | null }) =>
      parent.venueId ? prisma.venue.findUnique({ where: { id: parent.venueId } }) : null,
    checkIns: (parent: { id: string }) => prisma.checkIn.findMany({ where: { eventId: parent.id } }),
    rsvps: (parent: { id: string }) => prisma.eventRsvp.findMany({ where: { eventId: parent.id }, include: { user: true } }),
    recurringEvent: (parent: { recurringEventId: string | null }) =>
      parent.recurringEventId
        ? prisma.recurringEvent.findUnique({ where: { id: parent.recurringEventId } })
        : null,
    participatingTeams: (parent: { id: string }) =>
      prisma.team.findMany({
        where: { participatingEvents: { some: { id: parent.id } } },
      }),
    includedAthletes: async (parent: { id: string; recurringEventId?: string | null }) => {
      const eventRows = await prisma.eventAthleteInclude.findMany({
        where: { eventId: parent.id },
        include: { user: true },
      });
      const eventUserIds = new Set(eventRows.map(r => r.userId));
      let inherited: any[] = [];
      if (parent.recurringEventId) {
        const reRows = await prisma.recurringEventAthleteInclude.findMany({
          where: { recurringEventId: parent.recurringEventId },
          include: { user: true },
        });
        inherited = reRows.filter(r => !eventUserIds.has(r.userId)).map(r => r.user);
      }
      return [...eventRows.map(r => r.user), ...inherited];
    },
    excludedAthletes: async (parent: { id: string; recurringEventId?: string | null }) => {
      const eventRows = await prisma.eventAthleteExclude.findMany({
        where: { eventId: parent.id },
        include: { user: true },
      });
      const eventUserIds = new Set(eventRows.map(r => r.userId));
      let inherited: any[] = [];
      if (parent.recurringEventId) {
        const reRows = await prisma.recurringEventAthleteExclude.findMany({
          where: { recurringEventId: parent.recurringEventId },
          include: { user: true },
        });
        inherited = reRows.filter(r => !eventUserIds.has(r.userId)).map(r => r.user);
      }
      return [...eventRows.map(r => r.user), ...inherited];
    },
    date: (parent: any) => toISO(parent.date),
    endDate: (parent: any) => parent.endDate ? toISO(parent.endDate) : null,
    createdAt: (parent: any) => toISO(parent.createdAt),
    updatedAt: (parent: any) => toISO(parent.updatedAt),
  },

  RecurringEvent: {
    organization: (parent: { organizationId: string }) =>
      prisma.organization.findUnique({ where: { id: parent.organizationId } }),
    team: (parent: { teamId: string | null }) =>
      parent.teamId ? prisma.team.findUnique({ where: { id: parent.teamId } }) : null,
    venue: (parent: { venueId: string | null }) =>
      parent.venueId ? prisma.venue.findUnique({ where: { id: parent.venueId } }) : null,
    events: (parent: { id: string }) =>
      prisma.event.findMany({ where: { recurringEventId: parent.id }, orderBy: { date: "asc" } }),
    includedAthletes: (parent: { id: string }) =>
      prisma.recurringEventAthleteInclude.findMany({
        where: { recurringEventId: parent.id },
        include: { user: true },
      }).then(rows => rows.map(r => r.user)),
    excludedAthletes: (parent: { id: string }) =>
      prisma.recurringEventAthleteExclude.findMany({
        where: { recurringEventId: parent.id },
        include: { user: true },
      }).then(rows => rows.map(r => r.user)),
    startDate: (parent: any) => toISO(parent.startDate),
    endDate: (parent: any) => toISO(parent.endDate),
    createdAt: (parent: any) => toISO(parent.createdAt),
    updatedAt: (parent: any) => toISO(parent.updatedAt),
  },

  CheckIn: {
    user: (parent: { userId: string }) => prisma.user.findUnique({ where: { id: parent.userId } }),
    event: (parent: { eventId: string }) => prisma.event.findUnique({ where: { id: parent.eventId } }),
    checkInTime: (parent: any) => parent.checkInTime ? toISO(parent.checkInTime) : null,
    checkOutTime: (parent: any) => parent.checkOutTime ? toISO(parent.checkOutTime) : null,
    createdAt: (parent: any) => toISO(parent.createdAt),
    updatedAt: (parent: any) => toISO(parent.updatedAt),
  },

  ExcuseRequest: {
    user: (parent: { userId: string }) => prisma.user.findUnique({ where: { id: parent.userId } }),
    event: (parent: { eventId: string }) => prisma.event.findUnique({ where: { id: parent.eventId } }),
    createdAt: (parent: any) => toISO(parent.createdAt),
    updatedAt: (parent: any) => toISO(parent.updatedAt),
  },

  OrganizationMember: {
    user: (parent: { userId: string }) => prisma.user.findUnique({ where: { id: parent.userId } }),
    organization: (parent: { organizationId: string }) =>
      prisma.organization.findUnique({ where: { id: parent.organizationId } }),
    joinedAt: (parent: any) => toISO(parent.joinedAt),
  },

  Invite: {
    organization: (parent: { organizationId: string }) =>
      prisma.organization.findUnique({ where: { id: parent.organizationId } }),
    createdAt: (parent: any) => toISO(parent.createdAt),
    expiresAt: (parent: any) => toISO(parent.expiresAt),
  },

  NfcTag: {
    organization: (parent: { organizationId: string }) =>
      prisma.organization.findUnique({ where: { id: parent.organizationId } }),
    createdAt: (parent: any) => toISO(parent.createdAt),
  },

  GuardianLink: {
    guardian: (parent: { guardianId: string }) =>
      prisma.user.findUnique({ where: { id: parent.guardianId } }),
    athlete: (parent: { athleteId: string }) =>
      prisma.user.findUnique({ where: { id: parent.athleteId } }),
    organization: (parent: { organizationId: string }) =>
      prisma.organization.findUnique({ where: { id: parent.organizationId } }),
    createdAt: (parent: any) => toISO(parent.createdAt),
  },

  AthleteStatusRecord: {
    changedByUser: (parent: { changedByUserId: string }) =>
      prisma.user.findUnique({ where: { id: parent.changedByUserId } }),
    createdAt: (parent: any) => toISO(parent.createdAt),
  },

  GymnasticsProfile: {
    updatedAt: (parent: any) => toISO(parent.updatedAt),
  },

  DeviceToken: {
    createdAt: (parent: any) => toISO(parent.createdAt),
    updatedAt: (parent: any) => toISO(parent.updatedAt),
  },

  NotificationPreferences: {
    createdAt: (parent: any) => toISO(parent.createdAt),
    updatedAt: (parent: any) => toISO(parent.updatedAt),
  },

  Announcement: {
    organization: (parent: { organizationId: string }) =>
      prisma.organization.findUnique({ where: { id: parent.organizationId } }),
    creator: (parent: { createdBy: string }) =>
      prisma.user.findUnique({ where: { id: parent.createdBy } }),
    sentAt: (parent: any) => parent.sentAt ? toISO(parent.sentAt) : null,
    eventDate: (parent: any) => parent.eventDate ? toISO(parent.eventDate) : null,
    createdAt: (parent: any) => toISO(parent.createdAt),
    updatedAt: (parent: any) => toISO(parent.updatedAt),
  },

  EmailReportConfig: {
    user: (parent: { userId: string }) =>
      prisma.user.findUnique({ where: { id: parent.userId } }),
    organization: (parent: { organizationId: string }) =>
      prisma.organization.findUnique({ where: { id: parent.organizationId } }),
    lastSentAt: (parent: any) => parent.lastSentAt ? toISO(parent.lastSentAt) : null,
    createdAt: (parent: any) => toISO(parent.createdAt),
    updatedAt: (parent: any) => toISO(parent.updatedAt),
  },

  NotificationDelivery: {
    user: (parent: { userId: string }) =>
      prisma.user.findUnique({ where: { id: parent.userId } }),
    metadata: (parent: any) =>
      parent.metadata != null ? JSON.stringify(parent.metadata) : null,
    sentAt: (parent: any) => parent.sentAt ? toISO(parent.sentAt) : null,
    readAt: (parent: any) => parent.readAt ? toISO(parent.readAt) : null,
    createdAt: (parent: any) => toISO(parent.createdAt),
    updatedAt: (parent: any) => toISO(parent.updatedAt),
  },

  EventRsvp: {
    user: (parent: any) => parent.user ?? prisma.user.findUnique({ where: { id: parent.userId } }),
    event: (parent: any) => parent.event ?? prisma.event.findUnique({ where: { id: parent.eventId } }),
    createdAt: (parent: any) => toISO(parent.createdAt),
    updatedAt: (parent: any) => toISO(parent.updatedAt),
  },
};
