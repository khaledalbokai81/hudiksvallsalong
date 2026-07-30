export const config = {
  api: {
    bodyParser: false
  }
};

const hopByHopHeaders = new Set([
  "connection",
  "content-length",
  "host",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade"
]);

function normalizeBackendUrl() {
  const backendUrl = process.env.RENDER_BACKEND_URL;

  if (!backendUrl) {
    throw new Error("RENDER_BACKEND_URL is required for the Vercel API proxy");
  }

  return backendUrl.endsWith("/") ? backendUrl.slice(0, -1) : backendUrl;
}

function getPathSegments(value) {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value === "string" && value.length > 0) {
    return [value];
  }

  return [];
}

function buildTargetUrl(req) {
  const backendUrl = normalizeBackendUrl();
  const path = getPathSegments(req.query.path)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  const target = new URL(`/api/${path}`, backendUrl);

  for (const [key, value] of Object.entries(req.query)) {
    if (key === "path") {
      continue;
    }

    if (Array.isArray(value)) {
      value.forEach((item) => target.searchParams.append(key, item));
    } else if (typeof value === "string") {
      target.searchParams.set(key, value);
    }
  }

  return target;
}

function buildHeaders(req) {
  const headers = new Headers();

  for (const [key, value] of Object.entries(req.headers)) {
    const lowerKey = key.toLowerCase();

    if (hopByHopHeaders.has(lowerKey) || typeof value === "undefined") {
      continue;
    }

    if (Array.isArray(value)) {
      value.forEach((item) => headers.append(key, item));
    } else {
      headers.set(key, value);
    }
  }

  headers.set("x-forwarded-host", req.headers.host || "");
  headers.set("x-forwarded-proto", "https");

  return headers;
}

async function readBody(req) {
  const chunks = [];

  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return chunks.length > 0 ? Buffer.concat(chunks) : undefined;
}

function writeResponseHeaders(res, response) {
  response.headers.forEach((value, key) => {
    const lowerKey = key.toLowerCase();

    if (hopByHopHeaders.has(lowerKey) || lowerKey === "set-cookie") {
      return;
    }

    res.setHeader(key, value);
  });

  const getSetCookie = response.headers.getSetCookie;
  const setCookies =
    typeof getSetCookie === "function"
      ? getSetCookie.call(response.headers)
      : response.headers.get("set-cookie")
        ? [response.headers.get("set-cookie")]
        : [];

  if (setCookies.length > 0) {
    res.setHeader("set-cookie", setCookies);
  }
}

export default async function handler(req, res) {
  let target;

  try {
    target = buildTargetUrl(req);
  } catch (error) {
    res.statusCode = 500;
    res.setHeader("content-type", "application/json");
    res.end(
      JSON.stringify({
        message: error instanceof Error ? error.message : "API proxy is not configured"
      })
    );
    return;
  }

  const method = req.method || "GET";
  const hasBody = method !== "GET" && method !== "HEAD";
  const response = await fetch(target, {
    method,
    headers: buildHeaders(req),
    body: hasBody ? await readBody(req) : undefined
  });

  writeResponseHeaders(res, response);
  res.statusCode = response.status;

  const body = Buffer.from(await response.arrayBuffer());
  res.end(body);
}
