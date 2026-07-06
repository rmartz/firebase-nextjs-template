#!/usr/bin/env node
/**
 * Captures a PNG screenshot of every Storybook story for visual acceptance review.
 *
 * Serves the pre-built static Storybook (`storybook-static/`) over a local HTTP
 * server, renders each story's iframe in real Chromium via Playwright, and
 * screenshots it to `screenshots/<id>.png`. Build Storybook first
 * (`pnpm build-storybook`); this script does not build.
 *
 * Output is written to a per-run directory with no shared resource, so it is
 * safe to upload as a CI artifact and never races across concurrent PR runs.
 *
 * Fail-fast, not time-out: each story gets a short render budget, stories are
 * captured concurrently, and the whole run has a wall-clock deadline (below the
 * CI job's `timeout-minutes`). On the deadline the script exits non-zero
 * after any in-flight captures finish. This matters because a job that hits `timeout-minutes` is
 * *cancelled* (which the PR coordinator escalates to a human), whereas a
 * non-zero exit is a *failure* (auto-routed to fix-review). We want the latter.
 *
 * Exits 0 when every story was captured, 1 if the build output is missing, any
 * story failed to render, or the deadline was hit.
 */

import http from "http";
import { chromium } from "playwright";
import { readFileSync, mkdirSync, existsSync } from "fs";
import { readFile } from "fs/promises";
import { join, normalize, extname } from "path";

const staticDir = "storybook-static";
const outDir = "screenshots";
const indexPath = join(staticDir, "index.json");

// Concurrency and timeouts. The deadline is intentionally below the workflow's
// `timeout-minutes` so we fail before the job is cancelled; override in CI with
// CAPTURE_DEADLINE_MS if the story count grows.
const CONCURRENCY = 4;
const NAV_TIMEOUT_MS = 15000;
const RENDER_TIMEOUT_MS = 4000;
const rawDeadline = process.env.CAPTURE_DEADLINE_MS;
if (rawDeadline) {
  const parsed = Number(rawDeadline);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    console.error(
      `error: CAPTURE_DEADLINE_MS must be a positive number, got "${rawDeadline}"`,
    );
    process.exit(1);
  }
}
const DEADLINE_MS = rawDeadline ? Number(rawDeadline) : 4 * 60 * 1000;

if (!existsSync(indexPath)) {
  console.error(
    `error: ${indexPath} not found — run \`pnpm build-storybook\` first.`,
  );
  process.exit(1);
}

mkdirSync(outDir, { recursive: true });

const index = JSON.parse(readFileSync(indexPath, "utf8"));
const stories = Object.values(index.entries ?? {}).filter(
  (entry) => entry.type === "story",
);

const contentTypes = {
  ".css": "text/css",
  ".html": "text/html",
  ".js": "text/javascript",
  ".json": "application/json",
  ".map": "application/json",
  ".mjs": "text/javascript",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ttf": "font/ttf",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

const server = http.createServer(async (req, res) => {
  try {
    const urlPath = decodeURIComponent(
      new URL(req.url, "http://localhost").pathname,
    );
    const filePath = join(
      staticDir,
      normalize(urlPath).replace(/^(\.\.(\/|\\|$))+/, ""),
    );
    const resolved = urlPath.endsWith("/")
      ? join(filePath, "index.html")
      : filePath;
    const data = await readFile(resolved);
    res.writeHead(200, {
      "Content-Type":
        contentTypes[extname(resolved)] ?? "application/octet-stream",
    });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
});

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const { port } = server.address();

const browser = await chromium.launch();
const startedAt = Date.now();

const queue = [...stories];
let captured = 0;
let failed = 0;

async function worker() {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 800 },
  });
  while (queue.length > 0 && Date.now() - startedAt <= DEADLINE_MS) {
    const story = queue.shift();
    if (!story) break;
    const url = `http://127.0.0.1:${port}/iframe.html?id=${encodeURIComponent(story.id)}&viewMode=story`;
    try {
      await page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: NAV_TIMEOUT_MS,
      });
      await page
        .locator("#storybook-root > *")
        .first()
        .waitFor({ state: "visible", timeout: RENDER_TIMEOUT_MS });
      await page.screenshot({ path: join(outDir, `${story.id}.png`) });
      captured += 1;
    } catch (error) {
      console.error(`Failed to capture ${story.id}: ${error.message}`);
      failed += 1;
    }
  }
  await page.close();
}

await Promise.all(Array.from({ length: CONCURRENCY }, worker));

// Any stories left in the queue were dropped by the deadline.
const skipped = queue.length;
await browser.close();
await new Promise((resolve) => server.close(resolve));

const elapsed = Math.round((Date.now() - startedAt) / 1000);
if (skipped > 0) {
  console.error(
    `Deadline (${Math.round(DEADLINE_MS / 1000)}s) hit after ${elapsed}s — ${skipped} story(ies) not attempted. Exiting non-zero so the CI job fails fast rather than being cancelled at its timeout.`,
  );
}
console.log(
  `Captured ${captured}/${stories.length} story screenshot(s) into ${outDir}/ in ${elapsed}s (${failed} failed${skipped ? `, ${skipped} skipped` : ""}).`,
);
process.exit(failed > 0 || skipped > 0 ? 1 : 0);
