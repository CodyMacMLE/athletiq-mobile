import { prisma } from "../db.js";
import { AttendanceStatus, EventType, ExcuseRequestStatus, TeamRole } from "@prisma/client";

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
      const memberships = await prisma.teamMember.findMany({
        where: { userId: context.userId },
        include: { team: { include: { organization: true } } },
      });
      const orgs = memberships.map((m) => m.team.organization);
      // Deduplicate
      return [...new Map(orgs.map((o) => [o.id, o])).values()];
    },

    // Team queries
    team: async (_: unknown, { id }: { id: string }) => {
      return prisma.team.findUnique({ where: { id } });
    },

    teams: async (_: unknown, { organizationId }: { organizationId: string }) => {
      return prisma.team.findMany({ where: { organizationId } });
    },

    // Event queries
    event: async (_: unknown, { id }: { id: string }) => {
      return prisma.event.findUnique({ where: { id } });
    },

    events: async (
      _: unknown,
      { organizationId, startDate, endDate }: { organizationId: string; startDate?: string; endDate?: string }
    ) => {
      return prisma.event.findMany({
        where: {
          organizationId,
          ...(startDate && endDate && {
            date: {
              gte: new Date(startDate),
              lte: new Date(endDate),
            },
          }),
        },
        orderBy: { date: "asc" },
      });
    },

    upcomingEvents: async (_: unknown, { organizationId, limit }: { organizationId: string; limit?: number }) => {
      return prisma.event.findMany({
        where: {
          organizationId,
          date: { gte: new Date() },
        },
        orderBy: { date: "asc" },
        take: limit || 10,
      });
    },

    // Check-in queries
    checkIn: async (_: unknown, { id }: { id: string }) => {
      return prisma.checkIn.findUnique({ where: { id } });
    },

    checkInHistory: async (_: unknown, { userId, limit }: { userId: string; limit?: number }) => {
      return prisma.checkIn.findMany({
        where: { userId },
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

    // Analytics queries
    userStats: async (
      _: unknown,
      { userId, organizationId, timeRange }: { userId: string; organizationId: string; timeRange?: string }
    ) => {
      const { startDate, endDate } = getDateRange(timeRange);

      // Get user's team membership for this org
      const membership = await prisma.teamMember.findFirst({
        where: {
          userId,
          team: { organizationId },
        },
        include: { team: true },
      });

      if (!membership) {
        return {
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
      }

      // Get check-ins for the period
      const checkIns = await prisma.checkIn.findMany({
        where: {
          userId,
          event: { organizationId },
          createdAt: { gte: startDate, lte: endDate },
        },
      });

      const hoursLogged = checkIns.reduce((sum, c) => sum + (c.hoursLogged || 0), 0);
      const hoursRequired = membership.hoursRequired;
      const attendancePercent = hoursRequired > 0 ? (hoursLogged / hoursRequired) * 100 : 0;

      // Calculate team rank (simplified)
      const teamMembers = await prisma.teamMember.findMany({
        where: { teamId: membership.teamId },
      });

      // Calculate org rank (simplified)
      const orgMembers = await prisma.teamMember.findMany({
        where: { team: { organizationId } },
      });

      return {
        hoursLogged,
        hoursRequired,
        attendancePercent: Math.min(100, attendancePercent),
        teamRank: 1, // Simplified - would need full calculation
        teamSize: teamMembers.length,
        orgRank: 1, // Simplified - would need full calculation
        orgSize: orgMembers.length,
        currentStreak: 0, // Would need streak calculation
        bestStreak: 0, // Would need streak calculation
      };
    },

    teamLeaderboard: async (
      _: unknown,
      { teamId, timeRange, limit }: { teamId: string; timeRange?: string; limit?: number }
    ) => {
      const { startDate, endDate } = getDateRange(timeRange);

      const members = await prisma.teamMember.findMany({
        where: { teamId },
        include: {
          user: true,
          team: true,
        },
      });

      const leaderboard = await Promise.all(
        members.map(async (member) => {
          const checkIns = await prisma.checkIn.findMany({
            where: {
              userId: member.userId,
              event: { teamId },
              createdAt: { gte: startDate, lte: endDate },
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
      const { startDate, endDate } = getDateRange(timeRange);

      const members = await prisma.teamMember.findMany({
        where: { team: { organizationId } },
        include: {
          user: true,
          team: true,
        },
      });

      // Deduplicate users (they might be in multiple teams)
      const uniqueUsers = [...new Map(members.map((m) => [m.userId, m])).values()];

      const leaderboard = await Promise.all(
        uniqueUsers.map(async (member) => {
          const checkIns = await prisma.checkIn.findMany({
            where: {
              userId: member.userId,
              event: { organizationId },
              createdAt: { gte: startDate, lte: endDate },
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
      const teams = await prisma.team.findMany({
        where: { organizationId },
        include: { members: true },
      });

      const { startDate, endDate } = getDateRange(timeRange);

      const rankings = await Promise.all(
        teams.map(async (team) => {
          const checkIns = await prisma.checkIn.findMany({
            where: {
              event: { teamId: team.id },
              createdAt: { gte: startDate, lte: endDate },
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

    recentActivity: async (_: unknown, { organizationId, limit }: { organizationId: string; limit?: number }) => {
      const checkIns = await prisma.checkIn.findMany({
        where: { event: { organizationId } },
        orderBy: { createdAt: "desc" },
        take: limit || 20,
        include: { user: true },
      });

      return checkIns.map((checkIn) => ({
        id: checkIn.id,
        user: checkIn.user,
        type: checkIn.checkOutTime ? "check-out" : "check-in",
        time: (checkIn.checkOutTime || checkIn.checkInTime)?.toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
        }) || "",
        date: checkIn.createdAt.toISOString(),
      }));
    },
  },

  Mutation: {
    // User mutations
    createUser: async (_: unknown, { input }: { input: { email: string; firstName: string; lastName: string; phone?: string; address?: string; city?: string; country?: string; image?: string } }) => {
      return prisma.user.create({ data: input });
    },

    updateUser: async (_: unknown, { id, input }: { id: string; input: { firstName?: string; lastName?: string; phone?: string; address?: string; city?: string; country?: string; image?: string } }) => {
      return prisma.user.update({ where: { id }, data: input });
    },

    deleteUser: async (_: unknown, { id }: { id: string }) => {
      await prisma.user.delete({ where: { id } });
      return true;
    },

    // Organization mutations
    createOrganization: async (_: unknown, { input }: { input: { name: string; image?: string } }) => {
      return prisma.organization.create({ data: input });
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

    // Team mutations
    createTeam: async (_: unknown, { input }: { input: { name: string; organizationId: string } }) => {
      return prisma.team.create({ data: input });
    },

    updateTeam: async (_: unknown, { id, name }: { id: string; name?: string }) => {
      return prisma.team.update({ where: { id }, data: { name } });
    },

    deleteTeam: async (_: unknown, { id }: { id: string }) => {
      await prisma.team.delete({ where: { id } });
      return true;
    },

    addTeamMember: async (
      _: unknown,
      { input }: { input: { userId: string; teamId: string; role?: TeamRole; hoursRequired?: number } }
    ) => {
      return prisma.teamMember.create({
        data: {
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
          startTime: string;
          endTime: string;
          location?: string;
          description?: string;
          organizationId: string;
          teamId?: string;
        };
      }
    ) => {
      return prisma.event.create({
        data: {
          ...input,
          date: new Date(input.date),
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
        startTime,
        endTime,
        location,
        description,
      }: {
        id: string;
        title?: string;
        type?: EventType;
        date?: string;
        startTime?: string;
        endTime?: string;
        location?: string;
        description?: string;
      }
    ) => {
      return prisma.event.update({
        where: { id },
        data: {
          ...(title && { title }),
          ...(type && { type }),
          ...(date && { date: new Date(date) }),
          ...(startTime && { startTime }),
          ...(endTime && { endTime }),
          ...(location !== undefined && { location }),
          ...(description !== undefined && { description }),
        },
      });
    },

    deleteEvent: async (_: unknown, { id }: { id: string }) => {
      await prisma.event.delete({ where: { id } });
      return true;
    },

    // Check-in mutations
    checkIn: async (_: unknown, { input }: { input: { userId: string; eventId: string } }) => {
      const event = await prisma.event.findUnique({ where: { id: input.eventId } });
      if (!event) throw new Error("Event not found");

      const now = new Date();
      const eventStart = new Date(event.date);
      const [hours, minutes] = event.startTime.split(":").map(Number);
      eventStart.setHours(hours, minutes);

      // Determine if on time or late (15 minute grace period)
      const gracePeriod = 15 * 60 * 1000; // 15 minutes
      const status: AttendanceStatus = now.getTime() <= eventStart.getTime() + gracePeriod ? "ON_TIME" : "LATE";

      return prisma.checkIn.create({
        data: {
          userId: input.userId,
          eventId: input.eventId,
          status,
          checkInTime: now,
        },
      });
    },

    checkOut: async (_: unknown, { input }: { input: { checkInId: string } }) => {
      const checkIn = await prisma.checkIn.findUnique({
        where: { id: input.checkInId },
      });
      if (!checkIn) throw new Error("Check-in not found");
      if (!checkIn.checkInTime) throw new Error("No check-in time recorded");

      const now = new Date();
      const hoursLogged = (now.getTime() - checkIn.checkInTime.getTime()) / (1000 * 60 * 60);

      return prisma.checkIn.update({
        where: { id: input.checkInId },
        data: {
          checkOutTime: now,
          hoursLogged: Math.round(hoursLogged * 100) / 100, // Round to 2 decimal places
        },
      });
    },

    markAbsent: async (_: unknown, { userId, eventId }: { userId: string; eventId: string }) => {
      return prisma.checkIn.upsert({
        where: { userId_eventId: { userId, eventId } },
        create: {
          userId,
          eventId,
          status: "ABSENT",
        },
        update: {
          status: "ABSENT",
        },
      });
    },

    // Excuse mutations
    createExcuseRequest: async (
      _: unknown,
      { input }: { input: { userId: string; eventId: string; reason: string } }
    ) => {
      return prisma.excuseRequest.create({ data: input });
    },

    updateExcuseRequest: async (
      _: unknown,
      { input }: { input: { id: string; status: ExcuseRequestStatus } }
    ) => {
      const updated = await prisma.excuseRequest.update({
        where: { id: input.id },
        data: { status: input.status },
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
          },
          update: {
            status: "EXCUSED",
          },
        });
      }

      return updated;
    },

    cancelExcuseRequest: async (_: unknown, { id }: { id: string }) => {
      await prisma.excuseRequest.delete({ where: { id } });
      return true;
    },
  },

  // Field resolvers
  User: {
    memberships: (parent: { id: string }) => prisma.teamMember.findMany({ where: { userId: parent.id } }),
    checkIns: (parent: { id: string }) => prisma.checkIn.findMany({ where: { userId: parent.id } }),
  },

  Organization: {
    teams: (parent: { id: string }) => prisma.team.findMany({ where: { organizationId: parent.id } }),
    events: (parent: { id: string }) => prisma.event.findMany({ where: { organizationId: parent.id } }),
    memberCount: async (parent: { id: string }) => {
      const count = await prisma.teamMember.count({
        where: { team: { organizationId: parent.id } },
      });
      return count;
    },
  },

  Team: {
    organization: (parent: { organizationId: string }) =>
      prisma.organization.findUnique({ where: { id: parent.organizationId } }),
    members: (parent: { id: string }) => prisma.teamMember.findMany({ where: { teamId: parent.id } }),
    events: (parent: { id: string }) => prisma.event.findMany({ where: { teamId: parent.id } }),
    memberCount: (parent: { id: string }) => prisma.teamMember.count({ where: { teamId: parent.id } }),
    attendancePercent: async (parent: { id: string }, { timeRange }: { timeRange?: string }) => {
      const { startDate, endDate } = getDateRange(timeRange);
      const members = await prisma.teamMember.findMany({ where: { teamId: parent.id } });
      const checkIns = await prisma.checkIn.findMany({
        where: {
          event: { teamId: parent.id },
          createdAt: { gte: startDate, lte: endDate },
        },
      });
      const totalHoursLogged = checkIns.reduce((sum, c) => sum + (c.hoursLogged || 0), 0);
      const totalHoursRequired = members.reduce((sum, m) => sum + m.hoursRequired, 0);
      return totalHoursRequired > 0 ? Math.min(100, (totalHoursLogged / totalHoursRequired) * 100) : 0;
    },
  },

  TeamMember: {
    user: (parent: { userId: string }) => prisma.user.findUnique({ where: { id: parent.userId } }),
    team: (parent: { teamId: string }) => prisma.team.findUnique({ where: { id: parent.teamId } }),
    hoursLogged: async (parent: { userId: string; teamId: string }, { timeRange }: { timeRange?: string }) => {
      const { startDate, endDate } = getDateRange(timeRange);
      const checkIns = await prisma.checkIn.findMany({
        where: {
          userId: parent.userId,
          event: { teamId: parent.teamId },
          createdAt: { gte: startDate, lte: endDate },
        },
      });
      return checkIns.reduce((sum, c) => sum + (c.hoursLogged || 0), 0);
    },
    attendancePercent: async (
      parent: { userId: string; teamId: string; hoursRequired: number },
      { timeRange }: { timeRange?: string }
    ) => {
      const { startDate, endDate } = getDateRange(timeRange);
      const checkIns = await prisma.checkIn.findMany({
        where: {
          userId: parent.userId,
          event: { teamId: parent.teamId },
          createdAt: { gte: startDate, lte: endDate },
        },
      });
      const hoursLogged = checkIns.reduce((sum, c) => sum + (c.hoursLogged || 0), 0);
      return parent.hoursRequired > 0 ? Math.min(100, (hoursLogged / parent.hoursRequired) * 100) : 0;
    },
  },

  Event: {
    organization: (parent: { organizationId: string }) =>
      prisma.organization.findUnique({ where: { id: parent.organizationId } }),
    team: (parent: { teamId: string | null }) =>
      parent.teamId ? prisma.team.findUnique({ where: { id: parent.teamId } }) : null,
    checkIns: (parent: { id: string }) => prisma.checkIn.findMany({ where: { eventId: parent.id } }),
  },

  CheckIn: {
    user: (parent: { userId: string }) => prisma.user.findUnique({ where: { id: parent.userId } }),
    event: (parent: { eventId: string }) => prisma.event.findUnique({ where: { id: parent.eventId } }),
  },

  ExcuseRequest: {
    user: (parent: { userId: string }) => prisma.user.findUnique({ where: { id: parent.userId } }),
    event: (parent: { eventId: string }) => prisma.event.findUnique({ where: { id: parent.eventId } }),
  },
};
