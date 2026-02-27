import { prisma } from "../../db.js";
import { requireAuth, requireCoachOrAbove } from "../../utils/permissions.js";
import { toISO } from "../../utils/time.js";
import type { Loaders } from "../../utils/dataLoaders.js";

interface Context {
  userId?: string;
  loaders: Loaders;
}

export const gamificationResolvers = {
  Query: {
    teamChallenges: async (
      _: unknown,
      { teamId }: { teamId: string },
      context: { userId?: string }
    ) => {
      requireAuth(context);
      const challenges = await prisma.teamChallenge.findMany({
        where: { teamId },
        include: { creator: true, team: true },
        orderBy: { startDate: "desc" },
      });

      // Compute currentPercent for each challenge
      return Promise.all(
        challenges.map(async (challenge) => {
          const { startDate, endDate } = challenge;
          // Count events in range for this team
          const events = await prisma.event.findMany({
            where: {
              OR: [{ teamId }, { participatingTeams: { some: { id: teamId } } }],
              date: { gte: startDate, lte: endDate },
            },
            select: { id: true },
          });
          const eventIds = events.map((e) => e.id);
          const totalExpected = eventIds.length;
          const attended = await prisma.checkIn.count({
            where: { eventId: { in: eventIds }, status: { in: ["ON_TIME", "LATE"] } },
          });
          const totalCheckIns = await prisma.checkIn.count({
            where: { eventId: { in: eventIds } },
          });
          const currentPercent = totalCheckIns > 0 ? (attended / totalCheckIns) * 100 : 0;
          return { ...challenge, currentPercent };
        })
      );
    },

    teamRecognitions: async (
      _: unknown,
      { teamId, limit }: { teamId: string; limit?: number },
      context: { userId?: string }
    ) => {
      requireAuth(context);
      return prisma.athleteRecognition.findMany({
        where: { teamId },
        include: { user: true, team: true, nominator: true },
        orderBy: { createdAt: "desc" },
        take: limit || 20,
      });
    },

    recentRecognitions: async (
      _: unknown,
      { organizationId, limit }: { organizationId: string; limit?: number },
      context: { userId?: string }
    ) => {
      requireAuth(context);
      return prisma.athleteRecognition.findMany({
        where: { organizationId },
        include: { user: true, team: true, nominator: true },
        orderBy: { createdAt: "desc" },
        take: limit || 10,
      });
    },
  },

  Mutation: {
    createTeamChallenge: async (
      _: unknown,
      {
        teamId, organizationId, title, description, targetPercent, startDate, endDate,
      }: {
        teamId: string; organizationId: string; title: string; description?: string;
        targetPercent: number; startDate: string; endDate: string;
      },
      context: { userId?: string }
    ) => {
      await requireCoachOrAbove(context, organizationId);
      const createdBy = requireAuth(context);
      const challenge = await prisma.teamChallenge.create({
        data: {
          teamId, organizationId, title,
          ...(description !== undefined && { description }),
          targetPercent,
          startDate: new Date(startDate),
          endDate: new Date(endDate),
          createdBy,
        },
        include: { creator: true, team: true },
      });
      return { ...challenge, currentPercent: 0 };
    },

    deleteTeamChallenge: async (
      _: unknown,
      { id }: { id: string },
      context: { userId?: string }
    ) => {
      const challenge = await prisma.teamChallenge.findUnique({
        where: { id },
        select: { organizationId: true },
      });
      if (!challenge) return false;
      await requireCoachOrAbove(context, challenge.organizationId);
      await prisma.teamChallenge.delete({ where: { id } });
      return true;
    },

    createAthleteRecognition: async (
      _: unknown,
      {
        userId, teamId, organizationId, periodType, note,
      }: {
        userId: string; teamId: string; organizationId: string;
        periodType: string; note?: string;
      },
      context: { userId?: string }
    ) => {
      await requireCoachOrAbove(context, organizationId);
      const nominatedBy = requireAuth(context);

      // Build period key
      const now = new Date();
      let period: string;
      if (periodType === "WEEK") {
        const startOfYear = new Date(now.getFullYear(), 0, 1);
        const weekNum = Math.ceil(((now.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7);
        period = `${now.getFullYear()}-W${String(weekNum).padStart(2, "0")}`;
      } else {
        period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      }

      // Upsert — replace if same teamId+period already exists
      await prisma.athleteRecognition.deleteMany({ where: { teamId, period } });
      return prisma.athleteRecognition.create({
        data: {
          userId, teamId, organizationId, nominatedBy, period,
          periodType: periodType as any,
          ...(note !== undefined && { note }),
        },
        include: { user: true, team: true, nominator: true },
      });
    },

    deleteAthleteRecognition: async (
      _: unknown,
      { id }: { id: string },
      context: { userId?: string }
    ) => {
      const rec = await prisma.athleteRecognition.findUnique({
        where: { id },
        select: { organizationId: true },
      });
      if (!rec) return false;
      await requireCoachOrAbove(context, rec.organizationId);
      await prisma.athleteRecognition.delete({ where: { id } });
      return true;
    },
  },

  TeamChallenge: {
    createdBy: (parent: { createdBy: string }) =>
      prisma.user.findUnique({ where: { id: parent.createdBy } }),
    team: (parent: { teamId: string }, _: unknown, context: Context) =>
      context.loaders.team.load(parent.teamId),
    startDate: (parent: any) => toISO(parent.startDate),
    endDate: (parent: any) => toISO(parent.endDate),
    completedAt: (parent: any) => parent.completedAt ? toISO(parent.completedAt) : null,
    createdAt: (parent: any) => toISO(parent.createdAt),
    updatedAt: (parent: any) => toISO(parent.updatedAt),
  },

  AthleteRecognition: {
    user: (parent: { userId: string }, _: unknown, context: Context) =>
      context.loaders.user.load(parent.userId),
    team: (parent: { teamId: string }, _: unknown, context: Context) =>
      context.loaders.team.load(parent.teamId),
    nominatedBy: (parent: { nominatedBy: string }) =>
      prisma.user.findUnique({ where: { id: parent.nominatedBy } }),
    createdAt: (parent: any) => toISO(parent.createdAt),
  },
};
