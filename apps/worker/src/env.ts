export type WorkerBindings = {
  META: KVNamespace;
  OBJECTS: R2Bucket;
  API_SPORTS_KEY?: string;
  ADMIN_TOKEN?: string;
  ENVIRONMENT?: string;
  LOG_LEVEL?: string;
};
