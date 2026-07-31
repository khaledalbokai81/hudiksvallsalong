type Attempt = { failures: number; blockedUntil: number; lastSeen: number };

const attempts = new Map<string, Attempt>();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 7;

function clientKey(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip") || "unknown";
}

function cleanup(now: number) {
  if (attempts.size < 500) return;
  for (const [key, value] of attempts) if (now - value.lastSeen > WINDOW_MS * 2) attempts.delete(key);
}

export function loginAllowed(request: Request) {
  const now = Date.now();
  cleanup(now);
  const attempt = attempts.get(clientKey(request));
  return !attempt || attempt.blockedUntil <= now;
}

export function recordLoginFailure(request: Request) {
  const now = Date.now();
  const key = clientKey(request);
  const previous = attempts.get(key);
  const failures = !previous || now - previous.lastSeen > WINDOW_MS ? 1 : previous.failures + 1;
  attempts.set(key, { failures, lastSeen: now, blockedUntil: failures >= MAX_FAILURES ? now + WINDOW_MS : 0 });
}

export function clearLoginFailures(request: Request) {
  attempts.delete(clientKey(request));
}
