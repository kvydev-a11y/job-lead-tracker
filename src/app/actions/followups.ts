"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { runFollowUpScan, type FollowUpScanSummary } from "@/lib/followups/engine";
import { getGmailClient, createGmailDraft } from "@/lib/gmail/client";
import { isGmailConnected } from "@/lib/settings";
import type { ActionResult } from "./applications";

const paths = ["/", "/applications", "/contacts"];

export async function runFollowUpScanAction(): Promise<FollowUpScanSummary> {
  const summary = await runFollowUpScan();
  for (const p of paths) revalidatePath(p);
  return summary;
}

const ApproveSchema = z.object({
  outreachId: z.string().min(1),
  subject: z.string().trim().min(1),
  body: z.string().trim().min(1),
});

/** Create a Gmail draft from the (possibly edited) follow-up. Never sends. */
export async function approveFollowUp(input: {
  outreachId: string;
  subject: string;
  body: string;
}): Promise<ActionResult> {
  const parsed = ApproveSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid draft" };
  if (!(await isGmailConnected())) return { ok: false, error: "Gmail is not connected" };

  const outreach = await prisma.outreach.findUnique({
    where: { id: parsed.data.outreachId },
    include: { contact: true },
  });
  if (!outreach) return { ok: false, error: "Outreach not found" };
  const to = outreach.contact?.email;
  if (!to) return { ok: false, error: "This contact has no email address" };

  try {
    const gmail = await getGmailClient();
    const draftId = await createGmailDraft(gmail, {
      to,
      subject: parsed.data.subject,
      body: parsed.data.body,
      threadId: outreach.gmailThreadId,
    });
    await prisma.outreach.update({
      where: { id: outreach.id },
      data: {
        draftFollowUp: JSON.stringify({
          subject: parsed.data.subject,
          body: parsed.data.body,
          pushedAt: new Date().toISOString(),
          gmailDraftId: draftId,
        }),
      },
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to create draft" };
  }

  for (const p of paths) revalidatePath(p);
  return { ok: true };
}

/** Dismiss a flagged follow-up: reset the 7-day clock so it stops nagging. */
export async function dismissFollowUp(outreachId: string): Promise<ActionResult> {
  await prisma.outreach.update({
    where: { id: outreachId },
    data: {
      status: "WAITING",
      lastOutboundAt: new Date(),
      followUpDueAt: null,
      draftFollowUp: null,
    },
  });
  for (const p of paths) revalidatePath(p);
  return { ok: true };
}
