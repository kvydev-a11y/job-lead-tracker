import { google, type gmail_v1 } from "googleapis";
import { OAuth2Client } from "google-auth-library";
import { getSetting, setSetting, SettingKey } from "@/lib/settings";

// We request read access (for ingestion) and compose (for Phase 3 draft
// follow-ups) up front, so the user only consents once.
export const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.compose",
  "https://www.googleapis.com/auth/userinfo.email",
];

export function googleConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

function redirectUri(): string {
  return (
    process.env.GOOGLE_REDIRECT_URI ??
    `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/api/google/callback`
  );
}

export function createOAuthClient(): OAuth2Client {
  if (!googleConfigured()) {
    throw new Error(
      "Google OAuth is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.",
    );
  }
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    redirectUri(),
  );
}

/** URL to send the user to for consent (offline access => refresh token). */
export function getAuthUrl(state?: string): string {
  return createOAuthClient().generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: GMAIL_SCOPES,
    include_granted_scopes: true,
    state,
  });
}

/** Exchange an auth code for tokens and persist the refresh token + email. */
export async function exchangeCodeAndStore(code: string): Promise<{ email: string | null }> {
  const client = createOAuthClient();
  const { tokens } = await client.getToken(code);
  if (!tokens.refresh_token) {
    throw new Error(
      "No refresh token returned. Revoke prior access and reconnect (prompt=consent).",
    );
  }
  await setSetting(SettingKey.GoogleRefreshToken, tokens.refresh_token);

  client.setCredentials(tokens);
  let email: string | null = null;
  try {
    const info = await google.oauth2({ version: "v2", auth: client }).userinfo.get();
    email = info.data.email ?? null;
    if (email) await setSetting(SettingKey.GoogleEmail, email);
  } catch {
    // Non-fatal: email is only used for display.
  }
  return { email };
}

/** An authenticated Gmail client using the stored refresh token. */
export async function getGmailClient(): Promise<gmail_v1.Gmail> {
  const refreshToken = await getSetting(SettingKey.GoogleRefreshToken);
  if (!refreshToken) throw new Error("Gmail is not connected.");
  const client = createOAuthClient();
  client.setCredentials({ refresh_token: refreshToken });
  return google.gmail({ version: "v1", auth: client });
}

/** List message ids matching a Gmail search query (handles one page; callers
 *  pass a tight query so one page of 100–500 suffices for incremental sync). */
export async function listMessageIds(
  gmail: gmail_v1.Gmail,
  query: string,
  maxResults = 200,
): Promise<string[]> {
  const res = await gmail.users.messages.list({
    userId: "me",
    q: query,
    maxResults,
  });
  return (res.data.messages ?? []).map((m) => m.id!).filter(Boolean);
}

export async function getMessage(
  gmail: gmail_v1.Gmail,
  id: string,
): Promise<gmail_v1.Schema$Message> {
  const res = await gmail.users.messages.get({ userId: "me", id, format: "full" });
  return res.data;
}

/** Fetch a single attachment's raw bytes (base64url) by id. */
export async function getAttachment(
  gmail: gmail_v1.Gmail,
  messageId: string,
  attachmentId: string,
): Promise<string | null> {
  const res = await gmail.users.messages.attachments.get({
    userId: "me",
    messageId,
    id: attachmentId,
  });
  return res.data.data ?? null;
}
