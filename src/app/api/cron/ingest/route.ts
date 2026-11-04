import { NextResponse, connection } from "next/server";
import { revalidatePath } from "next/cache";
import { runIngest } from "@/lib/ingest/ingest";

/**
 * Gmail ingestion endpoint. Intended to be hit by a scheduler (Vercel Cron),
 * which sends `Authorization: Bearer $CRON_SECRET`. Also accepts `?secret=`.
 * If CRON_SECRET is unset (local dev) it runs unauthenticated.
 */
export async function GET(request: Request) {
  // Force request-time execution (never prerendered) under Cache Components.
  await connection();

  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    const qs = new URL(request.url).searchParams.get("secret");
    if (auth !== `Bearer ${secret}` && qs !== secret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const summary = await runIngest();

  if (summary.applications || summary.replies || summary.leads || summary.linkedin || summary.contacts) {
    for (const p of ["/", "/applications", "/leads", "/contacts"]) revalidatePath(p);
  }

  return NextResponse.json(summary);
}
