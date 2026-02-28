import { describe, it, expect } from "vitest";
import {
  validate,
  createUserInputSchema,
  updateUserInputSchema,
  createEventInputSchema,
  createOrganizationInputSchema,
  createExcuseRequestInputSchema,
  createEmergencyContactInputSchema,
  upsertMedicalInfoInputSchema,
  createCustomRoleInputSchema,
  createTeamChallengeInputSchema,
} from "../validate.js";

// ─── validate() helper ────────────────────────────────────────────────────────

describe("validate()", () => {
  it("returns parsed data on success", () => {
    const result = validate(createOrganizationInputSchema, { name: "My Org" });
    expect(result).toEqual({ name: "My Org" });
  });

  it("throws a human-readable Error on failure", () => {
    expect(() => validate(createOrganizationInputSchema, { name: "" })).toThrow(
      /Validation error/
    );
  });
});

// ─── createUser ───────────────────────────────────────────────────────────────

describe("createUserInputSchema", () => {
  const valid = { email: "a@b.com", firstName: "Jane", lastName: "Doe" };

  it("accepts valid input", () => {
    expect(() => validate(createUserInputSchema, valid)).not.toThrow();
  });

  it("rejects invalid email", () => {
    expect(() => validate(createUserInputSchema, { ...valid, email: "notanemail" })).toThrow(
      /Validation error/
    );
  });

  it("rejects empty firstName", () => {
    expect(() => validate(createUserInputSchema, { ...valid, firstName: "" })).toThrow(
      /Validation error/
    );
  });

  it("rejects firstName over 100 chars", () => {
    expect(() =>
      validate(createUserInputSchema, { ...valid, firstName: "A".repeat(101) })
    ).toThrow(/Validation error/);
  });

  it("accepts optional fields as undefined", () => {
    expect(() => validate(createUserInputSchema, valid)).not.toThrow();
  });
});

// ─── updateUser ───────────────────────────────────────────────────────────────

describe("updateUserInputSchema", () => {
  it("accepts empty object (all fields optional)", () => {
    expect(() => validate(updateUserInputSchema, {})).not.toThrow();
  });

  it("rejects bio over 500 chars", () => {
    expect(() =>
      validate(updateUserInputSchema, { bio: "x".repeat(501) })
    ).toThrow(/Validation error/);
  });
});

// ─── createEvent ─────────────────────────────────────────────────────────────

describe("createEventInputSchema", () => {
  const valid = {
    title: "Morning Practice",
    date: "2025-09-01",
    startTime: "9:00 AM",
    endTime: "11:00 AM",
    type: "PRACTICE",
    organizationId: "org_1",
  };

  it("accepts valid input", () => {
    expect(() => validate(createEventInputSchema, valid)).not.toThrow();
  });

  it("rejects empty title", () => {
    expect(() => validate(createEventInputSchema, { ...valid, title: "" })).toThrow(
      /Validation error/
    );
  });

  it("rejects title over 200 chars", () => {
    expect(() =>
      validate(createEventInputSchema, { ...valid, title: "T".repeat(201) })
    ).toThrow(/Validation error/);
  });

  it("rejects invalid event type", () => {
    expect(() =>
      validate(createEventInputSchema, { ...valid, type: "INVALID_TYPE" })
    ).toThrow(/Validation error/);
  });
});

// ─── createOrganization ───────────────────────────────────────────────────────

describe("createOrganizationInputSchema", () => {
  it("accepts valid name", () => {
    expect(() => validate(createOrganizationInputSchema, { name: "Elite FC" })).not.toThrow();
  });

  it("rejects empty name", () => {
    expect(() => validate(createOrganizationInputSchema, { name: "" })).toThrow(/Validation error/);
  });

  it("rejects name over 100 chars", () => {
    expect(() =>
      validate(createOrganizationInputSchema, { name: "N".repeat(101) })
    ).toThrow(/Validation error/);
  });
});

// ─── createExcuseRequest ─────────────────────────────────────────────────────

describe("createExcuseRequestInputSchema", () => {
  it("accepts valid reason", () => {
    expect(() =>
      validate(createExcuseRequestInputSchema, { eventId: "evt_1", reason: "Sick" })
    ).not.toThrow();
  });

  it("rejects reason over 1000 chars", () => {
    expect(() =>
      validate(createExcuseRequestInputSchema, { eventId: "evt_1", reason: "x".repeat(1001) })
    ).toThrow(/Validation error/);
  });

  it("rejects empty reason", () => {
    expect(() =>
      validate(createExcuseRequestInputSchema, { eventId: "evt_1", reason: "" })
    ).toThrow(/Validation error/);
  });
});

// ─── createEmergencyContact ───────────────────────────────────────────────────

describe("createEmergencyContactInputSchema", () => {
  const valid = { name: "John Doe", relationship: "Parent", phone: "+1-555-000-0000" };

  it("accepts valid input", () => {
    expect(() => validate(createEmergencyContactInputSchema, valid)).not.toThrow();
  });

  it("rejects empty name", () => {
    expect(() =>
      validate(createEmergencyContactInputSchema, { ...valid, name: "" })
    ).toThrow(/Validation error/);
  });

  it("rejects email when present and invalid", () => {
    expect(() =>
      validate(createEmergencyContactInputSchema, { ...valid, email: "bademail" })
    ).toThrow(/Validation error/);
  });

  it("accepts valid optional email", () => {
    expect(() =>
      validate(createEmergencyContactInputSchema, { ...valid, email: "j@example.com" })
    ).not.toThrow();
  });
});

// ─── upsertMedicalInfo ────────────────────────────────────────────────────────

describe("upsertMedicalInfoInputSchema", () => {
  it("accepts empty object", () => {
    expect(() => validate(upsertMedicalInfoInputSchema, {})).not.toThrow();
  });

  it("rejects notes over 2000 chars", () => {
    expect(() =>
      validate(upsertMedicalInfoInputSchema, { notes: "x".repeat(2001) })
    ).toThrow(/Validation error/);
  });

  it("rejects conditions array items over 200 chars", () => {
    expect(() =>
      validate(upsertMedicalInfoInputSchema, { conditions: ["c".repeat(201)] })
    ).toThrow(/Validation error/);
  });
});

// ─── createCustomRole ─────────────────────────────────────────────────────────

describe("createCustomRoleInputSchema", () => {
  it("accepts valid input", () => {
    expect(() =>
      validate(createCustomRoleInputSchema, { name: "Video Coordinator" })
    ).not.toThrow();
  });

  it("rejects empty name", () => {
    expect(() => validate(createCustomRoleInputSchema, { name: "" })).toThrow(/Validation error/);
  });

  it("rejects description over 500 chars", () => {
    expect(() =>
      validate(createCustomRoleInputSchema, { name: "Role", description: "d".repeat(501) })
    ).toThrow(/Validation error/);
  });
});

// ─── createTeamChallenge ─────────────────────────────────────────────────────

describe("createTeamChallengeInputSchema", () => {
  const valid = {
    teamId: "team_1",
    organizationId: "org_1",
    title: "90% Attendance Week",
    targetPercent: 90,
    startDate: "2025-09-01",
    endDate: "2025-09-07",
  };

  it("accepts valid input", () => {
    expect(() => validate(createTeamChallengeInputSchema, valid)).not.toThrow();
  });

  it("rejects targetPercent below 0", () => {
    expect(() =>
      validate(createTeamChallengeInputSchema, { ...valid, targetPercent: -1 })
    ).toThrow(/Validation error/);
  });

  it("rejects targetPercent above 100", () => {
    expect(() =>
      validate(createTeamChallengeInputSchema, { ...valid, targetPercent: 101 })
    ).toThrow(/Validation error/);
  });

  it("rejects empty title", () => {
    expect(() =>
      validate(createTeamChallengeInputSchema, { ...valid, title: "" })
    ).toThrow(/Validation error/);
  });
});
