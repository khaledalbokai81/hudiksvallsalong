import { isAdmin } from "../../../../lib/admin-auth";
import { getBlob } from "../../../../lib/github-admin";

export async function GET(request: Request) {
  if (!(await isAdmin())) return new Response(null, { status: 401 });
  const sha = new URL(request.url).searchParams.get("sha") ?? "";
  if (!/^[a-f0-9]{40}$/.test(sha)) return new Response(null, { status: 400 });
  try {
    const blob = await getBlob(sha);
    if (blob.encoding !== "base64") return new Response(null, { status: 502 });
    const bytes = Buffer.from(blob.content.replace(/\s/g, ""), "base64");
    const type = bytes[0] === 0xff ? "image/jpeg" : bytes[0] === 0x89 ? "image/png" : "image/webp";
    return new Response(bytes, { headers: { "Content-Type": type, "Cache-Control": "private, max-age=3600", "X-Content-Type-Options": "nosniff" } });
  } catch {
    return new Response(null, { status: 502 });
  }
}
