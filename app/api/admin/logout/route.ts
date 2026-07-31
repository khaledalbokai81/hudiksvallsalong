import { NextResponse } from "next/server";
import { ADMIN_COOKIE, isSameOriginAdminRequest } from "../../../../lib/admin-auth";

export async function POST(request: Request) {
  if (!isSameOriginAdminRequest(request)) return NextResponse.json({ error: "Ogiltig förfrågan." }, { status: 403 });
  const response = NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  response.cookies.set(ADMIN_COOKIE, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: 0 });
  return response;
}
