import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../db.js", () => ({
  prisma: {
    user: { findMany: vi.fn() },
    team: { findMany: vi.fn() },
    organization: { findMany: vi.fn() },
    venue: { findMany: vi.fn() },
    event: { findMany: vi.fn() },
  },
}));

import { createLoaders } from "../dataLoaders.js";
import { prisma } from "../../db.js";

const mockUserFindMany = vi.mocked(prisma.user.findMany);
const mockTeamFindMany = vi.mocked(prisma.team.findMany);
const mockOrgFindMany = vi.mocked(prisma.organization.findMany);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createLoaders", () => {
  it("creates a fresh set of loaders each call", () => {
    const a = createLoaders();
    const b = createLoaders();
    expect(a).not.toBe(b);
  });

  it("exposes user, team, organization, venue, event loaders", () => {
    const loaders = createLoaders();
    expect(typeof loaders.user.load).toBe("function");
    expect(typeof loaders.team.load).toBe("function");
    expect(typeof loaders.organization.load).toBe("function");
    expect(typeof loaders.venue.load).toBe("function");
    expect(typeof loaders.event.load).toBe("function");
  });
});

describe("user loader", () => {
  it("batches multiple loads into a single DB query", async () => {
    const users = [
      { id: "u1", email: "a@test.com" },
      { id: "u2", email: "b@test.com" },
    ];
    mockUserFindMany.mockResolvedValue(users as any);

    const loaders = createLoaders();
    const [u1, u2] = await Promise.all([
      loaders.user.load("u1"),
      loaders.user.load("u2"),
    ]);

    expect(mockUserFindMany).toHaveBeenCalledTimes(1);
    expect(mockUserFindMany).toHaveBeenCalledWith({
      where: { id: { in: expect.arrayContaining(["u1", "u2"]) } },
    });
    expect(u1).toEqual(users[0]);
    expect(u2).toEqual(users[1]);
  });

  it("returns null for IDs that don't exist in the DB", async () => {
    mockUserFindMany.mockResolvedValue([{ id: "u1", email: "a@test.com" }] as any);

    const loaders = createLoaders();
    const result = await loaders.user.load("missing-id");
    expect(result).toBeNull();
  });

  it("caches: repeated loads of the same ID hit DB only once", async () => {
    mockUserFindMany.mockResolvedValue([{ id: "u1", email: "a@test.com" }] as any);

    const loaders = createLoaders();
    await loaders.user.load("u1");
    await loaders.user.load("u1"); // cache hit

    expect(mockUserFindMany).toHaveBeenCalledTimes(1);
  });
});

describe("team loader", () => {
  it("includes orgSeason in the batch query", async () => {
    mockTeamFindMany.mockResolvedValue([{ id: "t1", name: "Team A" }] as any);

    const loaders = createLoaders();
    await loaders.team.load("t1");

    expect(mockTeamFindMany).toHaveBeenCalledWith({
      where: { id: { in: ["t1"] } },
      include: { orgSeason: true },
    });
  });
});

describe("organization loader", () => {
  it("batches org loads into a single query", async () => {
    const orgs = [
      { id: "org-1", name: "Org A" },
      { id: "org-2", name: "Org B" },
    ];
    mockOrgFindMany.mockResolvedValue(orgs as any);

    const loaders = createLoaders();
    const [o1, o2] = await Promise.all([
      loaders.organization.load("org-1"),
      loaders.organization.load("org-2"),
    ]);

    expect(mockOrgFindMany).toHaveBeenCalledTimes(1);
    expect(o1).toEqual(orgs[0]);
    expect(o2).toEqual(orgs[1]);
  });
});
