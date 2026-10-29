import { defineConfig } from "vitest/config";
import path from "path";
import babel from "@rolldown/plugin-babel";
import { reactCompilerPreset } from "@vitejs/plugin-react";

// Run React code under test through the same React Compiler transform that
// `reactCompiler: true` applies in the Next.js build. @babel/core stays on 7.x:
// babel-plugin-react-compiler 1.0 bails on Babel 8's AST for destructured
// prop defaults, silently skipping those components.
const reactCompiler = babel({ presets: [reactCompilerPreset()] });

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "node",
          environment: "node",
          include: ["src/**/*.spec.ts"],
          exclude: ["src/hooks/**/*.spec.ts"],
        },
        resolve: {
          alias: { "@": path.resolve(import.meta.dirname, "./src") },
        },
      },
      {
        plugins: [reactCompiler],
        test: {
          name: "hooks",
          environment: "happy-dom",
          include: ["src/hooks/**/*.spec.ts"],
        },
        resolve: {
          alias: { "@": path.resolve(import.meta.dirname, "./src") },
        },
      },
      {
        plugins: [reactCompiler],
        test: {
          name: "components",
          environment: "happy-dom",
          include: ["src/**/*.spec.tsx"],
        },
        resolve: {
          alias: { "@": path.resolve(import.meta.dirname, "./src") },
        },
      },
      {
        test: {
          name: "scripts",
          environment: "node",
          include: ["scripts/**/*.spec.mjs"],
        },
      },
    ],
  },
});
