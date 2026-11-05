import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);

async function addOutreach(
  userId: string,
  applicationId: string,
  contactId: string,
  data: { lastOutboundAt?: Date; lastInboundAt?: Date; status: string; responseSummary?: string },
) {
  await prisma.outreach.create({
    data: { userId, applicationId, contactId, channel: "EMAIL", ...data },
  });
}

async function main() {
  // Demo account — "Try the demo" logs into this read-mostly user.
  const demo = await prisma.user.upsert({
    where: { email: "demo@jobtracker.app" },
    update: {},
    create: {
      email: "demo@jobtracker.app",
      name: "Demo User",
      isDemo: true,
      passwordHash: await bcrypt.hash("demo-" + Math.random().toString(36).slice(2), 10),
    },
  });
  const userId = demo.id;

  // Reset this user's data so the seed is idempotent.
  await prisma.lead.deleteMany({ where: { userId } });
  await prisma.application.deleteMany({ where: { userId } });

  const stripe = await prisma.application.create({
    data: {
      userId,
      company: "Stripe",
      companyDomain: "stripe.com",
      role: "Senior PM, Payments",
      roleType: "PM",
      source: "SITE",
      stage: "ONSITE",
      appliedAt: daysAgo(32),
      stageUpdatedAt: daysAgo(3),
      jobUrl: "https://stripe.com/jobs/listing/senior-pm",
      notes: "Strong fit — payments infra.",
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
          { userId, name: "Priya Nair", title: "Technical Recruiter", email: "priya@stripe.com", type: "RECRUITER", source: "MANUAL" },
          { userId, name: "Marcus Lee", title: "Director of Product, Payments", email: "marcus@stripe.com", type: "HIRING_MANAGER", source: "HUNTER", confidence: 82 },
        ],
      },
    },
    include: { contacts: true },
  });
  const priya = stripe.contacts.find((c) => c.name === "Priya Nair")!;
  const marcus = stripe.contacts.find((c) => c.name === "Marcus Lee")!;
  await addOutreach(userId, stripe.id, priya.id, {
    lastOutboundAt: daysAgo(16),
    lastInboundAt: daysAgo(15),
    status: "REPLIED",
    responseSummary: "Scheduled the onsite loop for next week.",
  });
  await addOutreach(userId, stripe.id, marcus.id, { lastOutboundAt: daysAgo(9), status: "WAITING" });

  const ramp = await prisma.application.create({
    data: {
      userId,
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
        create: { userId, name: "Dana Kim", title: "Talent Acquisition Partner", email: "dana@ramp.com", type: "TALENT_ACQUISITION", source: "MANUAL" },
      },
    },
    include: { contacts: true },
  });
  await addOutreach(userId, ramp.id, ramp.contacts[0].id, {
    lastOutboundAt: daysAgo(4),
    lastInboundAt: daysAgo(4),
    status: "REPLIED",
  });

  const airtable = await prisma.application.create({
    data: {
      userId,
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
        create: { userId, name: "Elena Rossi", title: "Head of Product", email: "elena@airtable.com", type: "HIRING_MANAGER", source: "MUSE", confidence: 74 },
      },
    },
    include: { contacts: true },
  });
  await addOutreach(userId, airtable.id, airtable.contacts[0].id, { lastOutboundAt: daysAgo(10), status: "WAITING" });

  await prisma.application.create({
    data: {
      userId,
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

  const simple = [
    { company: "Notion", domain: "notion.so", role: "Group Product Manager", roleType: "PM", source: "REFERRAL", stage: "SCREEN", applied: 9 },
    { company: "Figma", domain: "figma.com", role: "Product Designer", roleType: "DESIGN", source: "SITE", stage: "APPLIED", applied: 5 },
    { company: "Vanta", domain: "vanta.com", role: "Data PM", roleType: "DATA", source: "SARTHAK", stage: "APPLIED", applied: 8 },
    { company: "Databricks", domain: "databricks.com", role: "Engineering Manager", roleType: "EM", source: "LINKEDIN", stage: "REJECTED", applied: 28 },
    { company: "Retool", domain: "retool.com", role: "Product Manager", roleType: "PM", source: "LINKEDIN", stage: "GHOSTED", applied: 45 },
  ] as const;

  for (const s of simple) {
    await prisma.application.create({
      data: {
        userId,
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

  await prisma.lead.createMany({
    data: [
      { userId, source: "SARTHAK", company: "Mercury", role: "Senior PM, Banking", status: "NEW", extracted: JSON.stringify({ reason: "Matches fintech PM profile" }) },
      { userId, source: "MUSE", company: "Rippling", role: "Product Manager, Platform", status: "NEW", extracted: JSON.stringify({ contacts: 2 }) },
    ],
  });

  const count = await prisma.application.count({ where: { userId } });
  console.log(`Seeded demo user (${demo.email}) with ${count} applications, contacts, outreaches, and 2 leads.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
