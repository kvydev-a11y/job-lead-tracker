"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { RoleTypeSchema, SourceSchema, StageSchema } from "@/lib/enums";
import { guessDomain } from "@/lib/utils";

const CreateApplicationSchema = z.object({
  company: z.string().trim().min(1, "Company is required"),
  role: z.string().trim().min(1, "Role is required"),
  roleType: RoleTypeSchema.default("PM"),
  source: SourceSchema.default("MANUAL"),
  companyDomain: z.string().trim().optional(),
  jobUrl: z.string().trim().url().optional().or(z.literal("")),
  appliedAt: z.string().optional(),
  notes: z.string().trim().optional(),
});

export type ActionResult = { ok: true; id?: string } | { ok: false; error: string };

export async function createApplication(formData: FormData): Promise<ActionResult> {
  const parsed = CreateApplicationSchema.safeParse({
    company: formData.get("company"),
    role: formData.get("role"),
    roleType: formData.get("roleType") || undefined,
    source: formData.get("source") || undefined,
    companyDomain: formData.get("companyDomain") || undefined,
    jobUrl: formData.get("jobUrl") || undefined,
    appliedAt: formData.get("appliedAt") || undefined,
    notes: formData.get("notes") || undefined,
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const data = parsed.data;
  const appliedAt = data.appliedAt ? new Date(data.appliedAt) : new Date();

  const app = await prisma.application.create({
    data: {
      company: data.company,
      role: data.role,
      roleType: data.roleType,
      source: data.source,
      companyDomain: data.companyDomain || guessDomain(data.company),
      jobUrl: data.jobUrl || null,
      notes: data.notes || null,
      appliedAt,
      stage: "APPLIED",
      stageUpdatedAt: appliedAt,
      stageEvents: { create: { toStage: "APPLIED", at: appliedAt } },
    },
  });

  revalidatePath("/applications");
  revalidatePath("/");
  return { ok: true, id: app.id };
}

export async function updateStage(id: string, stage: string): Promise<ActionResult> {
  const parsedStage = StageSchema.safeParse(stage);
  if (!parsedStage.success) return { ok: false, error: "Invalid stage" };

  const current = await prisma.application.findUnique({ where: { id }, select: { stage: true } });
  if (!current) return { ok: false, error: "Application not found" };
  if (current.stage === parsedStage.data) return { ok: true, id };

  await prisma.$transaction([
    prisma.application.update({
      where: { id },
      data: { stage: parsedStage.data, stageUpdatedAt: new Date() },
    }),
    prisma.stageEvent.create({
      data: { applicationId: id, fromStage: current.stage, toStage: parsedStage.data },
    }),
  ]);

  revalidatePath("/applications");
  revalidatePath(`/applications/${id}`);
  revalidatePath("/");
  return { ok: true, id };
}

export async function deleteApplication(id: string): Promise<void> {
  await prisma.application.delete({ where: { id } });
  revalidatePath("/applications");
  revalidatePath("/");
  redirect("/applications");
}
