import { validationError } from "@football-api/core";
import type { z } from "zod";

export function parseCanonical<T>(schema: z.ZodType<T>, data: unknown): T {
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    throw validationError("Canonical validation failed", {
      issues: parsed.error.issues,
    });
  }
  return parsed.data;
}
