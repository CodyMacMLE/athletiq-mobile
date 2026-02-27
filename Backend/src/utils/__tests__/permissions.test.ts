import { describe, it, expect, vi, beforeEach } from "vitest";
import { GraphQLError } from "graphql";

// Mock the prisma client before importing permissions
vi.mock("../../db.js", () => ({
  prisma: {
    organizationMember: {
      findUnique: vi.fn(),
    },
  },
}));

import { requireAuth, requireOrgRole, requireOrgAdmin, requireOrgOwner, requireCoachOrAbove } from "../permissions.js";
import { prisma } from "../../db.js";

const mockFindUnique = vi.mocked(prisma.organizationMember.findUnique);

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// requireAuth
// ---------------------------------------------------------------------------
describe("requireAuth", () => {
  it("returns the userId when present", () => {
    const ctx = { userId: "user-123" };
    expect(requireAuth(ctx)).toBe("user-123");
  });

  it("throws UNAUTHENTICATED when userId is missing", () => {
    const ctx = {};
    expect(() => requireAuth(ctx)).toThrowError(
      expect.objectContaining({
        extensions: expect.objectContaining({ code: "UNAUTHENTICATED" }),
      })
    );
  });

  it("throws UNAUTHENTICATED when userId is undefined", () => {
    const ctx = { userId: undefined };
    expect(() => requireAuth(ctx)).toThrow(GraphQLError);
  });
});

// ---------------------------------------------------------------------------
// requireOrgRole
// ---------------------------------------------------------------------------
describe("requireOrgRole", () => {
  it("returns the userId when the member has an allowed role", async () => {
    mockFindUnique.mockResolvedValue({ role: "ADMIN" } as any);
    const result = await requireOrgRole({ userId: "user-1" }, "org-1", ["OWNER", "ADMIN"] as any[]);
    expect(result).toBe("user-1");
  });

  it("throws FORBIDDEN when the member has a non-allowed role", async () => {
    mockFindUnique.mockResolvedValue({ role: "ATHLETE" } as any);
    await expect(
      requireOrgRole({ userId: "user-1" }, "org-1", ["OWNER", "ADMIN"] as any[])
    ).rejects.toThrow(
      expect.objectContaining({ extensions: expect.objectContaining({ code: "FORBIDDEN" }) })
    );
  });

  it("throws FORBIDDEN when the member is not found", async () => {
    mockFindUnique.mockResolvedValue(null);
    await expect(
      requireOrgRole({ userId: "user-1" }, "org-1", ["OWNER"] as any[])
    ).rejects.toThrow(
      expect.objectContaining({ extensions: expect.objectContaining({ code: "FORBIDDEN" }) })
    );
  });

  it("throws UNAUTHENTICATED when no userId in context", async () => {
    await expect(
      requireOrgRole({}, "org-1", ["OWNER"] as any[])
    ).rejects.toThrow(
      expect.objectContaining({ extensions: expect.objectContaining({ code: "UNAUTHENTICATED" }) })
    );
    // Should not hit the DB if unauthenticated
    expect(mockFindUnique).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// requireOrgAdmin (OWNER | ADMIN)
// ---------------------------------------------------------------------------
describe("requireOrgAdmin", () => {
  it("passes for OWNER role", async () => {
    mockFindUnique.mockResolvedValue({ role: "OWNER" } as any);
    await expect(requireOrgAdmin({ userId: "u1" }, "org-1")).resolves.toBe("u1");
  });

  it("passes for ADMIN role", async () => {
    mockFindUnique.mockResolvedValue({ role: "ADMIN" } as any);
    await expect(requireOrgAdmin({ userId: "u1" }, "org-1")).resolves.toBe("u1");
  });

  it("blocks COACH role", async () => {
    mockFindUnique.mockResolvedValue({ role: "COACH" } as any);
    await expect(requireOrgAdmin({ userId: "u1" }, "org-1")).rejects.toThrow(GraphQLError);
  });

  it("blocks ATHLETE role", async () => {
    mockFindUnique.mockResolvedValue({ role: "ATHLETE" } as any);
    await expect(requireOrgAdmin({ userId: "u1" }, "org-1")).rejects.toThrow(GraphQLError);
  });
});

// ---------------------------------------------------------------------------
// requireOrgOwner (OWNER only)
// ---------------------------------------------------------------------------
describe("requireOrgOwner", () => {
  it("passes for OWNER role", async () => {
    mockFindUnique.mockResolvedValue({ role: "OWNER" } as any);
    await expect(requireOrgOwner({ userId: "u1" }, "org-1")).resolves.toBe("u1");
  });

  it("blocks ADMIN role", async () => {
    mockFindUnique.mockResolvedValue({ role: "ADMIN" } as any);
    await expect(requireOrgOwner({ userId: "u1" }, "org-1")).rejects.toThrow(GraphQLError);
  });
});

// ---------------------------------------------------------------------------
// requireCoachOrAbove (OWNER | ADMIN | MANAGER | COACH)
// ---------------------------------------------------------------------------
describe("requireCoachOrAbove", () => {
  it.each(["OWNER", "ADMIN", "MANAGER", "COACH"] as const)(
    "passes for %s role",
    async (role) => {
      mockFindUnique.mockResolvedValue({ role } as any);
      await expect(requireCoachOrAbove({ userId: "u1" }, "org-1")).resolves.toBe("u1");
    }
  );

  it("blocks ATHLETE role", async () => {
    mockFindUnique.mockResolvedValue({ role: "ATHLETE" } as any);
    await expect(requireCoachOrAbove({ userId: "u1" }, "org-1")).rejects.toThrow(GraphQLError);
  });

  it("blocks GUARDIAN role", async () => {
    mockFindUnique.mockResolvedValue({ role: "GUARDIAN" } as any);
    await expect(requireCoachOrAbove({ userId: "u1" }, "org-1")).rejects.toThrow(GraphQLError);
  });
});
