import { NextResponse } from "next/server";
import { isAdmin, isSameOriginAdminRequest } from "../../../../lib/admin-auth";
import { publishTree } from "../../../../lib/github-admin";
import { validateSiteContent } from "../../../../lib/content-validation";

type StagedUpload = { path: string; sha: string };
export const maxDuration = 30;

export async function POST(request: Request) {
  if (!isSameOriginAdminRequest(request)) return NextResponse.json({ error: "Ogiltig förfrågan." }, { status: 403 });
  if (!(await isAdmin())) return NextResponse.json({ error: "Inte inloggad." }, { status: 401 });
  try {
    const { content, uploads = [], expectedCommit = null, publishId } = await request.json() as { content: unknown; uploads: StagedUpload[]; expectedCommit?: string | null; publishId?: string };
    if (!validateSiteContent(content)) return NextResponse.json({ error: "Innehållet har ett ogiltigt format." }, { status: 400 });
    if (!Array.isArray(uploads) || uploads.length > 30 || !uploads.every((upload) => upload && /^public\/images\/admin\/[a-zA-Z0-9._-]+\.(?:jpg|png|webp)$/.test(upload.path) && /^[a-f0-9]{40}$/.test(upload.sha))) return NextResponse.json({ error: "Bildlistan är ogiltig." }, { status: 400 });
    if (expectedCommit !== null && !/^[a-f0-9]{40}$/.test(expectedCommit)) return NextResponse.json({ error: "Versionsinformationen är ogiltig." }, { status: 400 });
    if (!publishId || !/^[a-f0-9-]{36}$/.test(publishId)) return NextResponse.json({ error: "Publicerings-id saknas." }, { status: 400 });
    const serialized = `${JSON.stringify(content, null, 2)}\n`;
    if (Buffer.byteLength(serialized, "utf8") > 150_000) return NextResponse.json({ error: "Innehållet är för stort." }, { status: 400 });

    const result = await publishTree(uploads, Buffer.from(serialized, "utf8").toString("base64"), expectedCommit, publishId);
    if ("conflict" in result) return NextResponse.json({ error: "Webbplatsen har ändrats sedan sidan öppnades. Ladda om adminpanelen innan du publicerar igen.", currentCommit: result.currentCommit }, { status: 409 });
    return NextResponse.json({ ok: true, commit: result.commit, message: result.alreadyPublished ? "Ändringarna var redan sparade. Vercel bygger webbplatsen." : "Sparat i en säker commit. Vercel bygger nu webbplatsen." });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error("Admin publish failed", detail);
    if (detail === "GitHub configuration is incomplete") {
      return NextResponse.json({ error: "Publicering är inte konfigurerad. Kontrollera GITHUB_TOKEN, GITHUB_REPO_OWNER och GITHUB_REPO_NAME i Vercel och distribuera om." }, { status: 503 });
    }
    if (/^GitHub (401|403):/.test(detail)) {
      return NextResponse.json({ error: "GitHub nekade publiceringen. Kontrollera att token är giltig och har behörigheten Contents: Read and write." }, { status: 503 });
    }
    if (/^GitHub 404:/.test(detail)) {
      return NextResponse.json({ error: "GitHub-repot eller grenen hittades inte. Kontrollera repository owner, name och branch i Vercel." }, { status: 503 });
    }
    return NextResponse.json({ error: "Publiceringen misslyckades tillfälligt. Ditt utkast finns kvar – försök igen." }, { status: 503 });
  }
}
