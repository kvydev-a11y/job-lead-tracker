import { NextResponse, connection } from "next/server";
import { revalidatePath } from "next/cache";
import { runFollowUpScan } from "@/lib/followups/engine";
import { prisma } from "@/lib/db";

/** Daily follow-up scan for every user. Protected by CRON_SECRET when set. */
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

  const users = await prisma.user.findMany({ select: { id: true } });
  let scanned = 0;
  let flagged = 0;
  for (const u of users) {
    const s = await runFollowUpScan(u.id);
    scanned += s.scanned;
    flagged += s.flagged;
  }

  if (flagged > 0) {
    for (const p of ["/overview", "/applications"]) revalidatePath(p);
  }
  return NextResponse.json({ users: users.length, scanned, flagged });
}
