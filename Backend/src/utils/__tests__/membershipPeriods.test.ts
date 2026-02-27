import { describe, it, expect } from "vitest";
import { eventDuringMembership } from "../membershipPeriods.js";

const d = (iso: string) => new Date(iso);

describe("eventDuringMembership", () => {
  const joinedSep = d("2025-09-01");
  const leftDec = d("2025-12-01");
  const rejoinedFeb = d("2026-02-01");

  // ── Single continuous membership ──────────────────────────────────────────

  it("includes an event after joinedAt (active, no leftAt)", () => {
    const periods = [{ joinedAt: joinedSep, leftAt: null }];
    expect(eventDuringMembership(d("2026-01-15"), periods)).toBe(true);
  });

  it("includes an event on the exact joinedAt date", () => {
    const periods = [{ joinedAt: joinedSep, leftAt: null }];
    expect(eventDuringMembership(joinedSep, periods)).toBe(true);
  });

  it("excludes an event before joinedAt", () => {
    const periods = [{ joinedAt: joinedSep, leftAt: null }];
    expect(eventDuringMembership(d("2025-08-15"), periods)).toBe(false);
  });

  // ── Closed membership period ───────────────────────────────────────────────

  it("includes an event within a closed period (between joined and left)", () => {
    const periods = [{ joinedAt: joinedSep, leftAt: leftDec }];
    expect(eventDuringMembership(d("2025-10-20"), periods)).toBe(true);
  });

  it("excludes an event after leftAt for a closed period", () => {
    const periods = [{ joinedAt: joinedSep, leftAt: leftDec }];
    expect(eventDuringMembership(d("2026-01-10"), periods)).toBe(false);
  });

  it("includes an event on the exact leftAt date (inclusive end)", () => {
    const periods = [{ joinedAt: joinedSep, leftAt: leftDec }];
    expect(eventDuringMembership(leftDec, periods)).toBe(true);
  });

  // ── Multiple join/leave cycles ─────────────────────────────────────────────

  const multiPeriods = [
    { joinedAt: joinedSep, leftAt: leftDec },   // Sep–Dec
    { joinedAt: rejoinedFeb, leftAt: null },     // Feb–present
  ];

  it("includes event in first active period", () => {
    expect(eventDuringMembership(d("2025-10-01"), multiPeriods)).toBe(true);
  });

  it("excludes event in the gap between periods (Dec–Feb)", () => {
    expect(eventDuringMembership(d("2026-01-15"), multiPeriods)).toBe(false);
  });

  it("includes event in second active period after rejoin", () => {
    expect(eventDuringMembership(d("2026-02-20"), multiPeriods)).toBe(true);
  });

  it("excludes event before the first join", () => {
    expect(eventDuringMembership(d("2025-08-01"), multiPeriods)).toBe(false);
  });

  // ── Edge cases ─────────────────────────────────────────────────────────────

  it("returns false when periods array is empty", () => {
    expect(eventDuringMembership(d("2026-01-01"), [])).toBe(false);
  });
});
