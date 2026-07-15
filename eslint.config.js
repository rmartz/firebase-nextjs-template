import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import storybook from "eslint-plugin-storybook";
import boundaries from "eslint-plugin-boundaries";

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      "**/.next/**",
      "**/next-env.d.ts",
      ".storybook/**",
      ".claude/**",
      ".git-worktrees/**",
      "storybook-static/**",
      "vitest.config.mts",
      "src/components/ui/**",
    ],
  },
  js.configs.recommended,
  {
    files: ["src/**/*.{ts,tsx}", "*.{ts,tsx}"],
    extends: [
      ...tseslint.configs.strictTypeChecked,
      ...tseslint.configs.stylisticTypeChecked,
    ],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
      parserOptions: {
        project: ["./tsconfig.json"],
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ["src/**/*.{ts,tsx}", "*.{ts,tsx}"],
    plugins: {
      "react-hooks": reactHooks,
    },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "error",
    },
  },
  // Statically enforce the AGENTS.md "Code Conventions" that were previously only
  // caught by /review. All core ESLint / typescript-eslint — no new dependency.
  {
    files: ["src/**/*.{ts,tsx}", "*.{ts,tsx}"],
    rules: {
      // "No function-style imports": prefer module-level `import type`.
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "separate-type-imports" },
      ],
      "@typescript-eslint/no-import-type-side-effects": "error",
      "no-restricted-syntax": [
        "error",
        {
          selector: "TSImportType",
          message:
            'No function-style imports: use a module-level `import type { … } from "…"`, not `import("…")` in type position.',
        },
        {
          selector:
            "CallExpression[callee.type='FunctionExpression'], CallExpression[callee.type='ArrowFunctionExpression']",
          message:
            "No IIFEs: extract the logic into a named helper or compute it with a plain expression.",
        },
        {
          selector: "CallExpression[callee.property.name='then']",
          message: "Use async/await, not `.then()` chains.",
        },
        {
          selector: "CallExpression[callee.name='test']",
          message: "Use `it()` from Vitest, not `test()`.",
        },
        {
          selector: "CallExpression[callee.property.name='toBeInTheDocument']",
          message:
            "Do not use `.toBeInTheDocument()` — use `.toBeDefined()` or check `.textContent`.",
        },
      ],
    },
  },
  {
    files: ["**/*.{js,mjs,cjs}"],
    extends: [...tseslint.configs.recommended],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
  },
  // Root-level framework config files (Sentry, Next.js) use SDK types that don't
  // resolve cleanly under strictTypeChecked — relax unsafe-call/member rules
  {
    files: ["sentry.*.config.ts", "instrumentation.ts", "next.config.ts"],
    rules: {
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
    },
  },
  // Test files use Response.json() which inherently returns `any`; relax unsafe rules
  {
    files: ["src/**/*.spec.ts", "src/**/*.spec.tsx"],
    rules: {
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
      "@typescript-eslint/restrict-template-expressions": "off",
      "@typescript-eslint/no-non-null-assertion": "off",
    },
  },
  // Storybook stories use loose patterns; skip strict type checking
  {
    files: ["src/**/*.stories.tsx"],
    rules: {
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
      "@typescript-eslint/restrict-template-expressions": "off",
    },
  },
  ...storybook.configs["flat/recommended"],
  // Vertical boundaries (eslint-plugin-boundaries) — POC for the agent-legibility
  // epic (#161 / #169). A domain vertical exposes a public interface via its
  // index barrel; outside code must import through it, not deep-import the
  // vertical's internals. This keeps a vertical's coupling visible and refactors
  // local. Currently guards `src/auth`; add each new domain vertical to the
  // `vertical` element list as it appears. `code` is everything else under src/
  // (routes, shared/infra) and is left unrestricted for now — layering rules
  // (shared must not import app/verticals) are a follow-up once more verticals
  // exist to calibrate against.
  {
    files: ["src/**/*.{ts,tsx}"],
    plugins: { boundaries },
    settings: {
      "import/resolver": { typescript: { alwaysTryTypes: true } },
      "boundaries/elements": [
        { type: "vertical", pattern: "src/auth", partialMatch: true },
        { type: "code", pattern: "src/*", partialMatch: true },
      ],
    },
    rules: {
      "boundaries/dependencies": [
        "error",
        {
          default: "disallow",
          policies: [
            // Anything may import shared "code" (routes, lib, hooks, store, …).
            {
              from: { element: { type: "*" } },
              allow: { to: { element: { type: "code" } } },
            },
            // A vertical may import its own internals and other verticals.
            {
              from: { element: { type: "vertical" } },
              allow: { to: { element: { type: "vertical" } } },
            },
            // Outside code may import a vertical ONLY through its index barrel.
            {
              from: { element: { type: "code" } },
              allow: {
                to: {
                  element: { type: "vertical", fileInternalPath: "index.ts" },
                },
              },
            },
          ],
        },
      ],
    },
  },
  // File-length hard cap (replaces the file-length.yml CI job +
  // scripts/check-file-length.sh). Enforced in-editor and via `pnpm lint` (the
  // Lint CI job). Source 400, tests 600 — 2x the recommended ~200/~300 split-at
  // targets in AGENTS.md. Counts every line (blank + comment).
  {
    files: ["**/*.{ts,tsx}"],
    rules: {
      "max-lines": [
        "error",
        { max: 400, skipBlankLines: false, skipComments: false },
      ],
    },
  },
  // Test files (and shared fixtures under a `*-tests/` dir) get the higher cap.
  // Listed after the base block so it wins for these files (last match wins).
  {
    files: ["**/*.spec.{ts,tsx}", "**/*-tests/**/*.{ts,tsx}"],
    rules: {
      "max-lines": [
        "error",
        { max: 600, skipBlankLines: false, skipComments: false },
      ],
    },
  },
);
