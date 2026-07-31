import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validateSiteContent } from "../lib/content-validation";
import { detectImageType } from "../lib/image-validation";
import { publishTree } from "../lib/github-admin";

const fixture = JSON.parse(readFileSync(new URL("../content/site-content.json", import.meta.url), "utf8"));

test("current site content satisfies the publishing contract", () => {
  assert.equal(validateSiteContent(fixture), true);
});

test("publishing contract rejects missing and unexpected fields", () => {
  const missing = structuredClone(fixture); delete missing.business.name;
  const unexpected = structuredClone(fixture); unexpected.landing.script = "alert(1)";
  assert.equal(validateSiteContent(missing), false);
  assert.equal(validateSiteContent(unexpected), false);
});

test("publishing contract rejects unsafe image paths and oversized collections", () => {
  const unsafe = structuredClone(fixture); unsafe.landing.beforeImage = "https://attacker.example/file.svg";
  const excessive = structuredClone(fixture); excessive.prices = Array.from({ length: 101 }, () => ({ service: "Test", price: "1" }));
  assert.equal(validateSiteContent(unsafe), false);
  assert.equal(validateSiteContent(excessive), false);
});

test("image signatures recognize only supported formats", () => {
  assert.equal(detectImageType(Uint8Array.from([0xff, 0xd8, 0xff, 0x00])), "jpg");
  assert.equal(detectImageType(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), "png");
  assert.equal(detectImageType(Uint8Array.from([82, 73, 70, 70, 0, 0, 0, 0, 87, 69, 66, 80])), "webp");
  assert.equal(detectImageType(new TextEncoder().encode("not an image")), null);
});

test("atomic publisher rejects a stale editor without writing Git objects", async () => {
  process.env.GITHUB_REPO_OWNER = "owner"; process.env.GITHUB_REPO_NAME = "repo"; process.env.GITHUB_TOKEN = "token"; process.env.GITHUB_BRANCH = "main";
  const originalFetch = globalThis.fetch;
  const currentSha = "a".repeat(40);
  const calls: string[] = [];
  globalThis.fetch = async (input) => {
    const url = String(input); calls.push(url);
    if (url.endsWith("/git/ref/heads/main")) return Response.json({ object: { sha: currentSha } });
    if (url.endsWith(`/git/commits/${currentSha}`)) return Response.json({ sha: currentSha, tree: { sha: "c".repeat(40) }, message: "Previous commit" });
    throw new Error(`Unexpected write request: ${url}`);
  };
  try {
    const result = await publishTree([], "e30=", "b".repeat(40), "11111111-1111-4111-8111-111111111111");
    assert.deepEqual(result, { conflict: true, currentCommit: currentSha });
    assert.equal(calls.length, 2);
  } finally { globalThis.fetch = originalFetch; }
});

test("atomic publisher recognizes an idempotent retry without another commit", async () => {
  const originalFetch = globalThis.fetch;
  const currentSha = "d".repeat(40);
  const publishId = "22222222-2222-4222-8222-222222222222";
  let calls = 0;
  globalThis.fetch = async (input) => {
    calls++;
    const url = String(input);
    if (url.endsWith("/git/ref/heads/main")) return Response.json({ object: { sha: currentSha } });
    if (url.endsWith(`/git/commits/${currentSha}`)) return Response.json({ sha: currentSha, tree: { sha: "e".repeat(40) }, message: `Admin update [publish:${publishId}]` });
    throw new Error(`Unexpected write request: ${url}`);
  };
  try {
    const result = await publishTree([], "e30=", null, publishId);
    assert.deepEqual(result, { commit: currentSha, alreadyPublished: true });
    assert.equal(calls, 2);
  } finally { globalThis.fetch = originalFetch; }
});

test("SEO configuration consistently uses the production domain", () => {
  const sources = ["../app/layout.tsx", "../app/sitemap.ts", "../app/robots.ts"].map((path) => readFileSync(new URL(path, import.meta.url), "utf8")).join("\n");
  assert.match(sources, /https:\/\/www\.hudiksvallsalong\.com/);
  assert.doesNotMatch(sources, /parissalong\.com/);
});

test("verified local business facts remain consistent", () => {
  assert.equal(fixture.prices.find((item: { service: string }) => item.service === "Barn under 9 år")?.price, "180");
  assert.match(fixture.landing.bookingText, /drop-in/i);
  assert.match(fixture.landing.bookingText, /ringa/i);
  assert.equal(fixture.business.address, "Kungsgatan 14");
  assert.equal(fixture.business.phoneHref, "+46720147022");
});
