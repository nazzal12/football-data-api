export type AppConfig = {
  environment: string;
  apiSportsKey?: string;
  logLevel: "debug" | "info" | "warn" | "error";
};

export type ConfigSource = {
  ENVIRONMENT?: string;
  API_SPORTS_KEY?: string;
  LOG_LEVEL?: string;
};

export function loadConfig(source: ConfigSource): AppConfig {
  const logLevel = source.LOG_LEVEL;
  const allowed = new Set(["debug", "info", "warn", "error"]);
  return {
    environment: source.ENVIRONMENT ?? "development",
    apiSportsKey: source.API_SPORTS_KEY,
    logLevel: logLevel && allowed.has(logLevel) ? (logLevel as AppConfig["logLevel"]) : "info",
  };
}
