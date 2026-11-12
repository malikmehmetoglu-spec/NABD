import { describe, expect, it } from "vitest";
import { addDays, ageFrom, dayRange, formatDayLong, formatTime, todayIn, zonedToUtc } from "./time";
import { formatMoney } from "./labels";

describe("clinic timezone", () => {
  it("converts local clinic time to UTC (Damascus is UTC+3)", () => {
    expect(zonedToUtc("2026-11-12", "10:30", "Asia/Damascus").toISOString()).toBe("2026-11-12T07:30:00.000Z");
  });

  it("handles DST zones (Berlin winter vs summer)", () => {
    expect(zonedToUtc("2026-01-15", "09:00", "Europe/Berlin").toISOString()).toBe("2026-01-15T08:00:00.000Z");
    expect(zonedToUtc("2026-07-15", "09:00", "Europe/Berlin").toISOString()).toBe("2026-07-15T07:00:00.000Z");
  });

  it("computes the clinic's day boundaries", () => {
    expect(dayRange("2026-11-12", "Asia/Damascus")).toEqual({
      start: "2026-11-11T21:00:00.000Z",
      end: "2026-11-12T21:00:00.000Z",
    });
  });

  it("knows 'today' in the clinic, not on the server", () => {
    const lateUtc = new Date("2026-11-12T22:30:00Z"); // 01:30 next day in Damascus
    expect(todayIn("Asia/Damascus", lateUtc)).toBe("2026-11-13");
    expect(formatTime(lateUtc.toISOString(), "Asia/Damascus")).toBe("01:30");
  });

  it("adds days across month ends", () => {
    expect(addDays("2026-02-27", 2)).toBe("2026-03-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });
});

describe("formatting", () => {
  it("writes Levantine month names", () => {
    expect(formatDayLong("2026-11-12")).toBe("الخميس 12 تشرين الثاني");
  });

  it("computes age around birthdays", () => {
    expect(ageFrom("1990-11-13", "2026-11-12")).toBe(35);
    expect(ageFrom("1990-11-12", "2026-11-12")).toBe(36);
    expect(ageFrom(null, "2026-11-12")).toBeNull();
  });

  it("formats money per currency decimals", () => {
    expect(formatMoney(150000, "SYP")).toBe("150,000 ل.س");
    expect(formatMoney(12.5, "USD")).toBe("12.5 $");
  });
});
