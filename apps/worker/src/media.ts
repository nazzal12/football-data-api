import type { ObjectStore } from "@football-api/storage";

const MEDIA_KINDS = new Set(["teams", "leagues", "players", "venues"]);

export type MediaKind = "teams" | "leagues" | "players" | "venues";

const UPSTREAM = "https://media.api-sports.io/football";

export function isMediaKind(value: string): value is MediaKind {
  return MEDIA_KINDS.has(value);
}

export function mediaR2Key(kind: MediaKind, externalId: string): string {
  return `media/${kind}/${externalId}.png`;
}

export function upstreamMediaUrl(kind: MediaKind, externalId: string): string {
  return `${UPSTREAM}/${kind}/${externalId}.png`;
}

/** Public Worker URL that serves (and R2-caches) API-Sports media. */
export function publicMediaUrl(
  origin: string,
  kind: MediaKind,
  externalId: string,
): string {
  const base = origin.replace(/\/$/, "");
  return `${base}/v1/media/${kind}/${externalId}.png`;
}

/**
 * Rewrite api-sports CDN URLs to our R2-backed media proxy so clients
 * never hit upstream image hosts directly.
 */
export function rewriteLogoToMediaProxy(
  url: string | undefined | null,
  origin: string,
): string | undefined {
  if (!url) return undefined;
  const trimmed = url.trim();
  if (!trimmed) return undefined;

  const match = trimmed.match(
    /media\.api-sports\.io\/football\/(teams|leagues|players|venues)\/(\d+)\.png/i,
  );
  if (match?.[1] && match[2]) {
    return publicMediaUrl(origin, match[1] as MediaKind, match[2]);
  }

  // Already proxied or third-party HTTPS — keep as-is.
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return undefined;
}

export async function getOrCacheMedia(args: {
  objects: ObjectStore;
  kind: MediaKind;
  externalId: string;
}): Promise<{ body: Uint8Array; cacheHit: boolean; contentType: string }> {
  const key = mediaR2Key(args.kind, args.externalId);
  const cached = await args.objects.get(key);
  if (cached && cached.byteLength > 0) {
    return { body: cached, cacheHit: true, contentType: "image/png" };
  }

  const upstream = upstreamMediaUrl(args.kind, args.externalId);
  const res = await fetch(upstream, {
    headers: { Accept: "image/*" },
  });
  if (!res.ok) {
    throw new Error(`Upstream media ${res.status} for ${args.kind}/${args.externalId}`);
  }
  const buffer = new Uint8Array(await res.arrayBuffer());
  if (buffer.byteLength === 0) {
    throw new Error(`Empty media body for ${args.kind}/${args.externalId}`);
  }

  await args.objects.put(key, buffer, {
    httpMetadata: { contentType: "image/png" },
  });

  return { body: buffer, cacheHit: false, contentType: "image/png" };
}
