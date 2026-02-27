import { prisma } from "../../db.js";
import { toISO, sanitizePhone } from "../../utils/time.js";
import type { Loaders } from "../../utils/dataLoaders.js";

interface Context {
  userId?: string;
  loaders: Loaders;
}

export const healthResolvers = {
  Query: {
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
  },

  Mutation: {
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
  },

  EmergencyContact: {
    createdAt: (parent: any) => toISO(parent.createdAt),
    updatedAt: (parent: any) => toISO(parent.updatedAt),
  },

  MedicalInfo: {
    updatedAt: (parent: any) => toISO(parent.updatedAt),
  },

  AthleteStatusRecord: {
    changedByUser: (parent: { changedByUserId: string }, _: unknown, context: Context) =>
      context.loaders.user.load(parent.changedByUserId),
    createdAt: (parent: any) => toISO(parent.createdAt),
  },

  GymnasticsProfile: {
    updatedAt: (parent: any) => toISO(parent.updatedAt),
  },
};
