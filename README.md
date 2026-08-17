# Cloud Agent — GitHub integration

Monorepo foundation for a cloud coding-agent platform. This milestone implements
the **GitHub App integration only**: connecting a GitHub account, choosing which
repositories the platform may use, and minting short-lived installation
credentials for a future sandbox service.

```text
apps/
├── web/     Next.js App Router + Tailwind (dark UI, emerald primary, blue accent)
└── api/     Express + TypeScript + MongoDB (owns every GitHub secret)
packages/
└── shared/  Types shared by web and api
```

## Architecture

```text
Browser → Next.js (/api proxy) → Express → GitHub App
                                     ↓
                        short-lived installation token
                                     ↓
                   future Python agent / E2B sandbox → git clone
```

* The browser never receives GitHub secrets or installation tokens.
* Installation tokens are minted on demand, cached in memory only, and never persisted.
* Stored clone URLs are credential free; credentials are injected at clone time.
* Every GitHub read/write is scoped to the authenticated application user.

## Setup

1. Create a GitHub App (Settings → Developer settings → GitHub Apps) with:
   * Repository permissions: `Metadata: Read`, `Contents: Read & write`, `Pull requests: Read & write`
   * "Request user authorization (OAuth) during installation": enabled
   * Setup/Callback URL: `http://localhost:3000/api/github/callback`
   * Webhook URL (optional locally): `http://localhost:3000/api/github/webhooks`
2. Copy env templates and fill them in:

   ```bash
   cp apps/api/.env.example apps/api/.env
   cp apps/web/.env.example apps/web/.env.local
   ```

3. Install and run (requires MongoDB on `MONGODB_URI`):

   ```bash
   npm install
   npm run build --workspace @defox/shared
   npm run dev
   ```

   Web: http://localhost:3000 · API: http://localhost:4000

## API

| Method | Path | Description |
| --- | --- | --- |
| POST | `/api/auth/signup` \| `/login` \| `/logout` | Application auth (HTTP-only cookie session) |
| GET | `/api/auth/me` | Current application user |
| GET | `/api/github` | Connection state, account, repository selection |
| DELETE | `/api/github` | Disconnect and forget installation metadata |
| GET | `/api/github/install` | Issues single-use state, redirects to the GitHub App install page |
| GET | `/api/github/callback` | Validates state, persists installation, syncs repositories |
| GET | `/api/github/repositories` | Paginated repositories (`page`, `perPage`, `search`, `selectedOnly`, `refresh`) |
| POST | `/api/github/repositories/sync` | Re-sync repository metadata from GitHub |
| PATCH | `/api/github/repositories/access` | `{ "mode": "all" }` or `{ "mode": "selected", "repositoryIds": [...] }` |
| POST | `/api/github/repositories/authorize` | `{ "repositoryId": "123" }` → backend authorization for a future session |
| POST | `/api/github/webhooks` | Signature-verified webhook receiver (metadata only) |
| POST | `/api/internal/github/repositories/:id/clone-credentials` | Service-token guarded; short-lived clone credentials for the future sandbox |

All responses use `{ "ok": true, "data": ... }` or `{ "ok": false, "error": { "code", "message" } }`.

## Repository access model

Two distinct concepts are tracked separately:

* `githubRepositorySelection` — what GitHub granted the installation.
* `repositorySelection` + per-repository `selected` — what the user allows this application to use.

Authorization for any repository operation runs:
authenticated user → installation ownership → repository belongs to installation →
repository allowed by selection policy.

## Not implemented yet

Sandboxes (E2B), the Python agent service, browser/VS Code tooling, MCP, LLM
tooling, queues and agent sessions. Only the types at the sandbox boundary exist
(`packages/shared/src/sandbox.ts`).
