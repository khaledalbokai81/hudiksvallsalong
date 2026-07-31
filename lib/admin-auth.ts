import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const ADMIN_COOKIE = process.env.NODE_ENV === "production" ? "__Host-hudik_admin" : "hudik_admin";
export const ADMIN_SESSION_SECONDS = 60 * 60 * 8;

function secret() {
  return process.env.ADMIN_SESSION_SECRET ?? "";
}

function sign(value: string) {
  return createHmac("sha256", secret()).update(value).digest("base64url");
}

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function passwordMatches(candidate: unknown) {
  const expected = process.env.ADMIN_PASSWORD ?? "";
  if (!expected || typeof candidate !== "string" || candidate.length > 512) return false;
  return safeEqual(sign(`password:${candidate}`), sign(`password:${expected}`));
}

export function sessionToken() {
  const issuedAt = Math.floor(Date.now() / 1000);
  const payload = `${issuedAt}.${randomBytes(18).toString("base64url")}`;
  return `${payload}.${sign(`session:${payload}`)}`;
}

export async function isAdmin() {
  if (!process.env.ADMIN_PASSWORD || !secret()) return false;
  const token = (await cookies()).get(ADMIN_COOKIE)?.value ?? "";
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [issuedAtText, nonce, signature] = parts;
  const issuedAt = Number(issuedAtText);
  const age = Math.floor(Date.now() / 1000) - issuedAt;
  if (!Number.isSafeInteger(issuedAt) || age < 0 || age > ADMIN_SESSION_SECONDS || !/^[A-Za-z0-9_-]{24}$/.test(nonce)) return false;
  return safeEqual(signature, sign(`session:${issuedAtText}.${nonce}`));
}

export function isSameOriginAdminRequest(request: Request) {
  if (request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase() !== "application/json") return false;
  if (request.headers.get("x-admin-request") !== "1") return false;
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin") return false;
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return false;
  return Boolean(fetchSite || origin);
}
