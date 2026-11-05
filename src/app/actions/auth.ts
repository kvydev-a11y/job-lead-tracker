"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { hashPassword, verifyPassword, createSession, destroySession } from "@/lib/auth";

export type AuthResult = { ok: true } | { ok: false; error: string };

const CredsSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export async function signUp(formData: FormData): Promise<AuthResult> {
  const parsed = CredsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]!.message };

  const { email, password } = parsed.data;
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return { ok: false, error: "An account with that email already exists." };

  const name = (formData.get("name") as string | null)?.trim() || null;
  const user = await prisma.user.create({
    data: { email, passwordHash: await hashPassword(password), name },
  });
  await createSession(user.id);
  return { ok: true };
}

export async function logIn(formData: FormData): Promise<AuthResult> {
  const parsed = CredsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { ok: false, error: "Enter a valid email and password." };

  const { email, password } = parsed.data;
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return { ok: false, error: "Incorrect email or password." };
  }
  await createSession(user.id);
  return { ok: true };
}

export async function demoLogin(): Promise<AuthResult> {
  const demo = await prisma.user.findFirst({ where: { isDemo: true } });
  if (!demo) return { ok: false, error: "The demo account isn't set up yet." };
  await createSession(demo.id);
  return { ok: true };
}

export async function logOut(): Promise<void> {
  await destroySession();
  redirect("/login");
}
