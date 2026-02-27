import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../db.js", () => ({
  prisma: {
    auditLog: {
      create: vi.fn(),
    },
  },
}));

import { auditLog } from "../audit.js";
import { prisma } from "../../db.js";

const mockCreate = vi.mocked(prisma.auditLog.create);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("auditLog", () => {
  it("creates an audit log entry with the provided params", async () => {
    mockCreate.mockResolvedValue({} as any);

    await auditLog({
      action: "DELETE_ORGANIZATION",
      actorId: "user-1",
      targetId: "org-1",
      targetType: "Organization",
      organizationId: "org-1",
      metadata: { reason: "test" },
    });

    expect(mockCreate).toHaveBeenCalledWith({
      data: {
        action: "DELETE_ORGANIZATION",
        actorId: "user-1",
        targetId: "org-1",
        targetType: "Organization",
        organizationId: "org-1",
        metadata: { reason: "test" },
      },
    });
  });

  it("works with only required fields", async () => {
    mockCreate.mockResolvedValue({} as any);

    await auditLog({ action: "CANCEL_INVITE" });

    expect(mockCreate).toHaveBeenCalledWith({
      data: { action: "CANCEL_INVITE" },
    });
  });

  it("swallows prisma errors so the primary operation never fails", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockCreate.mockRejectedValue(new Error("DB connection lost"));

    // Should not throw
    await expect(auditLog({ action: "DELETE_TEAM" })).resolves.toBeUndefined();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "[audit] Failed to write log:",
      expect.any(Error)
    );

    consoleErrorSpy.mockRestore();
  });

  it("returns undefined on success (fire-and-forget)", async () => {
    mockCreate.mockResolvedValue({} as any);
    const result = await auditLog({ action: "REMOVE_MEMBER" });
    expect(result).toBeUndefined();
  });
});
