/**
 * Soft client gate — no API key required.
 * Allows: Flutter (Dart/), site Worker (cf-worker), browser loads from the site
 * (Origin/Referer), health checks, and admin-token requests.
 * Everything else → 403.
 */

const DEFAULT_CF_WORKERS = ["verfutbollibre.net"] as const;
const DEFAULT_SITE_HOSTS = ["verfutbollibre.net"] as const;

export type AccessEnv = {
  ACCESS_GUARD?: string;
  ENVIRONMENT?: string;
  /** Comma-separated cf-worker hostnames (default: verfutbollibre.net). */
  ALLOWED_CF_WORKERS?: string;
  /** Comma-separated site hostnames for Origin/Referer (default: verfutbollibre.net). */
  ALLOWED_SITE_HOSTS?: string;
};

function splitCsv(raw: string | undefined, fallback: readonly string[]): string[] {
  if (!raw?.trim()) return [...fallback];
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

function hostnameFromUrlish(value: string | undefined): string | null {
  if (!value) return null;
  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/** True if host is exactly allowed or a subdomain of an allowed apex. */
export function hostAllowed(host: string, allowedHosts: readonly string[]): boolean {
  const h = host.toLowerCase();
  for (const allowed of allowedHosts) {
    const a = allowed.toLowerCase();
    if (h === a || h.endsWith(`.${a}`)) return true;
  }
  return false;
}

export function isAccessGuardEnabled(env: AccessEnv): boolean {
  if (env.ACCESS_GUARD === "off") return false;
  // Local / non-prod: leave open so wrangler dev and tests stay easy.
  if ((env.ENVIRONMENT ?? "development") !== "production") return false;
  return true;
}

export type AccessDecision =
  | { allowed: true; reason: string }
  | { allowed: false; reason: string };

export function decideAccess(request: Request, env: AccessEnv = {}): AccessDecision {
  const path = new URL(request.url).pathname;
  if (path === "/health" || path === "/") {
    return { allowed: true, reason: "health" };
  }

  // Admin routes authenticate separately via x-admin-token.
  if (request.headers.get("x-admin-token")) {
    return { allowed: true, reason: "admin-token" };
  }

  const ua = request.headers.get("user-agent") ?? "";
  if (ua.startsWith("Dart/")) {
    return { allowed: true, reason: "dart-app" };
  }

  const cfWorkers = splitCsv(env.ALLOWED_CF_WORKERS, DEFAULT_CF_WORKERS);
  const cfWorker = (request.headers.get("cf-worker") ?? "").toLowerCase();
  if (cfWorker && cfWorkers.includes(cfWorker)) {
    return { allowed: true, reason: "cf-worker" };
  }

  const siteHosts = splitCsv(env.ALLOWED_SITE_HOSTS, DEFAULT_SITE_HOSTS);
  const originHost = hostnameFromUrlish(request.headers.get("origin") ?? undefined);
  if (originHost && hostAllowed(originHost, siteHosts)) {
    return { allowed: true, reason: "origin" };
  }
  const refererHost = hostnameFromUrlish(request.headers.get("referer") ?? undefined);
  if (refererHost && hostAllowed(refererHost, siteHosts)) {
    return { allowed: true, reason: "referer" };
  }

  return { allowed: false, reason: "forbidden" };
}
