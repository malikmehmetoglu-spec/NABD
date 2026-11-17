import { describe, expect, it } from "vitest";
import { accessOf } from "./subscription";
import { subscriptionState } from "@/app/admin/status";
import { daysUntil } from "./time";

const NOW = Date.parse("2026-11-17T10:00:00Z");
const at = (days: number) => new Date(NOW + days * 86_400_000).toISOString();

describe("accessOf", () => {
  it("is active before expiry, expired after, suspended regardless of date", () => {
    expect(accessOf({ status: "active", expires_at: at(1) }, NOW)).toBe("active");
    expect(accessOf({ status: "active", expires_at: at(-1) }, NOW)).toBe("expired");
    expect(accessOf({ status: "suspended", expires_at: at(300) }, NOW)).toBe("suspended");
  });
  it("treats the exact expiry instant as expired, like the database", () => {
    expect(accessOf({ status: "active", expires_at: at(0) }, NOW)).toBe("expired");
  });
});

describe("subscriptionState", () => {
  it("flags clinics within 7 days of expiry", () => {
    expect(subscriptionState({ status: "active", expires_at: at(30) }, NOW)).toBe("active");
    expect(subscriptionState({ status: "active", expires_at: at(7) }, NOW)).toBe("expiring");
    expect(subscriptionState({ status: "active", expires_at: at(-0.01) }, NOW)).toBe("expired");
    expect(subscriptionState({ status: "suspended", expires_at: at(-5) }, NOW)).toBe("suspended");
  });
});

describe("daysUntil", () => {
  it("rounds partial days up", () => {
    expect(daysUntil(at(2.2), NOW)).toBe(3);
    expect(daysUntil(at(-0.5), NOW)).toBe(-0);
  });
});
