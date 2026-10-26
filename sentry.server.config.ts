import * as Sentry from "@sentry/nextjs";

const enableSensitiveData =
  process.env.NODE_ENV === "development" &&
  process.env["SENTRY_ENABLE_SENSITIVE_DATA"] === "true";

Sentry.init({
  dsn: process.env["SENTRY_DSN"],

  // Sends IP addresses/user info, cookies, and HTTP headers. Off by default (the
  // SDK defaults to collecting them); opt in via SENTRY_ENABLE_SENSITIVE_DATA=true
  // (development only).
  dataCollection: {
    cookies: enableSensitiveData,
    httpHeaders: enableSensitiveData,
    userInfo: enableSensitiveData,
  },
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,

  // Attach local variable values to stack frames (development + opt-in only)
  includeLocalVariables: enableSensitiveData,
});
