"use server";

import { revalidatePath } from "next/cache";
import { runIngest, type IngestSummary } from "@/lib/ingest/ingest";
import { deleteSetting, SettingKey } from "@/lib/settings";

export async function syncGmailNow(): Promise<IngestSummary> {
  const summary = await runIngest();
  for (const p of ["/", "/applications", "/leads", "/contacts", "/settings"]) {
    revalidatePath(p);
  }
  return summary;
}

export async function disconnectGmail(): Promise<void> {
  await deleteSetting(SettingKey.GoogleRefreshToken);
  await deleteSetting(SettingKey.GoogleEmail);
  revalidatePath("/settings");
  revalidatePath("/");
}
