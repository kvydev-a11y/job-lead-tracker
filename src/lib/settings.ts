import { prisma } from "./db";

/** Well-known per-user setting keys (integration secrets + sync state). */
export const SettingKey = {
  GoogleRefreshToken: "google_refresh_token",
  GoogleEmail: "google_email",
  GmailLastIngestAt: "gmail_last_ingest_at",
} as const;

export async function getSetting(userId: string, key: string): Promise<string | null> {
  const row = await prisma.setting.findUnique({ where: { userId_key: { userId, key } } });
  return row?.value ?? null;
}

export async function setSetting(userId: string, key: string, value: string): Promise<void> {
  await prisma.setting.upsert({
    where: { userId_key: { userId, key } },
    create: { userId, key, value },
    update: { value },
  });
}

export async function deleteSetting(userId: string, key: string): Promise<void> {
  await prisma.setting.deleteMany({ where: { userId, key } });
}

/** Whether this user has connected Gmail (a refresh token is stored). */
export async function isGmailConnected(userId: string): Promise<boolean> {
  return (await getSetting(userId, SettingKey.GoogleRefreshToken)) !== null;
}

/** User ids that have a Gmail refresh token stored — for the ingestion cron. */
export async function connectedUserIds(): Promise<string[]> {
  const rows = await prisma.setting.findMany({
    where: { key: SettingKey.GoogleRefreshToken },
    select: { userId: true },
  });
  return rows.map((r) => r.userId);
}
