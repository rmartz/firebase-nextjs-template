# Firebase + Next.js Template

A template repository for building Next.js applications with Firebase, deployed on Vercel. Includes opinionated tooling for testing, linting, formatting, component development, and CI/CD.

## Stack

| Layer           | Technology                                                                                                              | Purpose                                        |
| --------------- | ----------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| Framework       | [Next.js](https://nextjs.org/) (App Router)                                                                             | Fullstack React with SSR/API routes            |
| Language        | TypeScript (strict mode)                                                                                                | Type safety throughout                         |
| Package Manager | [pnpm](https://pnpm.io/)                                                                                                | Fast, disk-efficient dependency management     |
| UI Components   | [ShadCN UI](https://ui.shadcn.com/) + [Tailwind CSS](https://tailwindcss.com/)                                          | Composable, accessible component primitives    |
| State (server)  | [TanStack Query](https://tanstack.com/query)                                                                            | Server state caching, polling, invalidation    |
| State (client)  | [Redux Toolkit](https://redux-toolkit.js.org/)                                                                          | Local UI state                                 |
| Database        | [Firebase Realtime Database](https://firebase.google.com/docs/database)                                                 | Persistent storage with real-time push         |
| Auth            | Firebase Admin SDK (server)                                                                                             | Session-based auth via API routes              |
| Hosting         | [Vercel](https://vercel.com/)                                                                                           | Deployment, preview URLs, edge functions       |
| Testing         | [Vitest](https://vitest.dev/) + [@testing-library/react](https://testing-library.com/docs/react-testing-library/intro/) | Unit, component, and integration tests         |
| Visual Testing  | [Storybook](https://storybook.js.org/)                                                                                  | Component development and visual documentation |
| CI/CD           | GitHub Actions                                                                                                          | Lint, format, test, build on every PR          |
| Monitoring      | [Sentry](https://sentry.io/)                                                                                            | Error tracking (client + server + edge)        |

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v24+
- [pnpm](https://pnpm.io/) v10+
- A [Firebase project](https://console.firebase.google.com/) with Realtime Database enabled
- A [Vercel account](https://vercel.com/) (for deployment)

### Create a New Project

1. Click **"Use this template"** on GitHub to create a new repository
2. Clone your new repository
3. Install dependencies:
   ```bash
   pnpm install
   ```
4. Copy the environment template and fill in your Firebase credentials:
   ```bash
   cp .env.example .env.local
   ```
5. Start the development server:
   ```bash
   pnpm dev
   ```

### Environment Variables

See [`.env.example`](.env.example) for the full list of required and optional environment variables.

## Common Commands

```bash
pnpm dev              # Start dev server
pnpm build            # Production build
pnpm lint             # Lint with ESLint
pnpm format           # Format with Prettier
pnpm format:check     # Check formatting
pnpm test             # Run headless tests with Vitest (node / hooks / components)
pnpm test:storybook   # Run Storybook stories as browser tests (Chromium via Playwright)
pnpm tsc              # Type check
pnpm storybook        # Start Storybook dev server (port 6006)
pnpm build-storybook  # Build static Storybook
pnpm screenshots      # Screenshot every story for visual review (run after build-storybook)
pnpm run env:validate # Validate deployment config files against schema (also runs on every commit)
```

## Project Structure

```
project-root/
├── src/
│   ├── app/                    # Next.js App Router pages and API routes
│   ├── components/
│   │   ├── ui/                 # ShadCN UI primitives (auto-generated)
│   │   ├── {feature}/          # Feature-specific components with co-located stories and tests
│   │   └── {shared}/           # Shared components
│   ├── lib/
│   │   ├── firebase/           # Firebase Admin + client SDK wrappers
│   │   ├── types/              # Core domain types (barrel-exported)
│   │   └── utils.ts            # Shared utility functions
│   ├── server/
│   │   ├── types/              # API response types
│   │   └── utils/              # Server-only helpers
│   ├── services/               # Data access layer (Firebase-backed)
│   ├── hooks/                  # Custom React hooks (barrel-exported)
│   ├── store/                  # Redux Toolkit slices
│   └── test-setup/             # Vitest setup files
├── deployment/
│   ├── schema.yml              # Allowlist schema for public config keys
│   ├── environments.yml        # Active environment list
│   ├── preview.yml             # Public env config for preview (staging)
│   └── production.yml          # Public env config for production
├── scripts/
│   ├── validate-config.mjs     # Validates deployment YAMLs against schema
│   └── update-config.sh        # Update a deployment YAML (optionally sync to Vercel)
├── .storybook/                 # Storybook configuration
├── .github/
│   ├── actions/setup/          # Composite action: pnpm + Node.js + install
│   └── workflows/              # CI workflows
├── docs/                       # Feature documentation
└── ...config files
```

## Documentation

- [ARCHITECTURE.md](ARCHITECTURE.md) — Technical decisions, patterns, and infrastructure
- [AGENTS.md](AGENTS.md) — Code standards and conventions for AI-assisted development
- [CONTRIBUTING.md](CONTRIBUTING.md) — How to contribute to projects built from this template

## Deployment

### Vercel

1. Import your repository in the [Vercel dashboard](https://vercel.com/new)
2. Add all environment variables from `.env.example`
3. Deploy — Vercel handles preview deployments on PRs and production deployments on merge to `main`

**Conserve preview-deploy quota:** to skip previews for PRs that don't need one, set the project's **Ignored Build Step** (Settings → Git) to `bash scripts/vercel-ignore-build.sh`. It builds production always and gates PR previews to `feat:` / `fix:` titles, skipping `chore` / `docs` / `ci` / etc. See [`docs/scripts/vercel-ignore-build.md`](docs/scripts/vercel-ignore-build.md).

### Environment Configuration

Public, non-secret environment config (Firebase project IDs, Sentry org/project, `NEXT_PUBLIC_*` keys) lives in `deployment/{env}.yml` and is validated against `deployment/schema.yml` on every commit and in CI. Secrets never go in these files.

To update a public config value (writes and validates the local YAML):

```bash
scripts/update-config.sh --env=preview NEXT_PUBLIC_FIREBASE_PROJECT_ID=my-project-id
# or from a Firebase console JSON download:
scripts/update-config.sh --env=preview --firebase-config=~/Downloads/firebase-config.json
```

Pushing the updated YAML values to Vercel is handled by the `envctl` CLI (in development).

### Secret Rotation

Secret rotation (Firebase service account, Sentry token) is handled by the `envctl` CLI (in development).

### GitHub Actions

CI runs automatically on every PR as parallel jobs in [`.github/workflows/ci-actions.yml`](.github/workflows/ci-actions.yml): Tests, Lint, Format, Type check, Docs (OKF), Build, and **Storybook Tests** (stories run as browser tests in Chromium). A **Storybook Screenshots** job additionally runs when a `*.stories.tsx` file changes — it captures a screenshot of every story and uploads them as a workflow artifact for visual review. It is advisory (`continue-on-error`), so it never blocks merge; download the `storybook-screenshots` artifact from the run to review.

Additional workflows:

- **Config Validation** — Validates deployment config against the schema on every PR and push to `main`
- **File Length** / **PR Title Lint** — enforce the file-size cap and Conventional-Commits PR titles

## License

MIT
