import { describe, it, expect } from "vitest";
import { parseTimeString } from "../time.js";

describe("parseTimeString", () => {
  // 12-hour AM/PM format
  it("parses 12-hour PM time correctly", () => {
    expect(parseTimeString("6:00 PM")).toEqual({ hours: 18, minutes: 0 });
  });

  it("parses 12-hour AM time correctly", () => {
    expect(parseTimeString("6:00 AM")).toEqual({ hours: 6, minutes: 0 });
  });

  it("parses 12:00 PM as noon (12)", () => {
    expect(parseTimeString("12:00 PM")).toEqual({ hours: 12, minutes: 0 });
  });

  it("parses 12:00 AM as midnight (0)", () => {
    expect(parseTimeString("12:00 AM")).toEqual({ hours: 0, minutes: 0 });
  });

  it("parses minutes correctly", () => {
    expect(parseTimeString("1:30 AM")).toEqual({ hours: 1, minutes: 30 });
    expect(parseTimeString("11:45 PM")).toEqual({ hours: 23, minutes: 45 });
    expect(parseTimeString("3:15 PM")).toEqual({ hours: 15, minutes: 15 });
  });

  it("is case-insensitive for AM/PM", () => {
    expect(parseTimeString("6:00 pm")).toEqual({ hours: 18, minutes: 0 });
    expect(parseTimeString("6:00 am")).toEqual({ hours: 6, minutes: 0 });
  });

  // 24-hour format fallback
  it("parses 24-hour format correctly", () => {
    expect(parseTimeString("14:00")).toEqual({ hours: 14, minutes: 0 });
    expect(parseTimeString("0:00")).toEqual({ hours: 0, minutes: 0 });
    expect(parseTimeString("23:59")).toEqual({ hours: 23, minutes: 59 });
  });

  it("parses edge-case 9 PM correctly", () => {
    expect(parseTimeString("9:00 PM")).toEqual({ hours: 21, minutes: 0 });
  });

  it("parses edge-case single-digit hour", () => {
    expect(parseTimeString("1:00 PM")).toEqual({ hours: 13, minutes: 0 });
  });
});
