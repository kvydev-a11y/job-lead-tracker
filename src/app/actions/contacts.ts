"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/auth";
import { ContactTypeSchema } from "@/lib/enums";
import type { ActionResult } from "./applications";

const CreateContactSchema = z.object({
  applicationId: z.string().min(1),
  name: z.string().trim().min(1, "Name is required"),
  title: z.string().trim().optional(),
  email: z.string().trim().email().optional().or(z.literal("")),
  linkedinUrl: z.string().trim().url().optional().or(z.literal("")),
  type: ContactTypeSchema.default("OTHER"),
  channel: z.enum(["EMAIL", "LINKEDIN"]).default("EMAIL"),
  notes: z.string().trim().optional(),
});

export async function createContact(formData: FormData): Promise<ActionResult> {
  const userId = await requireUserId();
  const parsed = CreateContactSchema.safeParse({
    applicationId: formData.get("applicationId"),
    name: formData.get("name"),
    title: formData.get("title") || undefined,
    email: formData.get("email") || undefined,
    linkedinUrl: formData.get("linkedinUrl") || undefined,
    type: formData.get("type") || undefined,
    channel: formData.get("channel") || undefined,
    notes: formData.get("notes") || undefined,
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const d = parsed.data;
  const app = await prisma.application.findFirst({
    where: { id: d.applicationId, userId },
    select: { id: true },
  });
  if (!app) return { ok: false, error: "Application not found" };

  const contact = await prisma.contact.create({
    data: {
      userId,
      applicationId: d.applicationId,
      name: d.name,
      title: d.title || null,
      email: d.email || null,
      linkedinUrl: d.linkedinUrl || null,
      type: d.type,
      channel: d.channel,
      source: "MANUAL",
      notes: d.notes || null,
    },
  });

  revalidatePath(`/applications/${d.applicationId}`);
  revalidatePath("/contacts");
  return { ok: true, id: contact.id };
}

export async function updateContactType(id: string, type: string): Promise<ActionResult> {
  const userId = await requireUserId();
  const parsed = ContactTypeSchema.safeParse(type);
  if (!parsed.success) return { ok: false, error: "Invalid contact type" };

  const contact = await prisma.contact.findFirst({ where: { id, userId }, select: { applicationId: true } });
  if (!contact) return { ok: false, error: "Contact not found" };

  await prisma.contact.update({ where: { id }, data: { type: parsed.data } });

  revalidatePath(`/applications/${contact.applicationId}`);
  revalidatePath("/contacts");
  return { ok: true, id };
}

export async function deleteContact(id: string): Promise<ActionResult> {
  const userId = await requireUserId();
  const contact = await prisma.contact.findFirst({ where: { id, userId }, select: { applicationId: true } });
  if (!contact) return { ok: false, error: "Contact not found" };

  await prisma.contact.delete({ where: { id } });
  revalidatePath(`/applications/${contact.applicationId}`);
  revalidatePath("/contacts");
  return { ok: true };
}
