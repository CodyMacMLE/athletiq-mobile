/**
 * Integration tests for GraphQL Query resolvers.
 * Prisma and external services are fully mocked — no DB or network required.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock all external dependencies ─────────────────────────────────────────
vi.mock("../../db.js", () => ({
  prisma: {
    user: { findUnique: vi.fn(), findMany: vi.fn() },
    organization: { findUnique: vi.fn(), findMany: vi.fn() },
    organizationMember: { findMany: vi.fn(), findUnique: vi.fn() },
    teamMember: { findMany: vi.fn(), count: vi.fn() },
    team: { findMany: vi.fn(), findUnique: vi.fn() },
    event: { findMany: vi.fn() },
    checkIn: { findMany: vi.fn() },
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
const mockUserFindUnique = vi.mocked(prisma.user.findUnique);
const mockOrgFindUnique = vi.mocked(prisma.organization.findUnique);
const mockOrgMemberFindMany = vi.mocked(prisma.organizationMember.findMany);

/** Minimal loaders stub — queries tests don't exercise field resolvers */
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

// ─── me ──────────────────────────────────────────────────────────────────────
describe("Query.me", () => {
  it("returns the current user when authenticated", async () => {
    const user = { id: "user-1", email: "test@test.com", firstName: "Test", lastName: "User" };
    mockUserFindUnique.mockResolvedValue(user as any);

    const result = await resolvers.Query.me(null, null, makeContext("user-1"));

    expect(mockUserFindUnique).toHaveBeenCalledWith({ where: { id: "user-1" } });
    expect(result).toEqual(user);
  });

  it("returns null when unauthenticated", async () => {
    const result = await resolvers.Query.me(null, null, makeContext());
    expect(result).toBeNull();
    expect(mockUserFindUnique).not.toHaveBeenCalled();
  });
});

// ─── user ─────────────────────────────────────────────────────────────────────
describe("Query.user", () => {
  it("returns a user by ID", async () => {
    const user = { id: "user-42", email: "u@test.com" };
    mockUserFindUnique.mockResolvedValue(user as any);

    const result = await resolvers.Query.user(null, { id: "user-42" });

    expect(mockUserFindUnique).toHaveBeenCalledWith({ where: { id: "user-42" } });
    expect(result).toEqual(user);
  });

  it("returns null for a non-existent user", async () => {
    mockUserFindUnique.mockResolvedValue(null);
    const result = await resolvers.Query.user(null, { id: "ghost" });
    expect(result).toBeNull();
  });
});

// ─── organization ─────────────────────────────────────────────────────────────
describe("Query.organization", () => {
  it("returns an organization by ID", async () => {
    const org = { id: "org-1", name: "Test Org" };
    mockOrgFindUnique.mockResolvedValue(org as any);

    const result = await resolvers.Query.organization(null, { id: "org-1" });

    expect(mockOrgFindUnique).toHaveBeenCalledWith({ where: { id: "org-1" } });
    expect(result).toEqual(org);
  });
});

// ─── myOrganizations ──────────────────────────────────────────────────────────
describe("Query.myOrganizations", () => {
  it("returns organizations the user belongs to", async () => {
    const org = { id: "org-1", name: "My Org" };
    mockOrgMemberFindMany.mockResolvedValue([{ organization: org }] as any);

    const result = await resolvers.Query.myOrganizations(null, null, makeContext("user-1"));

    expect(mockOrgMemberFindMany).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      include: { organization: true },
    });
    expect(result).toEqual([org]);
  });

  it("returns an empty array when unauthenticated", async () => {
    const result = await resolvers.Query.myOrganizations(null, null, makeContext());
    expect(result).toEqual([]);
    expect(mockOrgMemberFindMany).not.toHaveBeenCalled();
  });
});
