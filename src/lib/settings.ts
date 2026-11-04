import { prisma } from "./db";

/** Well-known setting keys (integration secrets + sync state). */
export const SettingKey = {
  GoogleRefreshToken: "google_refresh_token",
  GoogleEmail: "google_email",
  GmailLastIngestAt: "gmail_last_ingest_at",
} as const;

export async function getSetting(key: string): Promise<string | null> {
  const row = await prisma.setting.findUnique({ where: { key } });
  return row?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  await prisma.setting.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  });
}

export async function deleteSetting(key: string): Promise<void> {
  await prisma.setting.deleteMany({ where: { key } });
}

/** Whether a Gmail account is connected (a refresh token is stored). */
export async function isGmailConnected(): Promise<boolean> {
  return (await getSetting(SettingKey.GoogleRefreshToken)) !== null;
}
