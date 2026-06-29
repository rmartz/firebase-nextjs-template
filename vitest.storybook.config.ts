import { defineConfig } from "vitest/config";
import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import { playwright } from "@vitest/browser-playwright";
import path from "path";

// Browser-mode Vitest config that runs the Storybook stories in a real browser
// (Chromium via Playwright). Kept separate from vitest.config.ts so the default
// `pnpm test` stays headless and never needs Playwright — only the dedicated
// `Storybook Tests` CI job installs the browser and runs this config.
// addon-vitest (since Storybook 10.3) applies the project's preview annotations
// automatically, so no setup file is needed.
export default defineConfig({
  plugins: [
    storybookTest({
      configDir: path.join(import.meta.dirname, ".storybook"),
    }),
  ],
  test: {
    name: "storybook",
    browser: {
      enabled: true,
      provider: playwright(),
      headless: true,
      instances: [{ browser: "chromium" }],
    },
  },
});
