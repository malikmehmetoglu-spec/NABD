import type { Tone } from "@/lib/labels";
import type { ClinicStatus } from "@/lib/supabase/types";
import { EXPIRING_DAYS } from "./config";

export type SubscriptionState = "active" | "expiring" | "expired" | "suspended";

export const STATE_LABEL: Record<SubscriptionState, { label: string; tone: Tone }> = {
  active: { label: "فعّال", tone: "green" },
  expiring: { label: "ينتهي قريباً", tone: "orange" },
  expired: { label: "منتهٍ", tone: "danger" },
  suspended: { label: "معلّق", tone: "neutral" },
};

export function subscriptionState(c: { status: ClinicStatus; expires_at: string }, now = Date.now()): SubscriptionState {
  if (c.status === "suspended") return "suspended";
  const left = new Date(c.expires_at).getTime() - now;
  if (left <= 0) return "expired";
  return left <= EXPIRING_DAYS * 86_400_000 ? "expiring" : "active";
}
