"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import type { ActionResult } from "./applications";

export async function convertLead(id: string): Promise<ActionResult> {
  const lead = await prisma.lead.findUnique({ where: { id } });
  if (!lead) return { ok: false, error: "Lead not found" };
  if (lead.status === "CONVERTED") return { ok: false, error: "Already converted" };

  const source = lead.source === "MUSE" ? "MUSE" : lead.source === "SARTHAK" ? "SARTHAK" : "MANUAL";
  const now = new Date();

  const app = await prisma.application.create({
    data: {
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
  revalidatePath("/");
  return { ok: true, id: app.id };
}

export async function dismissLead(id: string): Promise<ActionResult> {
  await prisma.lead.update({ where: { id }, data: { status: "DISMISSED" } });
  revalidatePath("/leads");
  return { ok: true };
}
