import type { RequestHandler } from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import helmet from "helmet";
import { createHash } from "node:crypto";
import { config, getAllowedOrigins } from "../config.js";
import { createHttpError } from "./errorHandling.js";
import { MongoRateLimitStore } from "../mongoRateLimitStore.js";
import { isPublicCacheableRequest } from "./publicCache.js";

function createRateLimitMessage(message: string) {
  return {
    message,
    error: {
      code: "RATE_LIMITED",
      message
    }
  };
}

function hashRateLimitPart(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 24);
}

export const securityHeaders = helmet({
  contentSecurityPolicy:
    config.NODE_ENV === "production"
      ? {
          useDefaults: true,
          directives: {
            "default-src": ["'self'"],
            "base-uri": ["'self'"],
            "form-action": ["'self'"],
            "frame-ancestors": ["'none'"],
            "object-src": ["'none'"],
            "script-src": ["'self'"],
            "style-src": ["'self'", "'unsafe-inline'"],
            "img-src": ["'self'", "data:", "blob:"],
            "connect-src": ["'self'", ...Array.from(getAllowedOrigins())],
            "font-src": ["'self'", "data:"],
            "upgrade-insecure-requests": []
          }
        }
      : false,
  crossOriginEmbedderPolicy: false,
  referrerPolicy: { policy: "strict-origin-when-cross-origin" }
});

export function createCorsOptions() {
  const allowedOrigins = getAllowedOrigins();

  return {
    origin(origin: string | undefined, callback: (error: Error | null, allow?: boolean) => void) {
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }

      callback(createHttpError(403, "Origin is not allowed", "CORS_ORIGIN_DENIED"));
    }
  };
}

export const noStoreApiResponses: RequestHandler = (req, res, next) => {
  if (!isPublicCacheableRequest(req)) {
    res.setHeader("Cache-Control", "no-store");
  }

  next();
};

export const requestTimeout: RequestHandler = (req, res, next) => {
  req.setTimeout(15_000);
  res.setTimeout(20_000);
  next();
};

export function shouldApplyGlobalApiLimiter(req: Parameters<RequestHandler>[0]) {
  if (req.path === "/health" || req.path === "/ready") {
    return false;
  }

  return req.method !== "GET" && req.method !== "HEAD" && req.method !== "OPTIONS";
}

export const apiLimiter = rateLimit({
  windowMs: config.API_RATE_LIMIT_WINDOW_MS,
  limit: config.API_RATE_LIMIT_MAX,
  store: new MongoRateLimitStore("api"),
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: createRateLimitMessage("Too many requests. Please try again shortly.")
});

export const bookingCreateLimiter = rateLimit({
  windowMs: config.BOOKING_RATE_LIMIT_WINDOW_MS,
  limit: config.BOOKING_RATE_LIMIT_MAX,
  store: new MongoRateLimitStore("booking-create"),
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: createRateLimitMessage("Too many booking requests. Please try again later."),
  keyGenerator: (req) => {
    const email = typeof req.body?.email === "string" ? req.body.email.toLowerCase().trim() : "";
    return `${ipKeyGenerator(req.ip || "")}:${email}`;
  }
});

export const magicLinkLimiter = rateLimit({
  windowMs: config.MAGIC_LINK_RATE_LIMIT_WINDOW_MS,
  limit: config.MAGIC_LINK_RATE_LIMIT_MAX,
  store: new MongoRateLimitStore("magic-link"),
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: createRateLimitMessage("Too many magic link requests. Please try again shortly."),
  keyGenerator: (req) => {
    const token = typeof req.body?.token === "string" ? req.body.token.trim() : "";
    const tokenPart = token ? hashRateLimitPart(token) : "missing";

    return `${ipKeyGenerator(req.ip || "")}:${tokenPart}`;
  }
});

export const frontendTelemetryLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 120,
  store: new MongoRateLimitStore("frontend-telemetry"),
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: createRateLimitMessage("Too many telemetry events. Please try again shortly.")
});

export const adminLoginLimiter = rateLimit({
  windowMs: config.ADMIN_LOGIN_RATE_LIMIT_WINDOW_MS,
  limit: config.ADMIN_LOGIN_RATE_LIMIT_MAX,
  store: new MongoRateLimitStore("admin-login"),
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: createRateLimitMessage("Too many admin login attempts. Please try again shortly.")
});

export const adminMutationLimiter = rateLimit({
  windowMs: config.ADMIN_MUTATION_RATE_LIMIT_WINDOW_MS,
  limit: config.ADMIN_MUTATION_RATE_LIMIT_MAX,
  store: new MongoRateLimitStore("admin-mutation"),
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: createRateLimitMessage("Too many admin changes. Please try again shortly.")
});
