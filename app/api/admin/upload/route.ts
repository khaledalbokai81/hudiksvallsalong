import { NextResponse } from "next/server";
import { isAdmin, isSameOriginAdminRequest } from "../../../../lib/admin-auth";
import { createBlob } from "../../../../lib/github-admin";
import { detectImageType } from "../../../../lib/image-validation";

export const maxDuration = 30;

export async function POST(request: Request) {
  if (!isSameOriginAdminRequest(request)) return NextResponse.json({ error: "Ogiltig förfrågan." }, { status: 403 });
  if (!(await isAdmin())) return NextResponse.json({ error: "Inte inloggad." }, { status: 401 });
  try {
    const { path, content } = await request.json() as { path?: string; content?: string };
    if (!path || !/^public\/images\/admin\/[a-zA-Z0-9._-]+\.(?:jpg|png|webp)$/.test(path) || !content || !/^[A-Za-z0-9+/=]+$/.test(content)) return NextResponse.json({ error: "Ogiltig bildfil." }, { status: 400 });
    const bytes = Buffer.from(content, "base64");
    const detected = detectImageType(bytes);
    if (!bytes.length || bytes.length > 3_000_000) return NextResponse.json({ error: "Bilden är för stor efter optimering." }, { status: 400 });
    if (!detected || path.split(".").pop()?.toLowerCase() !== detected) return NextResponse.json({ error: "Bildens filtyp är inte tillåten." }, { status: 400 });
    const blob = await createBlob(content);
    return NextResponse.json({ ok: true, path, sha: blob.sha });
  } catch (error) {
    console.error("Admin image staging failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Bilden kunde inte laddas upp just nu. Försök igen." }, { status: 503 });
  }
}
