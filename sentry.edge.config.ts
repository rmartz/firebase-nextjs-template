import * as Sentry from "@sentry/nextjs";

const enableSensitiveData =
  process.env.NODE_ENV === "development" &&
  process.env["SENTRY_ENABLE_SENSITIVE_DATA"] === "true";

Sentry.init({
  dsn: process.env["SENTRY_DSN"],

  // Gates all PII-bearing collection: user info/IP, cookies, HTTP headers and
  // bodies, database query data, AI/MCP content, and queue arguments. Off by
  // default (the SDK defaults to collecting them); opt in via
  // SENTRY_ENABLE_SENSITIVE_DATA=true (development only).
  dataCollection: {
    cookies: enableSensitiveData,
    databaseQueryData: enableSensitiveData,
    genAI: { inputs: enableSensitiveData, outputs: enableSensitiveData },
    httpBodies: enableSensitiveData
      ? [
          "incomingRequest",
          "incomingResponse",
          "outgoingRequest",
          "outgoingResponse",
        ]
      : [],
    httpHeaders: enableSensitiveData,
    mcp: { inputs: enableSensitiveData, outputs: enableSensitiveData },
    queues: enableSensitiveData,
    userInfo: enableSensitiveData,
  },
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,
});
