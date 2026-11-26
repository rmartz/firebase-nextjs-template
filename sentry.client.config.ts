import * as Sentry from "@sentry/nextjs";
import { SENTRY_TUNNEL_PATH } from "./sentry.tunnel";

const enableSensitiveData =
  process.env.NODE_ENV === "development" &&
  process.env["NEXT_PUBLIC_SENTRY_ENABLE_SENSITIVE_DATA"] === "true";

Sentry.init({
  dsn: process.env["NEXT_PUBLIC_SENTRY_DSN"],

  // Send events through the managed same-origin tunnel (served by
  // serveTunnelIntegration in sentry.server.config.ts) to bypass ad-blockers
  tunnel: { path: SENTRY_TUNNEL_PATH },

  // Gates all PII-bearing collection: user info/IP, cookies, HTTP headers and
  // bodies, database query data, AI/MCP content, and queue arguments. Off by
  // default (the SDK defaults to collecting them); opt in via
  // NEXT_PUBLIC_SENTRY_ENABLE_SENSITIVE_DATA=true (development only).
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
