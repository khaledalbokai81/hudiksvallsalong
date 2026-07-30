import { config } from "./config.js";

export function sanitizeLoggedPath(value: string, maxLength = 500) {
  const trimmedPath = value.trim();

  if (!trimmedPath) {
    return "/";
  }

  function normalizePath(path: string) {
    const normalizedPath = path || "/";
    const rootedPath = normalizedPath.startsWith("/") ? normalizedPath : `/${normalizedPath}`;

    return rootedPath.slice(0, maxLength);
  }

  try {
    const url = new URL(trimmedPath, config.APP_BASE_URL);

    return normalizePath(url.pathname);
  } catch {
    const pathWithoutFragment = trimmedPath.split("#", 1)[0] || "/";
    const pathWithoutQuery = pathWithoutFragment.split("?", 1)[0] || "/";

    return normalizePath(pathWithoutQuery);
  }
}
