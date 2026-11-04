import { prisma } from "@/lib/db";
import { getSetting, setSetting, isGmailConnected, SettingKey } from "@/lib/settings";
import { getGmailClient, listMessageIds, getMessage, getAttachment } from "@/lib/gmail/client";
import { parseGmailMessage, type NormalizedEmail } from "./email";
import { classifyEmail, type Classification } from "./classifiers";
import { parseCsv } from "./csv";
import type { ContactType } from "@/lib/enums";
import type { gmail_v1 } from "googleapis";

export type IngestSummary = {
  connected: boolean;
  scanned: number;
  applications: number;
  replies: number;
  linkedin: number;
  leads: number;
  contacts: number;
  ignored: number;
  errors: number;
};

const CONTACT_TYPE_MAP: Record<string, ContactType> = {
  hiring_manager: "HIRING_MANAGER",
  talent_acquisition: "TALENT_ACQUISITION",
  recruiter: "RECRUITER",
  referral: "REFERRAL",
  other: "OTHER",
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Fetch a message, retrying with exponential backoff on Gmail rate/quota errors. */
async function getMessageWithRetry(
  gmail: gmail_v1.Gmail,
  id: string,
  tries = 5,
): Promise<gmail_v1.Schema$Message> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await getMessage(gmail, id);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const isRate = /quota|rate ?limit|userRateLimitExceeded|\b429\b/i.test(msg);
      if (isRate && attempt < tries - 1) {
        await sleep(2000 * Math.pow(2, attempt)); // 2s, 4s, 8s, 16s
        continue;
      }
      throw err;
    }
  }
}

function leadSendersFromEnv(): string[] {
  return (process.env.LEAD_SENDERS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

/** Main entry: pull new Gmail messages, classify, and persist. Idempotent via
 *  the ProcessedEmail table, so re-runs never double-write. */
export async function runIngest(): Promise<IngestSummary> {
  const summary: IngestSummary = {
    connected: false,
    scanned: 0,
    applications: 0,
    replies: 0,
    linkedin: 0,
    leads: 0,
    contacts: 0,
    ignored: 0,
    errors: 0,
  };

  if (!(await isGmailConnected())) return summary;
  summary.connected = true;

  const gmail = await getGmailClient();
  const lastIngest = await getSetting(SettingKey.GmailLastIngestAt);
  const query = lastIngest
    ? `after:${Math.floor(new Date(lastIngest).getTime() / 1000)} -in:chats`
    : "newer_than:30d -in:chats";

  const ids = await listMessageIds(gmail, query);

  // Skip anything we've already handled.
  const known = new Set(
    (
      await prisma.processedEmail.findMany({
        where: { gmailMessageId: { in: ids } },
        select: { gmailMessageId: true },
      })
    ).map((r) => r.gmailMessageId),
  );
  const todo = ids.filter((id) => !known.has(id));

  const leadSenders = leadSendersFromEnv();

  for (const id of todo) {
    summary.scanned++;
    try {
      await sleep(80); // smooth request rate to stay under the per-user quota
      const raw = await getMessageWithRetry(gmail, id);
      const email = parseGmailMessage(raw);
      const cls = classifyEmail(email, { leadSenders });
      await applyClassification(email, cls, gmail, summary);
      await prisma.processedEmail.create({
        data: { gmailMessageId: id, kind: cls.kind },
      });
    } catch (err) {
      summary.errors++;
      if (summary.errors <= 5) {
        console.error("[ingest] failed on message", id, err instanceof Error ? err.message : err);
      }
    }
  }

  // Only advance the cursor on a clean run; otherwise keep the window so
  // errored messages are retried next time (ProcessedEmail dedups successes).
  if (summary.errors === 0) {
    await setSetting(SettingKey.GmailLastIngestAt, new Date().toISOString());
  }
  return summary;
}

async function applyClassification(
  email: NormalizedEmail,
  cls: Classification,
  gmail: gmail_v1.Gmail,
  summary: IngestSummary,
): Promise<void> {
  switch (cls.kind) {
    case "APPLICATION": {
      // Rejection: move the matching open application to REJECTED (don't create
      // a fresh APPLIED row).
      if (cls.rejected) {
        const open = await prisma.application.findFirst({
          where: {
            OR: [{ gmailThreadId: email.threadId }, { company: cls.company }],
            stage: { notIn: ["REJECTED", "GHOSTED", "OFFER"] },
          },
          orderBy: { appliedAt: "desc" },
          select: { id: true, stage: true },
        });
        if (open) {
          await prisma.$transaction([
            prisma.application.update({
              where: { id: open.id },
              data: { stage: "REJECTED", stageUpdatedAt: email.date },
            }),
            prisma.stageEvent.create({
              data: { applicationId: open.id, fromStage: open.stage, toStage: "REJECTED", at: email.date },
            }),
          ]);
          summary.applications++;
          return;
        }
        // No tracked application — record the rejection outcome, but only once.
        const alreadyRejected = await prisma.application.findFirst({
          where: { company: cls.company, role: cls.role ?? "(role unknown)", stage: "REJECTED" },
          select: { id: true },
        });
        if (alreadyRejected) return;
        await prisma.application.create({
          data: {
            company: cls.company,
            companyDomain: cls.domain,
            role: cls.role ?? "(role unknown)",
            source: "SITE",
            stage: "REJECTED",
            appliedAt: email.date,
            stageUpdatedAt: email.date,
            gmailThreadId: email.threadId,
            stageEvents: { create: { toStage: "REJECTED", at: email.date } },
          },
        });
        summary.applications++;
        return;
      }

      // Confirmation: create unless we already track this thread or company+role.
      const existing = await prisma.application.findFirst({
        where: {
          OR: [
            { gmailThreadId: email.threadId },
            { company: cls.company, role: cls.role ?? undefined },
          ],
        },
        select: { id: true },
      });
      if (existing) return;
      await prisma.application.create({
        data: {
          company: cls.company,
          companyDomain: cls.domain,
          role: cls.role ?? "(role unknown)",
          source: "SITE",
          stage: "APPLIED",
          appliedAt: email.date,
          stageUpdatedAt: email.date,
          gmailThreadId: email.threadId,
          stageEvents: { create: { toStage: "APPLIED", at: email.date } },
        },
      });
      summary.applications++;
      return;
    }

    case "REPLY": {
      const outreaches = await prisma.outreach.findMany({
        where: { gmailThreadId: cls.threadId },
        select: { id: true },
      });
      for (const o of outreaches) {
        await prisma.outreach.update({
          where: { id: o.id },
          data: { lastInboundAt: email.date, status: "REPLIED", responseSummary: cls.summary },
        });
        summary.replies++;
      }
      return;
    }

    case "LINKEDIN": {
      await prisma.lead.upsert({
        where: { rawEmailId: email.id },
        create: {
          source: "OTHER",
          rawEmailId: email.id,
          extracted: JSON.stringify({ channel: "LINKEDIN", person: cls.person, action: cls.action, subject: email.subject }),
        },
        update: {},
      });
      summary.linkedin++;
      return;
    }

    case "LEAD": {
      // A job-match report can recommend several roles — one lead each.
      const roles: (string | null)[] = cls.roles.length ? cls.roles : [null];
      for (let i = 0; i < roles.length; i++) {
        const rawId = cls.roles.length > 1 ? `${email.id}#${i}` : email.id;
        await prisma.lead.upsert({
          where: { rawEmailId: rawId },
          create: {
            source: cls.source,
            company: cls.company,
            role: roles[i],
            rawEmailId: rawId,
            extracted: JSON.stringify({ subject: email.subject }),
          },
          update: {},
        });
        summary.leads++;
      }
      return;
    }

    case "MUSE_CONTACTS": {
      let rows = cls.rows;
      // If the body had no CSV, try a .csv attachment.
      if (rows.length === 0) {
        const csvAtt = email.attachments.find((a) => /\.csv$/i.test(a.filename) || a.mimeType.includes("csv"));
        if (csvAtt) {
          const data = await getAttachment(gmail, email.id, csvAtt.attachmentId);
          if (data) rows = parseCsv(Buffer.from(data, "base64url").toString("utf8"));
        }
      }

      const app = await findApplicationForMuse(cls.company, rows);
      if (!app) {
        await prisma.lead.upsert({
          where: { rawEmailId: email.id },
          create: {
            source: "MUSE",
            company: cls.company,
            role: cls.role,
            rawEmailId: email.id,
            extracted: JSON.stringify({ contacts: rows.length, subject: email.subject }),
          },
          update: {},
        });
        summary.leads++;
        return;
      }

      for (const row of rows) {
        const rEmail = (row["email"] ?? "").toLowerCase() || null;
        const name = row["contact_name"] || row["name"] || "(unknown)";
        if (rEmail) {
          const dupe = await prisma.contact.findFirst({
            where: { applicationId: app.id, email: rEmail },
            select: { id: true },
          });
          if (dupe) continue;
        }
        const type = CONTACT_TYPE_MAP[(row["contact_type"] ?? "").toLowerCase()] ?? "OTHER";
        const conf = Number(row["confidence"]);
        await prisma.contact.create({
          data: {
            applicationId: app.id,
            name,
            title: row["title"] || null,
            email: rEmail,
            linkedinUrl: row["linkedin_url"] || null,
            type,
            source: "MUSE",
            confidence: Number.isFinite(conf) ? conf : null,
          },
        });
        summary.contacts++;
      }
      return;
    }

    default:
      summary.ignored++;
  }
}

/** Match a Muse contact drop to an application by domain, then company name. */
async function findApplicationForMuse(
  subjectCompany: string | null,
  rows: Record<string, string>[],
): Promise<{ id: string } | null> {
  const domains = [...new Set(rows.map((r) => (r["company_domain"] ?? "").toLowerCase()).filter(Boolean))];
  for (const d of domains) {
    const byDomain = await prisma.application.findFirst({ where: { companyDomain: d }, select: { id: true } });
    if (byDomain) return byDomain;
  }
  const names = [subjectCompany, ...rows.map((r) => r["company"])].filter(Boolean) as string[];
  for (const n of [...new Set(names)]) {
    const byName = await prisma.application.findFirst({ where: { company: n }, select: { id: true } });
    if (byName) return byName;
  }
  return null;
}
