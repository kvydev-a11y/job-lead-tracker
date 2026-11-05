import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";

// Public, unauthenticated routes. Everything else requires a session.
const PUBLIC = new Set(["/", "/login", "/signup"]);

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const userId = await verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);

  if (userId && (pathname === "/" || pathname === "/login" || pathname === "/signup")) {
    return NextResponse.redirect(new URL("/overview", req.url));
  }
  if (!userId && !PUBLIC.has(pathname)) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  return NextResponse.next();
}

export const config = {
  // Run on page routes only — skip API routes (OAuth callback, crons) and assets.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.).*)"],
};
