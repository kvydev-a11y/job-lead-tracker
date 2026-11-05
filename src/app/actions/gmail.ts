"use server";

import { revalidatePath } from "next/cache";
import { runIngest, type IngestSummary } from "@/lib/ingest/ingest";
import { deleteSetting, SettingKey } from "@/lib/settings";
import { requireUserId } from "@/lib/auth";

export async function syncGmailNow(): Promise<IngestSummary> {
  const userId = await requireUserId();
  const summary = await runIngest(userId);
  for (const p of ["/overview", "/applications", "/contacts", "/leads", "/settings"]) {
    revalidatePath(p);
  }
  return summary;
}

export async function disconnectGmail(): Promise<void> {
  const userId = await requireUserId();
  await deleteSetting(userId, SettingKey.GoogleRefreshToken);
  await deleteSetting(userId, SettingKey.GoogleEmail);
  revalidatePath("/settings");
  revalidatePath("/overview");
}
