"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/auth";
import type { ActionResult } from "./applications";

export async function convertLead(id: string): Promise<ActionResult> {
  const userId = await requireUserId();
  const lead = await prisma.lead.findFirst({ where: { id, userId } });
  if (!lead) return { ok: false, error: "Lead not found" };
  if (lead.status === "CONVERTED") return { ok: false, error: "Already converted" };

  const source = lead.source === "MUSE" ? "MUSE" : lead.source === "SARTHAK" ? "SARTHAK" : "MANUAL";
  const now = new Date();

  const app = await prisma.application.create({
    data: {
      userId,
      company: lead.company ?? "Unknown company",
      role: lead.role ?? "(role unknown)",
      source,
      stage: "APPLIED",
      appliedAt: now,
      stageUpdatedAt: now,
      stageEvents: { create: { toStage: "APPLIED", at: now } },
    },
  });

  await prisma.lead.update({
    where: { id },
    data: { status: "CONVERTED", convertedApplicationId: app.id },
  });

  revalidatePath("/leads");
  revalidatePath("/applications");
  revalidatePath("/overview");
  return { ok: true, id: app.id };
}

export async function dismissLead(id: string): Promise<ActionResult> {
  const userId = await requireUserId();
  await prisma.lead.updateMany({ where: { id, userId }, data: { status: "DISMISSED" } });
  revalidatePath("/leads");
  return { ok: true };
}
