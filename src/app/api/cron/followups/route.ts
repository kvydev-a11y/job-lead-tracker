import { NextResponse, connection } from "next/server";
import { revalidatePath } from "next/cache";
import { runFollowUpScan } from "@/lib/followups/engine";

/**
 * Daily follow-up scan. Flags outreach threads quiet past the window and
 * attaches a draft (held for approval). Protected by CRON_SECRET when set.
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

  const summary = await runFollowUpScan();
  if (summary.flagged > 0) {
    for (const p of ["/", "/applications"]) revalidatePath(p);
  }
  return NextResponse.json(summary);
}
