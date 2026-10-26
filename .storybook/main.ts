import type { StorybookConfig } from "@storybook/nextjs-vite";
import babel from "@rolldown/plugin-babel";
import { reactCompilerPreset } from "@vitejs/plugin-react";

const config: StorybookConfig = {
  stories: ["../src/**/*.stories.@(ts|tsx)"],
  addons: [
    "@storybook/addon-a11y",
    "@storybook/addon-docs",
    "@storybook/addon-vitest",
  ],
  framework: "@storybook/nextjs-vite",
  // Render stories through the same React Compiler transform as the Next.js
  // build. It must run first: the compiler only recognizes components while
  // they still contain JSX, before the framework's SWC plugin lowers it.
  viteFinal: (viteConfig) => ({
    ...viteConfig,
    plugins: [
      babel({ presets: [reactCompilerPreset()] }),
      ...(viteConfig.plugins ?? []),
    ],
  }),
};
export default config;
