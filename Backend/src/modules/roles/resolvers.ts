import { prisma } from "../../db.js";
import { requireOrgAdmin } from "../../utils/permissions.js";

export const rolesResolvers = {
  Query: {
    customRoles: async (
      _: unknown,
      { organizationId }: { organizationId: string },
      context: { userId?: string }
    ) => {
      await requireOrgAdmin(context, organizationId);
      return prisma.customRole.findMany({ where: { organizationId }, orderBy: { name: "asc" } });
    },
  },

  Mutation: {
    createCustomRole: async (
      _: unknown,
      {
        organizationId, name, description,
        canEditEvents, canApproveExcuses, canViewAnalytics,
        canManageMembers, canManageTeams, canManagePayments,
      }: {
        organizationId: string; name: string; description?: string;
        canEditEvents?: boolean; canApproveExcuses?: boolean; canViewAnalytics?: boolean;
        canManageMembers?: boolean; canManageTeams?: boolean; canManagePayments?: boolean;
      },
      context: { userId?: string }
    ) => {
      await requireOrgAdmin(context, organizationId);
      return prisma.customRole.create({
        data: {
          organizationId, name,
          ...(description !== undefined && { description }),
          ...(canEditEvents !== undefined && { canEditEvents }),
          ...(canApproveExcuses !== undefined && { canApproveExcuses }),
          ...(canViewAnalytics !== undefined && { canViewAnalytics }),
          ...(canManageMembers !== undefined && { canManageMembers }),
          ...(canManageTeams !== undefined && { canManageTeams }),
          ...(canManagePayments !== undefined && { canManagePayments }),
        },
      });
    },

    updateCustomRole: async (
      _: unknown,
      {
        id, name, description,
        canEditEvents, canApproveExcuses, canViewAnalytics,
        canManageMembers, canManageTeams, canManagePayments,
      }: {
        id: string; name?: string; description?: string;
        canEditEvents?: boolean; canApproveExcuses?: boolean; canViewAnalytics?: boolean;
        canManageMembers?: boolean; canManageTeams?: boolean; canManagePayments?: boolean;
      },
      context: { userId?: string }
    ) => {
      const role = await prisma.customRole.findUnique({ where: { id }, select: { organizationId: true } });
      if (role) await requireOrgAdmin(context, role.organizationId);
      return prisma.customRole.update({
        where: { id },
        data: {
          ...(name !== undefined && { name }),
          ...(description !== undefined && { description }),
          ...(canEditEvents !== undefined && { canEditEvents }),
          ...(canApproveExcuses !== undefined && { canApproveExcuses }),
          ...(canViewAnalytics !== undefined && { canViewAnalytics }),
          ...(canManageMembers !== undefined && { canManageMembers }),
          ...(canManageTeams !== undefined && { canManageTeams }),
          ...(canManagePayments !== undefined && { canManagePayments }),
        },
      });
    },

    deleteCustomRole: async (
      _: unknown,
      { id }: { id: string },
      context: { userId?: string }
    ) => {
      const role = await prisma.customRole.findUnique({
        where: { id },
        select: { organizationId: true, _count: { select: { members: true } } },
      });
      if (!role) return false;
      await requireOrgAdmin(context, role.organizationId);
      if (role._count.members > 0) {
        throw new Error("Cannot delete a role that is assigned to members. Remove the role from all members first.");
      }
      await prisma.customRole.delete({ where: { id } });
      return true;
    },

    assignCustomRole: async (
      _: unknown,
      { memberId, customRoleId }: { memberId: string; customRoleId?: string | null },
      context: { userId?: string }
    ) => {
      const member = await prisma.organizationMember.findUnique({
        where: { id: memberId },
        select: { organizationId: true },
      });
      if (!member) throw new Error("Member not found");
      await requireOrgAdmin(context, member.organizationId);
      return prisma.organizationMember.update({
        where: { id: memberId },
        data: { customRoleId: customRoleId ?? null },
        include: { customRole: true },
      });
    },
  },
};
