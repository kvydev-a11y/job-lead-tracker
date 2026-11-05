import { NextResponse } from "next/server";
import { getAuthUrl, googleConfigured } from "@/lib/gmail/client";
import { getUserId } from "@/lib/auth";

export async function GET(request: Request) {
  const userId = await getUserId();
  if (!userId) return NextResponse.redirect(new URL("/login", request.url));
  if (!googleConfigured()) {
    return NextResponse.json(
      { error: "Google OAuth not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET." },
      { status: 500 },
    );
  }
  return NextResponse.redirect(getAuthUrl());
}
