import { prisma } from "../db.js";
import { AttendanceStatus, EventType, ExcuseRequestStatus, InviteStatus, OrgRole, RecurrenceFrequency, TeamRole } from "@prisma/client";
import { sendInviteEmail } from "../email.js";

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
  const current = new Date(startDate);
  current.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);

  switch (frequency) {
    case "DAILY":
      while (current <= end) {
        dates.push(new Date(current));
        current.setDate(current.getDate() + 1);
      }
      break;

    case "WEEKLY":
      while (current <= end) {
        if (daysOfWeek.includes(current.getDay())) {
          dates.push(new Date(current));
        }
        current.setDate(current.getDate() + 1);
      }
      break;

    case "BIWEEKLY": {
      const weekStart = new Date(startDate);
      weekStart.setHours(0, 0, 0, 0);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      while (current <= end) {
        const daysSinceWeekStart = Math.floor(
          (current.getTime() - weekStart.getTime()) / (1000 * 60 * 60 * 24)
        );
        const weekNumber = Math.floor(daysSinceWeekStart / 7);
        if (weekNumber % 2 === 0 && daysOfWeek.includes(current.getDay())) {
          dates.push(new Date(current));
        }
        current.setDate(current.getDate() + 1);
      }
      break;
    }

    case "MONTHLY": {
      const dayOfMonth = startDate.getDate();
      const currentMonth = new Date(startDate);
      currentMonth.setHours(0, 0, 0, 0);
      while (currentMonth <= end) {
        const targetDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), dayOfMonth);
        if (targetDate >= startDate && targetDate <= end && targetDate.getDate() === dayOfMonth) {
          dates.push(targetDate);
        }
        currentMonth.setMonth(currentMonth.getMonth() + 1);
      }
      break;
    }
  }

  return dates;
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

    eventUncheckedAthletes: async (_: unknown, { eventId }: { eventId: string }) => {
      const event = await prisma.event.findUnique({
        where: { id: eventId },
        include: {
          participatingTeams: {
            include: { members: { include: { user: true } } },
          },
          team: {
            include: { members: { include: { user: true } } },
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

      // Return users not yet checked in
      return Array.from(userMap.values()).filter((u) => !checkedInIds.has(u.id));
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
      const { email, ...profileFields } = input;
      return prisma.user.upsert({
        where: { email },
        update: profileFields,
        create: input,
      });
    },

    updateUser: async (_: unknown, { id, input }: { id: string; input: { firstName?: string; lastName?: string; phone?: string; address?: string; city?: string; country?: string; image?: string } }) => {
      return prisma.user.update({ where: { id }, data: input });
    },

    deleteUser: async (_: unknown, { id }: { id: string }) => {
      await prisma.user.delete({ where: { id } });
      return true;
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

      // Non-owner callers cannot remove other admins (MANAGER) or themselves
      if (context.userId) {
        const callerMember = await prisma.organizationMember.findUnique({
          where: { userId_organizationId: { userId: context.userId, organizationId } },
        });
        if (callerMember && callerMember.role !== "OWNER") {
          if (targetMember.role === "MANAGER") {
            throw new Error("Only the owner can remove managers");
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

      // Remove user from all teams in this org, then remove org membership
      await prisma.$transaction([
        prisma.teamMember.deleteMany({
          where: { userId, teamId: { in: teamIds } },
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
          data: { role: "MANAGER" },
        }),
      ]);
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
          participatingTeamIds?: string[];
        };
      }
    ) => {
      const { participatingTeamIds, endDate, ...eventData } = input;
      return prisma.event.create({
        data: {
          ...eventData,
          date: new Date(input.date),
          ...(endDate && { endDate: new Date(endDate) }),
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
        };
      }
    ) => {
      const start = new Date(input.startDate);
      const end = new Date(input.endDate);

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
            recurringEventId: re.id,
          })),
        });

        return re;
      });

      return recurringEvent;
    },

    deleteRecurringEvent: async (_: unknown, { id }: { id: string }) => {
      await prisma.$transaction(async (tx) => {
        const eventIds = (
          await tx.event.findMany({
            where: { recurringEventId: id },
            select: { id: true },
          })
        ).map((e) => e.id);

        await tx.checkIn.deleteMany({ where: { eventId: { in: eventIds } } });
        await tx.excuseRequest.deleteMany({ where: { eventId: { in: eventIds } } });
        await tx.event.deleteMany({ where: { recurringEventId: id } });
        await tx.recurringEvent.delete({ where: { id } });
      });
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

    adminCheckIn: async (
      _: unknown,
      { input }: { input: { userId: string; eventId: string; status: AttendanceStatus; note?: string } }
    ) => {
      return prisma.checkIn.upsert({
        where: { userId_eventId: { userId: input.userId, eventId: input.eventId } },
        create: {
          userId: input.userId,
          eventId: input.eventId,
          status: input.status,
          checkInTime: input.status !== "EXCUSED" ? new Date() : null,
          note: input.note,
        },
        update: {
          status: input.status,
          checkInTime: input.status !== "EXCUSED" ? new Date() : null,
          note: input.note,
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

        // Add to teams
        for (const teamId of invite.teamIds) {
          await tx.teamMember.upsert({
            where: { userId_teamId: { userId: context.userId!, teamId } },
            update: {},
            create: {
              userId: context.userId!,
              teamId,
              role: "MEMBER",
            },
          });
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
    organizationMemberships: (parent: { id: string }) =>
      prisma.organizationMember.findMany({ where: { userId: parent.id } }),
    checkIns: (parent: { id: string }) => prisma.checkIn.findMany({ where: { userId: parent.id } }),
  },

  Organization: {
    teams: (parent: { id: string }) => prisma.team.findMany({ where: { organizationId: parent.id } }),
    events: (parent: { id: string }) => prisma.event.findMany({ where: { organizationId: parent.id } }),
    members: (parent: { id: string }) =>
      prisma.organizationMember.findMany({ where: { organizationId: parent.id } }),
    invites: (parent: { id: string }) =>
      prisma.invite.findMany({ where: { organizationId: parent.id, status: "PENDING" } }),
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
    events: (parent: { id: string }) =>
      prisma.event.findMany({
        where: {
          OR: [
            { teamId: parent.id },
            { participatingTeams: { some: { id: parent.id } } },
          ],
        },
        orderBy: { date: "asc" },
      }),
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
    recurringEvent: (parent: { recurringEventId: string | null }) =>
      parent.recurringEventId
        ? prisma.recurringEvent.findUnique({ where: { id: parent.recurringEventId } })
        : null,
    participatingTeams: (parent: { id: string }) =>
      prisma.team.findMany({
        where: { participatingEvents: { some: { id: parent.id } } },
      }),
  },

  RecurringEvent: {
    organization: (parent: { organizationId: string }) =>
      prisma.organization.findUnique({ where: { id: parent.organizationId } }),
    team: (parent: { teamId: string | null }) =>
      parent.teamId ? prisma.team.findUnique({ where: { id: parent.teamId } }) : null,
    events: (parent: { id: string }) =>
      prisma.event.findMany({ where: { recurringEventId: parent.id }, orderBy: { date: "asc" } }),
  },

  CheckIn: {
    user: (parent: { userId: string }) => prisma.user.findUnique({ where: { id: parent.userId } }),
    event: (parent: { eventId: string }) => prisma.event.findUnique({ where: { id: parent.eventId } }),
  },

  ExcuseRequest: {
    user: (parent: { userId: string }) => prisma.user.findUnique({ where: { id: parent.userId } }),
    event: (parent: { eventId: string }) => prisma.event.findUnique({ where: { id: parent.eventId } }),
  },

  OrganizationMember: {
    user: (parent: { userId: string }) => prisma.user.findUnique({ where: { id: parent.userId } }),
    organization: (parent: { organizationId: string }) =>
      prisma.organization.findUnique({ where: { id: parent.organizationId } }),
  },

  Invite: {
    organization: (parent: { organizationId: string }) =>
      prisma.organization.findUnique({ where: { id: parent.organizationId } }),
  },
};
