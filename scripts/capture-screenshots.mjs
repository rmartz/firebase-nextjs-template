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
 * Exits 0 on success, 1 if the build output is missing or any story fails to
 * capture (the CI job is advisory, so a non-zero exit does not block the PR).
 */

import http from "http";
import { chromium } from "playwright";
import { readFileSync, mkdirSync, existsSync } from "fs";
import { readFile } from "fs/promises";
import { join, normalize, extname } from "path";

const staticDir = "storybook-static";
const outDir = "screenshots";
const indexPath = join(staticDir, "index.json");

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
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

let failed = 0;
for (const story of stories) {
  const url = `http://127.0.0.1:${port}/iframe.html?id=${encodeURIComponent(story.id)}&viewMode=story`;
  try {
    await page.goto(url, { waitUntil: "networkidle" });
    await page
      .locator("#storybook-root > *")
      .first()
      .waitFor({ timeout: 10000 });
    await page.screenshot({ path: join(outDir, `${story.id}.png`) });
  } catch (error) {
    console.error(`Failed to capture ${story.id}: ${error.message}`);
    failed += 1;
  }
}

await browser.close();
await new Promise((resolve) => server.close(resolve));

console.log(
  `Captured ${stories.length - failed}/${stories.length} story screenshot(s) into ${outDir}/`,
);
process.exit(failed > 0 ? 1 : 0);
