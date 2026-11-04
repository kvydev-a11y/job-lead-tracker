import { NextResponse } from "next/server";
import { exchangeCodeAndStore } from "@/lib/gmail/client";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");
  const base = url.origin;

  if (error) return NextResponse.redirect(`${base}/settings?error=${encodeURIComponent(error)}`);
  if (!code) return NextResponse.redirect(`${base}/settings?error=missing_code`);

  try {
    await exchangeCodeAndStore(code);
    return NextResponse.redirect(`${base}/settings?connected=1`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "exchange_failed";
    return NextResponse.redirect(`${base}/settings?error=${encodeURIComponent(msg)}`);
  }
}
