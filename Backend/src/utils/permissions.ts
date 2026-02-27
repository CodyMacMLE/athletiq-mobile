import { GraphQLError } from "graphql";
import { OrgRole } from "@prisma/client";
import { prisma } from "../db.js";

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
