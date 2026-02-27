import { prisma } from "../../db.js";
import { TeamRole } from "@prisma/client";
import { sendInviteEmail } from "../../email.js";
import { sendPushToEndpoint } from "../../notifications/sns.js";
import { toISO } from "../../utils/time.js";
import type { Loaders } from "../../utils/dataLoaders.js";

interface Context {
  userId?: string;
  loaders: Loaders;
}

export const guardianResolvers = {
  Query: {
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
  },

  Mutation: {
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
  },

  GuardianLink: {
    guardian: (parent: { guardianId: string }, _: unknown, context: Context) =>
      context.loaders.user.load(parent.guardianId),
    athlete: (parent: { athleteId: string }, _: unknown, context: Context) =>
      context.loaders.user.load(parent.athleteId),
    organization: (parent: { organizationId: string }, _: unknown, context: Context) =>
      context.loaders.organization.load(parent.organizationId),
    createdAt: (parent: any) => toISO(parent.createdAt),
  },
};
