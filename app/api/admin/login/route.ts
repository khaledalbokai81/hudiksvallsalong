import { NextResponse } from "next/server";
import { ADMIN_COOKIE, ADMIN_SESSION_SECONDS, isSameOriginAdminRequest, passwordMatches, sessionToken } from "../../../../lib/admin-auth";
import { clearLoginFailures, loginAllowed, recordLoginFailure } from "../../../../lib/login-rate-limit";

export async function POST(request: Request) {
  if (!isSameOriginAdminRequest(request)) return NextResponse.json({ error: "Ogiltig förfrågan." }, { status: 403 });
  if (!loginAllowed(request)) return NextResponse.json({ error: "För många försök. Vänta 15 minuter och försök igen." }, { status: 429, headers: { "Retry-After": "900" } });
  const { password } = await request.json().catch(() => ({ password: "" }));
  if (!passwordMatches(password)) {
    recordLoginFailure(request);
    return NextResponse.json({ error: "Fel lösenord." }, { status: 401 });
  }
  clearLoginFailures(request);
  const response = NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  response.cookies.set(ADMIN_COOKIE, sessionToken(), { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: ADMIN_SESSION_SECONDS, priority: "high" });
  return response;
}
