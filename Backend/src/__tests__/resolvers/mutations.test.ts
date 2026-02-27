/**
 * Integration tests for GraphQL Mutation resolvers.
 * Prisma and external services are fully mocked — no DB or network required.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock all external dependencies ─────────────────────────────────────────
vi.mock("../../db.js", () => ({
  prisma: {
    user: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), upsert: vi.fn() },
    organization: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn(), delete: vi.fn() },
    organizationMember: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    team: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn(), delete: vi.fn() },
    teamMember: { findMany: vi.fn(), deleteMany: vi.fn() },
    checkIn: { deleteMany: vi.fn() },
    event: { findMany: vi.fn(), deleteMany: vi.fn() },
    auditLog: { create: vi.fn() },
  },
}));

vi.mock("../../email.js", () => ({ sendInviteEmail: vi.fn(), sendFeedbackEmail: vi.fn() }));
vi.mock("../../s3.js", () => ({ generateProfilePictureUploadUrl: vi.fn() }));
vi.mock("../../utils/time.js", () => ({ parseTimeString: vi.fn() }));
vi.mock("../../services/markAbsent.js", () => ({ markAbsentForEndedEvents: vi.fn() }));
vi.mock("../../notifications/sns.js", () => ({ registerPushToken: vi.fn(), sendPushToEndpoint: vi.fn() }));
vi.mock("../../notifications/pushNotifications.js", () => ({ sendPushNotification: vi.fn() }));
vi.mock("../../notifications/announcements.js", () => ({ broadcastAnnouncement: vi.fn() }));
vi.mock("../../notifications/emailReports.js", () => ({ generateGuardianReport: vi.fn() }));
vi.mock("../../notifications/emailNotifications.js", () => ({ sendExcuseStatusEmail: vi.fn() }));
vi.mock("@aws-sdk/client-cognito-identity-provider", () => ({
  CognitoIdentityProviderClient: class { send = vi.fn(); },
  AdminDeleteUserCommand: vi.fn(),
  ListUsersCommand: vi.fn(),
}));

import { resolvers } from "../../resolvers/index.js";
import { prisma } from "../../db.js";

// ─── Typed mocks ─────────────────────────────────────────────────────────────
const mockOrgCreate = vi.mocked(prisma.organization.create);
const mockOrgMemberCreate = vi.mocked(prisma.organizationMember.create);
const mockOrgMemberFindUnique = vi.mocked(prisma.organizationMember.findUnique);
const mockOrgFindUnique = vi.mocked(prisma.organization.findUnique);
const mockOrgDelete = vi.mocked(prisma.organization.delete);
const mockAuditCreate = vi.mocked(prisma.auditLog.create);
const mockUserUpdate = vi.mocked(prisma.user.update);

const makeContext = (userId?: string) => ({
  userId,
  loaders: {
    user: { load: vi.fn() },
    team: { load: vi.fn() },
    organization: { load: vi.fn() },
    venue: { load: vi.fn() },
    event: { load: vi.fn() },
  },
});

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── createOrganization ───────────────────────────────────────────────────────
describe("Mutation.createOrganization", () => {
  it("creates an org and makes the caller the OWNER", async () => {
    const org = { id: "org-new", name: "New Org" };
    mockOrgCreate.mockResolvedValue(org as any);
    mockOrgMemberCreate.mockResolvedValue({} as any);

    const result = await resolvers.Mutation.createOrganization(
      null,
      { input: { name: "New Org" } },
      makeContext("user-1")
    );

    expect(mockOrgCreate).toHaveBeenCalledWith({ data: { name: "New Org" } });
    expect(mockOrgMemberCreate).toHaveBeenCalledWith({
      data: { userId: "user-1", organizationId: "org-new", role: "OWNER" },
    });
    expect(result).toEqual(org);
  });

  it("throws when unauthenticated", async () => {
    await expect(
      resolvers.Mutation.createOrganization(null, { input: { name: "X" } }, makeContext())
    ).rejects.toThrow("Authentication required");

    expect(mockOrgCreate).not.toHaveBeenCalled();
  });
});

// ─── updateUser ──────────────────────────────────────────────────────────────
describe("Mutation.updateUser", () => {
  it("updates allowed user fields", async () => {
    const updated = { id: "u1", firstName: "Jane", lastName: "Doe" };
    mockUserUpdate.mockResolvedValue(updated as any);

    const result = await resolvers.Mutation.updateUser(
      null,
      { id: "u1", input: { firstName: "Jane", lastName: "Doe" } }
    );

    expect(mockUserUpdate).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: expect.objectContaining({ firstName: "Jane", lastName: "Doe" }),
    });
    expect(result).toEqual(updated);
  });

  it("strips non-digit characters from phone numbers", async () => {
    const updated = { id: "u1", phone: "6135550123" };
    mockUserUpdate.mockResolvedValue(updated as any);

    await resolvers.Mutation.updateUser(
      null,
      { id: "u1", input: { phone: "(613) 555-0123" } }
    );

    expect(mockUserUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ phone: "6135550123" }),
      })
    );
  });

  it("converts dateOfBirth string to a Date object", async () => {
    mockUserUpdate.mockResolvedValue({} as any);

    await resolvers.Mutation.updateUser(
      null,
      { id: "u1", input: { dateOfBirth: "1990-06-15" } }
    );

    const callArg = mockUserUpdate.mock.calls[0][0];
    expect(callArg.data.dateOfBirth).toBeInstanceOf(Date);
    expect((callArg.data.dateOfBirth as Date).getFullYear()).toBe(1990);
  });

  it("sets dateOfBirth to null when empty string provided", async () => {
    mockUserUpdate.mockResolvedValue({} as any);

    await resolvers.Mutation.updateUser(
      null,
      { id: "u1", input: { dateOfBirth: "" } }
    );

    const callArg = mockUserUpdate.mock.calls[0][0];
    expect(callArg.data.dateOfBirth).toBeNull();
  });
});

// ─── deleteOrganization ───────────────────────────────────────────────────────
describe("Mutation.deleteOrganization", () => {
  it("requires OWNER role — throws FORBIDDEN for ADMIN", async () => {
    mockOrgMemberFindUnique.mockResolvedValue({ role: "ADMIN" } as any);

    await expect(
      resolvers.Mutation.deleteOrganization(
        null,
        { id: "org-1" },
        makeContext("user-1")
      )
    ).rejects.toThrow(
      expect.objectContaining({ extensions: expect.objectContaining({ code: "FORBIDDEN" }) })
    );

    expect(mockOrgDelete).not.toHaveBeenCalled();
  });

  it("deletes the org and writes an audit log when caller is OWNER", async () => {
    mockOrgMemberFindUnique.mockResolvedValue({ role: "OWNER" } as any);
    mockOrgFindUnique.mockResolvedValue({ id: "org-1", name: "Old Org" } as any);
    mockOrgDelete.mockResolvedValue({ id: "org-1" } as any);
    mockAuditCreate.mockResolvedValue({} as any);

    const result = await resolvers.Mutation.deleteOrganization(
      null,
      { id: "org-1" },
      makeContext("owner-1")
    );

    expect(mockOrgDelete).toHaveBeenCalledWith({ where: { id: "org-1" } });
    expect(mockAuditCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "DELETE_ORGANIZATION",
          actorId: "owner-1",
          targetId: "org-1",
        }),
      })
    );
    expect(result).toBe(true);
  });

  it("throws UNAUTHENTICATED when no user in context", async () => {
    await expect(
      resolvers.Mutation.deleteOrganization(null, { id: "org-1" }, makeContext())
    ).rejects.toThrow(
      expect.objectContaining({ extensions: expect.objectContaining({ code: "UNAUTHENTICATED" }) })
    );
  });
});
