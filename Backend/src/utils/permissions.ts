import { GraphQLError } from "graphql";
import { OrgRole } from "@prisma/client";
import { prisma } from "../db.js";

export type OrgPermissionAction =
  | "canEditEvents"
  | "canApproveExcuses"
  | "canViewAnalytics"
  | "canManageMembers"
  | "canManageTeams"
  | "canManagePayments";

interface Context {
  userId?: string;
}

/** Throws UNAUTHENTICATED if no userId in context; returns the userId. */
export function requireAuth(context: Context): string {
  if (!context.userId) {
    throw new GraphQLError("Authentication required", {
      extensions: { code: "UNAUTHENTICATED" },
    });
  }
  return context.userId;
}

/** Throws FORBIDDEN if the caller doesn't have one of the allowed roles in the org. */
export async function requireOrgRole(
  context: Context,
  organizationId: string,
  allowedRoles: OrgRole[]
): Promise<string> {
  const userId = requireAuth(context);
  const member = await prisma.organizationMember.findUnique({
    where: { userId_organizationId: { userId, organizationId } },
    select: { role: true },
  });
  if (!member || !allowedRoles.includes(member.role)) {
    throw new GraphQLError("Insufficient permissions", {
      extensions: { code: "FORBIDDEN" },
    });
  }
  return userId;
}

/** Owner or Admin only. */
export async function requireOrgAdmin(
  context: Context,
  organizationId: string
): Promise<string> {
  return requireOrgRole(context, organizationId, [OrgRole.OWNER, OrgRole.ADMIN]);
}

/** Owner, Admin, Manager, or Coach. */
export async function requireCoachOrAbove(
  context: Context,
  organizationId: string
): Promise<string> {
  return requireOrgRole(context, organizationId, [
    OrgRole.OWNER,
    OrgRole.ADMIN,
    OrgRole.MANAGER,
    OrgRole.COACH,
  ]);
}

/** Owner only. */
export async function requireOrgOwner(
  context: Context,
  organizationId: string
): Promise<string> {
  return requireOrgRole(context, organizationId, [OrgRole.OWNER]);
}

/**
 * Returns true if the calling user has the given permission in the org.
 * Checks customRole first; falls back to built-in role defaults.
 */
export async function hasOrgPermission(
  context: Context,
  organizationId: string,
  action: OrgPermissionAction
): Promise<boolean> {
  const userId = requireAuth(context);
  const member = await prisma.organizationMember.findUnique({
    where: { userId_organizationId: { userId, organizationId } },
    select: {
      role: true,
      customRole: {
        select: {
          canEditEvents: true,
          canApproveExcuses: true,
          canViewAnalytics: true,
          canManageMembers: true,
          canManageTeams: true,
          canManagePayments: true,
        },
      },
    },
  });

  if (!member) return false;

  // If the member has a custom role, use its flags
  if (member.customRole) {
    return member.customRole[action];
  }

  // Fall back to built-in role defaults
  switch (member.role) {
    case OrgRole.OWNER:
    case OrgRole.ADMIN:
      return true;
    case OrgRole.MANAGER:
      return action !== "canManagePayments";
    case OrgRole.COACH:
      return action === "canEditEvents" || action === "canApproveExcuses" || action === "canViewAnalytics";
    default:
      // ATHLETE, GUARDIAN
      return action === "canViewAnalytics";
  }
}
