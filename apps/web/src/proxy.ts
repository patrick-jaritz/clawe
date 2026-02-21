import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyToken } from "@/lib/auth/verify-token";

const AUTH_PROVIDER = process.env.NEXT_PUBLIC_AUTH_PROVIDER ?? "nextauth";

const PUBLIC_PATHS = ["/auth/login", "/api/auth", "/api/health"];

function extractToken(request: NextRequest): string | null {
  if (AUTH_PROVIDER === "nextauth") {
    const cookie =
      request.cookies.get("authjs.session-token") ??
      request.cookies.get("__Secure-authjs.session-token");
    return cookie?.value ?? null;
  }

  // Cognito: token is in the Authorization header (API routes only).
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice(7);
}

function unauthorized(message: string) {
  return new NextResponse(JSON.stringify({ error: message }), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  });
}

export async function proxy(_request: NextRequest) {
  // CENTAUR: Auth disabled — access secured at network level by Tailscale.
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
