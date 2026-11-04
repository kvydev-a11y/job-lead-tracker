import { NextResponse } from "next/server";
import { getAuthUrl, googleConfigured } from "@/lib/gmail/client";

export async function GET() {
  if (!googleConfigured()) {
    return NextResponse.json(
      { error: "Google OAuth not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET." },
      { status: 500 },
    );
  }
  return NextResponse.redirect(getAuthUrl());
}
