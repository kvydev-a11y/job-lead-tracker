import { prisma } from "@/lib/db";
import { FOLLOWUP_DAYS, type ContactType } from "@/lib/enums";
import { generateFollowUpDraft } from "./draft";

export type FollowUpScanSummary = { scanned: number; flagged: number };

export type StoredDraft = {
  subject: string;
  body: string;
  pushedAt?: string;
  gmailDraftId?: string | null;
};

export function parseStoredDraft(value: string | null): StoredDraft | null {
  if (!value) return null;
  try {
    const d = JSON.parse(value);
    if (typeof d?.subject === "string" && typeof d?.body === "string") return d;
  } catch {
    /* legacy/plain text */
  }
  return null;
}

/**
 * Flag outreach threads that have gone quiet past the follow-up window and
 * attach a drafted follow-up (held for the user's approval — never sent).
 * Idempotent: a thread already STALE with a draft is left untouched.
 */
export async function runFollowUpScan(now: Date = new Date()): Promise<FollowUpScanSummary> {
  const senderName = process.env.SIGNATURE_NAME || "Kavya";
  const summary: FollowUpScanSummary = { scanned: 0, flagged: 0 };

  const cutoff = new Date(now.getTime() - FOLLOWUP_DAYS * 86_400_000);
  const candidates = await prisma.outreach.findMany({
    where: {
      status: { in: ["WAITING", "STALE"] },
      lastOutboundAt: { not: null, lte: cutoff },
    },
    include: { contact: true, application: true },
  });

  for (const o of candidates) {
    summary.scanned++;
    // A reply arrived after our last outbound → not stale.
    if (o.lastInboundAt && o.lastOutboundAt && o.lastInboundAt >= o.lastOutboundAt) continue;
    // Already handled.
    if (o.status === "STALE" && o.draftFollowUp) continue;

    const draft =
      o.contact && o.application
        ? generateFollowUpDraft({
            contactName: o.contact.name,
            contactType: o.contact.type as ContactType,
            company: o.application.company,
            role: o.application.role,
            daysSinceOutbound: Math.floor((now.getTime() - o.lastOutboundAt!.getTime()) / 86_400_000),
            channel: o.channel === "LINKEDIN" ? "LINKEDIN" : "EMAIL",
            senderName,
          })
        : null;

    await prisma.outreach.update({
      where: { id: o.id },
      data: {
        status: "STALE",
        followUpDueAt: new Date(o.lastOutboundAt!.getTime() + FOLLOWUP_DAYS * 86_400_000),
        draftFollowUp: draft ? JSON.stringify(draft) : o.draftFollowUp,
      },
    });
    summary.flagged++;
  }

  return summary;
}
