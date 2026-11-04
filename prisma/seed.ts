import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL ?? "file:./dev.db",
});
const prisma = new PrismaClient({ adapter });

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);

/** Attach an outreach to a named contact of an application. */
async function addOutreach(
  applicationId: string,
  contactId: string,
  data: {
    lastOutboundAt?: Date;
    lastInboundAt?: Date;
    status: string;
    responseSummary?: string;
  },
) {
  await prisma.outreach.create({
    data: { applicationId, contactId, channel: "EMAIL", ...data },
  });
}

async function main() {
  await prisma.lead.deleteMany();
  await prisma.application.deleteMany();

  // --- Stripe: deep pipeline; recruiter replied, HM gone quiet (follow-up due) ---
  const stripe = await prisma.application.create({
    data: {
      company: "Stripe",
      companyDomain: "stripe.com",
      role: "Senior PM, Payments",
      roleType: "PM",
      source: "SITE",
      stage: "ONSITE",
      appliedAt: daysAgo(32),
      stageUpdatedAt: daysAgo(3),
      jobUrl: "https://stripe.com/jobs/listing/senior-pm",
      notes: "Strong fit — payments infra. Referral intro via ex-colleague.",
      stageEvents: {
        create: [
          { toStage: "APPLIED", at: daysAgo(32) },
          { fromStage: "APPLIED", toStage: "SCREEN", at: daysAgo(24) },
          { fromStage: "SCREEN", toStage: "PHONE", at: daysAgo(14) },
          { fromStage: "PHONE", toStage: "ONSITE", at: daysAgo(3) },
        ],
      },
      contacts: {
        create: [
          { name: "Priya Nair", title: "Technical Recruiter", email: "priya@stripe.com", type: "RECRUITER", source: "MANUAL" },
          { name: "Marcus Lee", title: "Director of Product, Payments", email: "marcus@stripe.com", type: "HIRING_MANAGER", source: "HUNTER", confidence: 82 },
        ],
      },
    },
    include: { contacts: true },
  });
  const priya = stripe.contacts.find((c) => c.name === "Priya Nair")!;
  const marcus = stripe.contacts.find((c) => c.name === "Marcus Lee")!;
  await addOutreach(stripe.id, priya.id, {
    lastOutboundAt: daysAgo(16),
    lastInboundAt: daysAgo(15),
    status: "REPLIED",
    responseSummary: "Scheduled the onsite loop for next week.",
  });
  await addOutreach(stripe.id, marcus.id, { lastOutboundAt: daysAgo(9), status: "WAITING" });

  // --- Ramp: phone stage, TA replied ---
  const ramp = await prisma.application.create({
    data: {
      company: "Ramp",
      companyDomain: "ramp.com",
      role: "Product Manager, Growth",
      roleType: "PM",
      source: "LINKEDIN",
      stage: "PHONE",
      appliedAt: daysAgo(18),
      stageUpdatedAt: daysAgo(5),
      stageEvents: {
        create: [
          { toStage: "APPLIED", at: daysAgo(18) },
          { fromStage: "APPLIED", toStage: "SCREEN", at: daysAgo(11) },
          { fromStage: "SCREEN", toStage: "PHONE", at: daysAgo(5) },
        ],
      },
      contacts: {
        create: { name: "Dana Kim", title: "Talent Acquisition Partner", email: "dana@ramp.com", type: "TALENT_ACQUISITION", source: "MANUAL" },
      },
    },
    include: { contacts: true },
  });
  await addOutreach(ramp.id, ramp.contacts[0].id, {
    lastOutboundAt: daysAgo(4),
    lastInboundAt: daysAgo(4),
    status: "REPLIED",
  });

  // --- Notion: recruiter screen via referral ---
  await prisma.application.create({
    data: {
      company: "Notion",
      companyDomain: "notion.so",
      role: "Group Product Manager",
      roleType: "PM",
      source: "REFERRAL",
      stage: "SCREEN",
      appliedAt: daysAgo(9),
      stageUpdatedAt: daysAgo(6),
      notes: "Referred by A. Gupta.",
      stageEvents: {
        create: [
          { toStage: "APPLIED", at: daysAgo(9) },
          { fromStage: "APPLIED", toStage: "SCREEN", at: daysAgo(6) },
        ],
      },
      contacts: {
        create: { name: "Aarav Gupta", title: "Senior PM (referral)", type: "REFERRAL", channel: "LINKEDIN", linkedinUrl: "https://linkedin.com/in/example", source: "MANUAL" },
      },
    },
  });

  // --- Airtable: from Muse, Muse-sourced HM, awaiting reply (follow-up due) ---
  const airtable = await prisma.application.create({
    data: {
      company: "Airtable",
      companyDomain: "airtable.com",
      role: "Senior Product Manager",
      roleType: "PM",
      source: "MUSE",
      stage: "SCREEN",
      appliedAt: daysAgo(12),
      stageUpdatedAt: daysAgo(7),
      stageEvents: {
        create: [
          { toStage: "APPLIED", at: daysAgo(12) },
          { fromStage: "APPLIED", toStage: "SCREEN", at: daysAgo(7) },
        ],
      },
      contacts: {
        create: { name: "Elena Rossi", title: "Head of Product", email: "elena@airtable.com", type: "HIRING_MANAGER", source: "MUSE", confidence: 74 },
      },
    },
    include: { contacts: true },
  });
  await addOutreach(airtable.id, airtable.contacts[0].id, { lastOutboundAt: daysAgo(10), status: "WAITING" });

  // --- Linear: offer! ---
  await prisma.application.create({
    data: {
      company: "Linear",
      companyDomain: "linear.app",
      role: "Product Manager",
      roleType: "PM",
      source: "SITE",
      stage: "OFFER",
      appliedAt: daysAgo(40),
      stageUpdatedAt: daysAgo(2),
      notes: "Offer received — negotiating.",
      stageEvents: {
        create: [
          { toStage: "APPLIED", at: daysAgo(40) },
          { fromStage: "APPLIED", toStage: "SCREEN", at: daysAgo(33) },
          { fromStage: "SCREEN", toStage: "PHONE", at: daysAgo(26) },
          { fromStage: "PHONE", toStage: "ONSITE", at: daysAgo(14) },
          { fromStage: "ONSITE", toStage: "OFFER", at: daysAgo(2) },
        ],
      },
    },
  });

  // --- Simple recent / closed ones ---
  const simple = [
    { company: "Anthropic", domain: "anthropic.com", role: "Product Manager, Claude", roleType: "PM", source: "SITE", stage: "APPLIED", applied: 2 },
    { company: "Figma", domain: "figma.com", role: "Product Designer", roleType: "DESIGN", source: "SITE", stage: "APPLIED", applied: 5 },
    { company: "Vanta", domain: "vanta.com", role: "Data PM", roleType: "DATA", source: "SARTHAK", stage: "APPLIED", applied: 8 },
    { company: "Databricks", domain: "databricks.com", role: "Engineering Manager", roleType: "EM", source: "LINKEDIN", stage: "REJECTED", applied: 28 },
    { company: "Retool", domain: "retool.com", role: "Product Manager", roleType: "PM", source: "LINKEDIN", stage: "GHOSTED", applied: 45 },
  ] as const;

  for (const s of simple) {
    await prisma.application.create({
      data: {
        company: s.company,
        companyDomain: s.domain,
        role: s.role,
        roleType: s.roleType,
        source: s.source,
        stage: s.stage,
        appliedAt: daysAgo(s.applied),
        stageUpdatedAt: daysAgo(Math.max(1, s.applied - 5)),
        stageEvents: { create: { toStage: "APPLIED", at: daysAgo(s.applied) } },
      },
    });
  }

  // --- Incoming leads (triage inbox for Phase 4) ---
  await prisma.lead.createMany({
    data: [
      { source: "SARTHAK", company: "Mercury", role: "Senior PM, Banking", status: "NEW", extracted: JSON.stringify({ reason: "Matches fintech PM profile", seniority: "Senior" }) },
      { source: "MUSE", company: "Rippling", role: "Product Manager, Platform", status: "NEW", extracted: JSON.stringify({ contacts: 2, note: "2 recruiter contacts attached" }) },
    ],
  });

  const count = await prisma.application.count();
  console.log(`Seeded ${count} applications, contacts, outreaches, and 2 leads.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
