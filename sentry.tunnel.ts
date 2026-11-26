// Same-origin path of the managed Sentry tunnel, shared by the browser
// `tunnel` option and the server `serveTunnelIntegration` so ad-blockers
// don't drop events. Both sides must use the same value.
export const SENTRY_TUNNEL_PATH = "/monitoring";
