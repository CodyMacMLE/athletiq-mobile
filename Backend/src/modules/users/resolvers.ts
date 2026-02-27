import { prisma } from "../../db.js";
import { CognitoIdentityProviderClient, AdminDeleteUserCommand, ListUsersCommand } from "@aws-sdk/client-cognito-identity-provider";
import { toISO, sanitizePhone } from "../../utils/time.js";
import type { Loaders } from "../../utils/dataLoaders.js";

interface Context {
  userId?: string;
  cognitoUsername?: string;
  loaders: Loaders;
}

const cognitoClient = new CognitoIdentityProviderClient({
  region: process.env.AWS_REGION || "us-east-2",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
  },
});
const COGNITO_USER_POOL_ID = process.env.COGNITO_USER_POOL_ID || "us-east-2_jHLnfwOqy";

export const userResolvers = {
  Query: {
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
  },

  Mutation: {
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
  },

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
};
