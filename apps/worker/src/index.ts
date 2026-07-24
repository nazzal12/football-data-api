import { Hono } from "hono";

export type WorkerBindings = {
  META: KVNamespace;
  OBJECTS: R2Bucket;
  API_SPORTS_KEY?: string;
  ENVIRONMENT?: string;
};

const app = new Hono<{ Bindings: WorkerBindings }>();

app.get("/health", (c) => {
  return c.json({
    ok: true,
    service: "football-api",
    environment: c.env.ENVIRONMENT ?? "unknown",
  });
});

export default app;
