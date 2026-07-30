import bcrypt from "bcryptjs";
import type { RequestHandler } from "express";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { config } from "../config.js";
import { AuthSession, type AuthSessionRole } from "../models/AuthSession.js";
import { LoginAttempt, type LoginAttemptScope } from "../models/LoginAttempt.js";
import { createHttpError } from "./errorHandling.js";

const adminSessionCookieName = "admin_session";
const monitorSessionCookieName = "monitor_session";

type AdminSessionCookie = {
  sessionId: string;
  expiresAt: number;
  version: string;
  signature: string;
};

type SessionOptions = {
  cookieName: string;
  passwordHash: string;
  sessionSecret: string;
  sessionVersion: string;
  ttlHours: number;
  role: AuthSessionRole;
};

const loginAttemptWindowMs = 60 * 60 * 1000;
const loginCooldowns = [
  { failures: 5, cooldownMs: 15 * 60 * 1000 },
  { failures: 8, cooldownMs: 60 * 60 * 1000 },
  { failures: 12, cooldownMs: 6 * 60 * 60 * 1000 }
] as const;

function getSessionMaxAgeMs(ttlHours: number) {
  return ttlHours * 60 * 60 * 1000;
}

function getSessionVersion(passwordHash: string, sessionVersion: string) {
  const passwordFingerprint = createHash("sha256")
    .update(passwordHash)
    .digest("hex")
    .slice(0, 16);

  return `${sessionVersion}:${passwordFingerprint}`;
}

function getAdminSessionOptions(): SessionOptions {
  return {
    cookieName: adminSessionCookieName,
    passwordHash: config.ADMIN_PASSWORD_HASH,
    sessionSecret: config.ADMIN_SESSION_SECRET,
    sessionVersion: config.ADMIN_SESSION_VERSION,
    ttlHours: config.ADMIN_SESSION_TTL_HOURS,
    role: "admin"
  };
}

function getMonitorSessionOptions(): SessionOptions {
  return {
    cookieName: monitorSessionCookieName,
    passwordHash: config.MONITOR_PASSWORD_HASH || config.ADMIN_PASSWORD_HASH,
    sessionSecret: config.MONITOR_SESSION_SECRET || config.ADMIN_SESSION_SECRET,
    sessionVersion: config.MONITOR_SESSION_VERSION,
    ttlHours: config.MONITOR_SESSION_TTL_HOURS,
    role: "monitor"
  };
}

function encodeAdminSession(session: AdminSessionCookie) {
  return Buffer.from(JSON.stringify(session), "utf8").toString("base64url");
}

function signSession(
  session: Pick<AdminSessionCookie, "sessionId" | "expiresAt" | "version">,
  sessionSecret: string
) {
  return createHmac("sha256", sessionSecret)
    .update(`${session.sessionId}.${session.expiresAt}.${session.version}`)
    .digest("hex");
}

function decodeAdminSession(value: string): AdminSessionCookie | null {
  try {
    const session = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as Partial<AdminSessionCookie>;

    if (
      typeof session.sessionId !== "string" ||
      session.sessionId.length !== 64 ||
      typeof session.expiresAt !== "number" ||
      !Number.isFinite(session.expiresAt) ||
      typeof session.version !== "string" ||
      typeof session.signature !== "string"
    ) {
      return null;
    }

    return {
      sessionId: session.sessionId,
      expiresAt: session.expiresAt,
      version: session.version,
      signature: session.signature
    };
  } catch {
    return null;
  }
}

function getSignedSessionId(req: Parameters<RequestHandler>[0], cookieName: string) {
  const signedCookies = req.signedCookies as Record<string, string | undefined> | undefined;
  return signedCookies?.[cookieName];
}

function getSessionHash(sessionId: string, sessionSecret: string) {
  return createHmac("sha256", sessionSecret).update(sessionId).digest("hex");
}

async function getValidatedSession(req: Parameters<RequestHandler>[0], options: SessionOptions) {
  const signedSession = getSignedSessionId(req, options.cookieName);

  if (!signedSession) {
    return null;
  }

  const session = decodeAdminSession(signedSession);

  if (!session) {
    return null;
  }

  const expectedSignature = signSession(session, options.sessionSecret);
  const expectedVersion = getSessionVersion(options.passwordHash, options.sessionVersion);

  if (
    session.expiresAt <= Date.now() ||
    session.version !== expectedVersion ||
    !isMatchingHex(session.signature, expectedSignature)
  ) {
    return null;
  }

  const sessionRecord = await AuthSession.findOne({
    sessionHash: getSessionHash(session.sessionId, options.sessionSecret),
    role: options.role,
    version: expectedVersion,
    revokedAt: { $exists: false },
    expiresAt: { $gt: new Date() }
  }).select("_id lastSeenAt");

  if (!sessionRecord) {
    return null;
  }

  if (Date.now() - sessionRecord.lastSeenAt.getTime() > 5 * 60 * 1000) {
    sessionRecord.lastSeenAt = new Date();
    await sessionRecord.save();
  }

  return session;
}

async function isValidSession(req: Parameters<RequestHandler>[0], options: SessionOptions) {
  return Boolean(await getValidatedSession(req, options));
}

async function isValidAdminSession(req: Parameters<RequestHandler>[0]) {
  return isValidSession(req, getAdminSessionOptions());
}

async function isValidMonitorSession(req: Parameters<RequestHandler>[0]) {
  return isValidSession(req, getMonitorSessionOptions());
}

export async function isAdminAuthenticated(req: Parameters<RequestHandler>[0]) {
  return isValidAdminSession(req);
}

export async function isMonitorAuthenticated(req: Parameters<RequestHandler>[0]) {
  return isValidMonitorSession(req);
}

async function getCsrfToken(req: Parameters<RequestHandler>[0], options: SessionOptions) {
  const signedSession = getSignedSessionId(req, options.cookieName);

  if (!signedSession || !(await isValidSession(req, options))) {
    return null;
  }

  return createHmac("sha256", options.sessionSecret).update(signedSession).digest("hex");
}

export function getAdminCsrfToken(req: Parameters<RequestHandler>[0]) {
  return getCsrfToken(req, getAdminSessionOptions());
}

export function getMonitorCsrfToken(req: Parameters<RequestHandler>[0]) {
  return getCsrfToken(req, getMonitorSessionOptions());
}

function isMatchingHex(left: string, right: string) {
  const leftBuffer = Buffer.from(left, "hex");
  const rightBuffer = Buffer.from(right, "hex");

  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

async function verifyPassword(password: string, passwordHash: string) {
  const isMatch = await bcrypt.compare(password, passwordHash);

  if (!isMatch) {
    const dummy = "$2b$12$C6UzMDM.H6dfI/f/IKcEeOZ21YQec4q2nFiULa46Nhkn3Vthk7Yne";
    await bcrypt.compare(password, dummy);
  }

  return isMatch;
}

export function verifyAdminPassword(password: string) {
  return verifyPassword(password, config.ADMIN_PASSWORD_HASH);
}

export function verifyMonitorPassword(password: string) {
  return verifyPassword(password, getMonitorSessionOptions().passwordHash);
}

function getLoginAttemptKey(scope: LoginAttemptScope, req: Parameters<RequestHandler>[0]) {
  const ip = req.ip || "unknown";
  return createHash("sha256").update(`${scope}:${ip}`).digest("hex");
}

function getCooldownMs(failures: number) {
  return [...loginCooldowns]
    .reverse()
    .find((cooldown) => failures >= cooldown.failures)?.cooldownMs;
}

export async function assertLoginAllowed(
  scope: LoginAttemptScope,
  req: Parameters<RequestHandler>[0]
) {
  const attempt = await LoginAttempt.findOne({ key: getLoginAttemptKey(scope, req) })
    .select("lockedUntil")
    .lean<{ lockedUntil?: Date }>();

  if (attempt?.lockedUntil && attempt.lockedUntil.getTime() > Date.now()) {
    throw createHttpError(
      429,
      "Too many login attempts. Please try again later.",
      "LOGIN_COOLDOWN_ACTIVE"
    );
  }
}

export async function recordLoginFailure(
  scope: LoginAttemptScope,
  req: Parameters<RequestHandler>[0]
) {
  const now = new Date();
  const key = getLoginAttemptKey(scope, req);
  const expiresAt = new Date(now.getTime() + loginAttemptWindowMs);
  const attempt = await LoginAttempt.findOneAndUpdate(
    { key },
    {
      $setOnInsert: {
        key,
        scope,
        ip: req.ip,
        userAgent: req.header("user-agent")
      },
      $set: {
        lastFailureAt: now,
        expiresAt
      },
      $inc: { failures: 1 }
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  const cooldownMs = getCooldownMs(attempt.failures);

  if (cooldownMs) {
    attempt.lockedUntil = new Date(now.getTime() + cooldownMs);
    await attempt.save();
  }
}

export async function clearLoginFailures(
  scope: LoginAttemptScope,
  req: Parameters<RequestHandler>[0]
) {
  await LoginAttempt.deleteOne({ key: getLoginAttemptKey(scope, req) });
}

async function createSession(
  req: Parameters<RequestHandler>[0],
  res: Parameters<RequestHandler>[1],
  options: SessionOptions
) {
  const sessionId = randomBytes(32).toString("hex");
  const maxAge = getSessionMaxAgeMs(options.ttlHours);
  const expiresAt = Date.now() + maxAge;
  const unsignedSession = {
    sessionId,
    expiresAt,
    version: getSessionVersion(options.passwordHash, options.sessionVersion)
  };
  const session = encodeAdminSession({
    ...unsignedSession,
    signature: signSession(unsignedSession, options.sessionSecret)
  });

  await AuthSession.create({
    sessionHash: getSessionHash(sessionId, options.sessionSecret),
    role: options.role,
    version: unsignedSession.version,
    expiresAt: new Date(expiresAt),
    lastSeenAt: new Date(),
    ip: req.ip,
    userAgent: req.header("user-agent")
  });

  res.cookie(options.cookieName, session, {
    httpOnly: true,
    signed: true,
    sameSite: "lax",
    secure: config.NODE_ENV === "production",
    maxAge,
    path: "/"
  });
}

export function createAdminSession(
  req: Parameters<RequestHandler>[0],
  res: Parameters<RequestHandler>[1]
) {
  return createSession(req, res, getAdminSessionOptions());
}

export function createMonitorSession(
  req: Parameters<RequestHandler>[0],
  res: Parameters<RequestHandler>[1]
) {
  return createSession(req, res, getMonitorSessionOptions());
}

async function clearSession(
  req: Parameters<RequestHandler>[0],
  res: Parameters<RequestHandler>[1],
  options: SessionOptions
) {
  const signedSession = getSignedSessionId(req, options.cookieName);
  const session = signedSession ? decodeAdminSession(signedSession) : null;

  if (session) {
    await AuthSession.updateOne(
      {
        sessionHash: getSessionHash(session.sessionId, options.sessionSecret),
        role: options.role,
        revokedAt: { $exists: false }
      },
      { $set: { revokedAt: new Date() } }
    );
  }

  res.clearCookie(options.cookieName, {
    httpOnly: true,
    signed: true,
    sameSite: "lax",
    secure: config.NODE_ENV === "production",
    path: "/"
  });
}

export function clearAdminSession(
  req: Parameters<RequestHandler>[0],
  res: Parameters<RequestHandler>[1]
) {
  return clearSession(req, res, getAdminSessionOptions());
}

export function clearMonitorSession(
  req: Parameters<RequestHandler>[0],
  res: Parameters<RequestHandler>[1]
) {
  return clearSession(req, res, getMonitorSessionOptions());
}

export const requireAdminAuth: RequestHandler = (req, _res, next) => {
  void (async () => {
    if (await isValidAdminSession(req)) {
      next();
      return;
    }

    next(createHttpError(401, "Admin login is required", "ADMIN_AUTH_REQUIRED"));
  })().catch(next);
};

export const requireMonitorAuth: RequestHandler = (req, _res, next) => {
  void (async () => {
    if (await isValidMonitorSession(req)) {
      next();
      return;
    }

    next(createHttpError(401, "Monitor login is required", "MONITOR_AUTH_REQUIRED"));
  })().catch(next);
};

async function requireCsrf(
  req: Parameters<RequestHandler>[0],
  next: Parameters<RequestHandler>[2],
  expectedToken: string | null,
  message: string,
  code: string
) {
  const providedToken = req.header("x-csrf-token");

  if (
    expectedToken &&
    providedToken &&
    /^[a-f0-9]{64}$/i.test(providedToken) &&
    isMatchingHex(expectedToken, providedToken)
  ) {
    next();
    return;
  }

  next(createHttpError(403, message, code));
}

export const requireAdminCsrf: RequestHandler = (req, _res, next) => {
  void (async () => {
    await requireCsrf(
      req,
      next,
      await getAdminCsrfToken(req),
      "Admin CSRF token is invalid or missing",
      "ADMIN_CSRF_REQUIRED"
    );
  })().catch(next);
};

export const requireMonitorCsrf: RequestHandler = (req, _res, next) => {
  void (async () => {
    await requireCsrf(
      req,
      next,
      await getMonitorCsrfToken(req),
      "Monitor CSRF token is invalid or missing",
      "MONITOR_CSRF_REQUIRED"
    );
  })().catch(next);
};
