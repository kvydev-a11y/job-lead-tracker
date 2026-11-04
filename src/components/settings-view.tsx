import { connection } from "next/server";
import { formatDistanceToNowStrict } from "date-fns";
import { Mail, CheckCircle2, AlertTriangle, Plug } from "lucide-react";
import { googleConfigured } from "@/lib/gmail/client";
import { isGmailConnected, getSetting, SettingKey } from "@/lib/settings";
import { GmailControls } from "./gmail-controls";

export async function SettingsView({
  searchParams,
}: {
  searchParams: Promise<{ [k: string]: string | string[] | undefined }>;
}) {
  await connection();
  const sp = await searchParams;
  const configured = googleConfigured();
  const connected = await isGmailConnected();
  const email = connected ? await getSetting(SettingKey.GoogleEmail) : null;
  const lastIngest = await getSetting(SettingKey.GmailLastIngestAt);

  return (
    <div className="space-y-5">
      {sp.connected && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300">
          <CheckCircle2 className="h-4 w-4" /> Gmail connected successfully.
        </div>
      )}
      {sp.error && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300">
          <AlertTriangle className="h-4 w-4" /> Couldn&apos;t connect: {String(sp.error)}
        </div>
      )}

      <section className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800">
            <Mail className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold">Gmail</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Auto-detect application confirmations, recruiter replies, LinkedIn notifications, and
              lead emails (incl. Muse <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">[JOBLEADS]</code> CSVs).
            </p>

            {!configured ? (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
                <p className="font-medium">Setup needed (one-time)</p>
                <p className="mt-1">
                  Add Google OAuth credentials to <code>.env</code> to enable the connection:
                </p>
                <pre className="mt-2 overflow-x-auto rounded bg-amber-100/60 p-2 dark:bg-amber-900/30">{`GOOGLE_CLIENT_ID=…
GOOGLE_CLIENT_SECRET=…
GOOGLE_REDIRECT_URI=http://localhost:3000/api/google/callback`}</pre>
                <p className="mt-2">See the README for the Google Cloud Console steps.</p>
              </div>
            ) : connected ? (
              <div className="mt-4 space-y-4">
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  <span className="font-medium">Connected{email ? ` — ${email}` : ""}</span>
                </div>
                {lastIngest && (
                  <p className="text-xs text-slate-500">
                    Last sync {formatDistanceToNowStrict(new Date(lastIngest), { addSuffix: true })}.
                  </p>
                )}
                <GmailControls />
              </div>
            ) : (
              <a
                href="/api/google/connect"
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3.5 py-2 text-sm font-medium text-white transition hover:bg-slate-700 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
              >
                <Plug className="h-4 w-4" />
                Connect Gmail
              </a>
            )}
          </div>
        </div>
      </section>

      <p className="text-xs text-slate-400">
        Read access is used to classify incoming mail; nothing is sent on your behalf. Follow-up
        drafts (Phase 3) are always held for your approval.
      </p>
    </div>
  );
}
