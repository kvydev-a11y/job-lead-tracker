import { FOLLOWUP_DAYS } from "./enums";

export type OutreachLike = {
  status: string;
  lastOutboundAt: Date | null;
  lastInboundAt: Date | null;
};

/**
 * An outreach needs a follow-up when it's already flagged STALE, or when we
 * sent something, never heard back, and >FOLLOWUP_DAYS have passed. This is
 * the same rule the Phase-3 cron will persist; computing it here keeps the UI
 * correct even before the cron has run.
 */
export function isFollowUpDue(o: OutreachLike, now: number = Date.now()): boolean {
  if (o.status === "STALE") return true;
  if (o.status === "REPLIED") return false;
  if (!o.lastOutboundAt) return false;
  if (o.lastInboundAt && o.lastInboundAt >= o.lastOutboundAt) return false;
  return o.lastOutboundAt.getTime() < now - FOLLOWUP_DAYS * 86_400_000;
}

export function anyFollowUpDue(outreaches: OutreachLike[], now?: number): boolean {
  return outreaches.some((o) => isFollowUpDue(o, now));
}
