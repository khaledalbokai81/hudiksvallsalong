import content from "../../content/site-content.json";
import { isAdmin } from "../../lib/admin-auth";
import { AdminPanel } from "./admin-panel";
import "./admin.css";
import "./admin-isolation.css";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false, noarchive: true } };

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  return <AdminPanel initialContent={content} initiallyAuthenticated={await isAdmin()} initialCommit={process.env.VERCEL_GIT_COMMIT_SHA ?? null} />;
}
