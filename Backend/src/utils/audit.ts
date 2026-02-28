import { Prisma } from "@prisma/client";
import { prisma } from "../db.js";

export type AuditAction =
  // Org management
  | "DELETE_ORGANIZATION"
  | "TRANSFER_OWNERSHIP"
  | "UPDATE_MEMBER_ROLE"
  | "REMOVE_MEMBER"
  // Teams
  | "DELETE_TEAM"
  | "RESTORE_TEAM"
  // Events
  | "DELETE_EVENT"
  | "DELETE_RECURRING_EVENT"
  // Members & athletes
  | "DELETE_USER_ACCOUNT"
  | "REMOVE_TEAM_MEMBER"
  // Check-ins
  | "DELETE_CHECKIN"
  | "ADMIN_CHECKIN"
  // Invites
  | "CANCEL_INVITE"
  // NFC
  | "DEACTIVATE_NFC_TAG"
  // Security
  | "SUSPICIOUS_ACTIVITY";

interface AuditParams {
  action: AuditAction;
  actorId?: string;
  targetId?: string;
  targetType?: string;
  organizationId?: string;
  metadata?: Prisma.InputJsonValue;
}

/**
 * Write an audit log entry. Failures are swallowed so they never
 * break the primary operation.
 */
export async function auditLog(params: AuditParams): Promise<void> {
  try {
    await prisma.auditLog.create({ data: params });
  } catch (err) {
    console.error("[audit] Failed to write log:", err);
  }
}
