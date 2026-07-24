import type { AppError } from "@football-api/core";

export function problem(error: AppError, instance?: string) {
  const status = statusFor(error.code);
  return {
    body: {
      type: `https://football-api.local/problems/${error.code.toLowerCase()}`,
      title: error.code,
      status,
      detail: error.message,
      instance,
      code: error.code,
      ...(error.details ? { details: error.details } : {}),
    },
    status,
  };
}

function statusFor(code: AppError["code"]): number {
  switch (code) {
    case "VALIDATION":
      return 400;
    case "NOT_FOUND":
      return 404;
    case "CONFLICT":
      return 409;
    case "QUOTA":
      return 503;
    case "PROVIDER":
    case "UNAVAILABLE":
      return 502;
    default:
      return 500;
  }
}
