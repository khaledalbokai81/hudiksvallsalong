import type { Request, RequestHandler } from "express";

type CachePolicy = {
  ttlMs: number;
  cacheControl: string;
};

type CacheEntry = {
  statusCode: number;
  body: string;
  expiresAt: number;
  cacheControl: string;
};

const publicCachePolicies = new Map<string, CachePolicy>([
  ["/services", { ttlMs: 5 * 60 * 1000, cacheControl: "public, max-age=300, stale-while-revalidate=600" }],
  ["/operational-status", { ttlMs: 10 * 1000, cacheControl: "public, max-age=10, stale-while-revalidate=30" }],
  ["/public-settings", { ttlMs: 5 * 60 * 1000, cacheControl: "public, max-age=300, stale-while-revalidate=600" }],
  ["/availability", { ttlMs: 15 * 1000, cacheControl: "public, max-age=15, stale-while-revalidate=30" }]
]);

const publicApiCache = new Map<string, CacheEntry>();

function hasPrivateRequestState(req: Request) {
  return Boolean(req.header("cookie") || req.header("authorization"));
}

function getPublicCachePolicy(req: Request) {
  if (req.method !== "GET" || hasPrivateRequestState(req)) {
    return undefined;
  }

  return publicCachePolicies.get(req.path);
}

export function isPublicCacheableRequest(req: Request) {
  return Boolean(getPublicCachePolicy(req));
}

function getCacheKey(req: Request) {
  return req.originalUrl;
}

export function clearPublicApiMicrocache(pathPrefix?: string) {
  if (!pathPrefix) {
    publicApiCache.clear();
    return;
  }

  const normalizedPrefix = pathPrefix.startsWith("/api") ? pathPrefix : `/api${pathPrefix}`;

  for (const key of publicApiCache.keys()) {
    if (key === normalizedPrefix || key.startsWith(`${normalizedPrefix}?`)) {
      publicApiCache.delete(key);
    }
  }
}

export const publicApiMicrocache: RequestHandler = (req, res, next) => {
  const policy = getPublicCachePolicy(req);

  if (!policy) {
    next();
    return;
  }

  const cacheKey = getCacheKey(req);
  const cached = publicApiCache.get(cacheKey);

  if (cached && cached.expiresAt > Date.now()) {
    res.status(cached.statusCode);
    res.setHeader("Cache-Control", cached.cacheControl);
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("X-Cache", "HIT");
    res.send(cached.body);
    return;
  }

  if (cached) {
    publicApiCache.delete(cacheKey);
  }

  const originalJson = res.json.bind(res);

  res.setHeader("Cache-Control", policy.cacheControl);
  res.setHeader("X-Cache", "MISS");
  res.json = (body: unknown) => {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      publicApiCache.set(cacheKey, {
        statusCode: res.statusCode,
        body: JSON.stringify(body),
        expiresAt: Date.now() + policy.ttlMs,
        cacheControl: policy.cacheControl
      });
    }

    return originalJson(body);
  };

  next();
};
