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
  outbound: number;
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

function leadSendersFromEnv(): string[] {
  return (process.env.LEAD_SENDERS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

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
        await sleep(2000 * Math.pow(2, attempt));
        continue;
      }
      throw err;
    }
  }
}

/** Pull new Gmail messages for one user, classify, and persist. Idempotent. */
export async function runIngest(userId: string): Promise<IngestSummary> {
  const summary: IngestSummary = {
    connected: false,
    scanned: 0,
    applications: 0,
    replies: 0,
    linkedin: 0,
    leads: 0,
    contacts: 0,
    outbound: 0,
    ignored: 0,
    errors: 0,
  };

  if (!(await isGmailConnected(userId))) return summary;
  summary.connected = true;

  const gmail = await getGmailClient(userId);
  const lastIngest = await getSetting(userId, SettingKey.GmailLastIngestAt);
  const query = lastIngest
    ? `after:${Math.floor(new Date(lastIngest).getTime() / 1000)} -in:chats`
    : "newer_than:30d -in:chats";

  const ids = await listMessageIds(gmail, query);
  const known = new Set(
    (
      await prisma.processedEmail.findMany({
        where: { userId, gmailMessageId: { in: ids } },
        select: { gmailMessageId: true },
      })
    ).map((r) => r.gmailMessageId),
  );
  const todo = ids.filter((id) => !known.has(id));
  const leadSenders = leadSendersFromEnv();

  for (const id of todo) {
    summary.scanned++;
    try {
      await sleep(80);
      const raw = await getMessageWithRetry(gmail, id);
      const email = parseGmailMessage(raw);
      const cls = classifyEmail(email, { leadSenders });
      await applyClassification(userId, email, cls, gmail, summary);
      await prisma.processedEmail.create({ data: { userId, gmailMessageId: id, kind: cls.kind } });
    } catch (err) {
      summary.errors++;
      if (summary.errors <= 5) {
        console.error("[ingest] failed on message", id, err instanceof Error ? err.message : err);
      }
    }
  }

  await ingestOutbound(userId, gmail, summary);

  if (summary.errors === 0) {
    await setSetting(userId, SettingKey.GmailLastIngestAt, new Date().toISOString());
  }
  return summary;
}

async function applyClassification(
  userId: string,
  email: NormalizedEmail,
  cls: Classification,
  gmail: gmail_v1.Gmail,
  summary: IngestSummary,
): Promise<void> {
  switch (cls.kind) {
    case "APPLICATION": {
      if (cls.rejected) {
        const open = await prisma.application.findFirst({
          where: {
            userId,
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
        const alreadyRejected = await prisma.application.findFirst({
          where: { userId, company: cls.company, role: cls.role ?? "(role unknown)", stage: "REJECTED" },
          select: { id: true },
        });
        if (alreadyRejected) return;
        await prisma.application.create({
          data: {
            userId,
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

      const existing = await prisma.application.findFirst({
        where: {
          userId,
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
          userId,
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
        where: { userId, gmailThreadId: cls.threadId },
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
        where: { userId_rawEmailId: { userId, rawEmailId: email.id } },
        create: {
          userId,
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
      const roles: (string | null)[] = cls.roles.length ? cls.roles : [null];
      for (let i = 0; i < roles.length; i++) {
        const rawId = cls.roles.length > 1 ? `${email.id}#${i}` : email.id;
        await prisma.lead.upsert({
          where: { userId_rawEmailId: { userId, rawEmailId: rawId } },
          create: {
            userId,
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
      if (rows.length === 0) {
        const csvAtt = email.attachments.find((a) => /\.csv$/i.test(a.filename) || a.mimeType.includes("csv"));
        if (csvAtt) {
          const data = await getAttachment(gmail, email.id, csvAtt.attachmentId);
          if (data) rows = parseCsv(Buffer.from(data, "base64url").toString("utf8"));
        }
      }

      const app = await findApplicationForMuse(userId, cls.company, rows);
      if (!app) {
        await prisma.lead.upsert({
          where: { userId_rawEmailId: { userId, rawEmailId: email.id } },
          create: {
            userId,
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
            userId,
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

async function findApplicationForMuse(
  userId: string,
  subjectCompany: string | null,
  rows: Record<string, string>[],
): Promise<{ id: string } | null> {
  const domains = [...new Set(rows.map((r) => (r["company_domain"] ?? "").toLowerCase()).filter(Boolean))];
  for (const d of domains) {
    const byDomain = await prisma.application.findFirst({ where: { userId, companyDomain: d }, select: { id: true } });
    if (byDomain) return byDomain;
  }
  const names = [subjectCompany, ...rows.map((r) => r["company"])].filter(Boolean) as string[];
  for (const n of [...new Set(names)]) {
    const byName = await prisma.application.findFirst({ where: { userId, company: n }, select: { id: true } });
    if (byName) return byName;
  }
  return null;
}

/** Detect outbound emails to a user's contacts (targeted, quota-friendly). */
async function ingestOutbound(userId: string, gmail: gmail_v1.Gmail, summary: IngestSummary): Promise<void> {
  const contacts = await prisma.contact.findMany({
    where: { userId, email: { not: null }, channel: "EMAIL" },
    select: { id: true, email: true, applicationId: true },
  });

  for (const c of contacts) {
    if (!c.email) continue;
    try {
      await sleep(80);
      const ids = await listMessageIds(gmail, `in:sent to:${c.email}`, 1);
      if (ids.length === 0) continue;
      const email = parseGmailMessage(await getMessageWithRetry(gmail, ids[0]));

      const existing = await prisma.outreach.findFirst({
        where: { userId, applicationId: c.applicationId, contactId: c.id },
      });

      if (!existing) {
        await prisma.outreach.create({
          data: {
            userId,
            applicationId: c.applicationId,
            contactId: c.id,
            channel: "EMAIL",
            gmailThreadId: email.threadId,
            lastOutboundAt: email.date,
            status: "WAITING",
          },
        });
        summary.outbound++;
      } else if (email.date.getTime() > (existing.lastOutboundAt?.getTime() ?? 0)) {
        await prisma.outreach.update({
          where: { id: existing.id },
          data: {
            lastOutboundAt: email.date,
            gmailThreadId: email.threadId,
            ...(existing.status === "STALE"
              ? { status: "WAITING", draftFollowUp: null, followUpDueAt: null }
              : {}),
          },
        });
        summary.outbound++;
      }
    } catch {
      summary.errors++;
    }
  }
}
