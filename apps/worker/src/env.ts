export type WorkerBindings = {
  META: KVNamespace;
  OBJECTS: R2Bucket;
  API_SPORTS_KEY?: string;
  ADMIN_TOKEN?: string;
  ENVIRONMENT?: string;
  LOG_LEVEL?: string;
  /** Set to "off" to disable the soft client gate (local/debug). */
  ACCESS_GUARD?: string;
  /** Comma-separated cf-worker values allowed to call this API. */
  ALLOWED_CF_WORKERS?: string;
  /** Comma-separated site hostnames allowed via Origin/Referer. */
  ALLOWED_SITE_HOSTS?: string;
};
