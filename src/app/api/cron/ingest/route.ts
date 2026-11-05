import { NextResponse, connection } from "next/server";
import { revalidatePath } from "next/cache";
import { runIngest } from "@/lib/ingest/ingest";
import { connectedUserIds } from "@/lib/settings";

/**
 * Gmail ingestion for every connected user. Hit by a scheduler (Vercel Cron),
 * which sends `Authorization: Bearer $CRON_SECRET`; `?secret=` also accepted.
 */
export async function GET(request: Request) {
  await connection();

  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    const qs = new URL(request.url).searchParams.get("secret");
    if (auth !== `Bearer ${secret}` && qs !== secret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const ids = await connectedUserIds();
  const totals = {
    users: ids.length,
    applications: 0,
    replies: 0,
    linkedin: 0,
    leads: 0,
    contacts: 0,
    outbound: 0,
    errors: 0,
  };
  for (const uid of ids) {
    const s = await runIngest(uid);
    totals.applications += s.applications;
    totals.replies += s.replies;
    totals.linkedin += s.linkedin;
    totals.leads += s.leads;
    totals.contacts += s.contacts;
    totals.outbound += s.outbound;
    totals.errors += s.errors;
  }

  if (totals.applications || totals.replies || totals.leads || totals.linkedin || totals.contacts) {
    for (const p of ["/overview", "/applications", "/leads", "/contacts"]) revalidatePath(p);
  }
  return NextResponse.json(totals);
}
