import { NextResponse } from "next/server";
import { exchangeCodeAndStore } from "@/lib/gmail/client";
import { getUserId } from "@/lib/auth";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const base = url.origin;

  const userId = await getUserId();
  if (!userId) return NextResponse.redirect(`${base}/login`);

  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");
  if (error) return NextResponse.redirect(`${base}/settings?error=${encodeURIComponent(error)}`);
  if (!code) return NextResponse.redirect(`${base}/settings?error=missing_code`);

  try {
    await exchangeCodeAndStore(userId, code);
    return NextResponse.redirect(`${base}/settings?connected=1`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "exchange_failed";
    return NextResponse.redirect(`${base}/settings?error=${encodeURIComponent(msg)}`);
  }
}
