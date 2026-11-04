# Nuelexity frontend

![Nuelexity Return Cat](public/brand/v2/logos/lockup-sage.svg)

A Node.js + React + TypeScript research workspace with guest search, Google/GitHub OAuth, streaming answers, numbered sources, follow-ups, and private saved conversations.

## Run locally with npm

Use **Node.js 22.23.2 or newer in the 22 LTS line** and **npm 10.9–12**. `.nvmrc` pins 22.23.2; `engines` and `.npmrc` reject unsupported Node/npm versions. The existing React Router requires Node ≥22.22 and Supabase requires ≥22; this baseline also supports the selected Vite/Vitest tools. No Bun installation is needed.

```bash
git clone https://github.com/S-Adnan-11/nuelexity_frontend.git
cd nuelexity_frontend
npm ci
npm run env:init
```

In the combined workspace the exact directory is `frontend/nuelexity_frontend`. `env:init` creates `.env` from `.env.example` only when absent; it never overwrites existing values. Edit it with your project's public settings, then run `npm run dev` and open **http://localhost:3000**. Ctrl+C stops the server; rerun the same command to restart. Restart after environment changes.

Run the backend in a second terminal. From the same parent directory that contains the standalone frontend clone:

```bash
git clone https://github.com/S-Adnan-11/nuelexity_backend.git
cd nuelexity_backend
npm ci
npm run env:init
```

For the combined workspace, start at the workspace root and use `cd backend/nuelexity_backend` instead of cloning. Fill server settings, then run `npm run config:check` and `npm run dev`. Its URL is **http://localhost:3002**, with `/health` and `/ready` probes. See the [backend README](https://github.com/S-Adnan-11/nuelexity_backend#readme) for Supabase migrations, server credentials, quotas and provider setup. Neither npm install nor frontend startup provisions those external services.

The existing `BUN_PUBLIC_*` names remain compatible configuration names; they do **not** require Bun:

```dotenv
BUN_PUBLIC_BACKEND_URL=http://localhost:3002
BUN_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
BUN_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
BUN_PUBLIC_TURNSTILE_SITE_KEY=
```

Only these four fields pass through `public-env.mjs` into `/config.json`. The app loads that file before initializing its shared Supabase client. Local `VITE_SUPABASE_URL`/`VITE_SUPABASE_PUBLISHABLE_KEY` are supported for compatibility. Never use a Supabase secret/service role key, Tavily/Groq key, database URL, or OAuth client secret here. Vite automatic env loading/inlining is disabled; server-side `VITE_*` compatibility values still pass through the same whitelist.

Configure Supabase Auth to allow `http://localhost:3000/auth/callback`. Missing public auth settings show a setup message and guest search remains accessible. Production guest search requires matching backend Turnstile configuration.

## Verify and build

```bash
npm run check        # Typecheck, parser/public-config tests, production build
npm run test:browser # After build: model + research Chrome fixtures and Node asset smoke checks; no real credits
npm run build        # Static files in dist/, including config.json
npm start        # Production Node server, loads public settings at startup
```

The Node server serves prerendered Home, About and Legal HTML, private noindex route documents, security headers and real 404s. Use `npm run preview:local` for loopback-only review after building. Cloudflare Pages uses `npm run build:pages` and the separate `pages-dist/` static artifact, with generated redirects/headers and the same publication hold. Policy approval, an effective date and the owner’s Google-branding confirmation are required; `npm run release:check` lists blockers. See [Cloudflare Pages setup, manual controls and rollback](docs/CLOUDFLARE_PAGES_RELEASE.md). `npm run pages:prepare` produces a local `pages-review/` fixture for emulator checks and never the configured deployment output. Do not bypass release checks by uploading another build folder.

`site-content.json` supplies optional developer name/GitHub/portfolio, operator/contact/policy dates and optional public Search Console verification. Omitted developer links are not rendered. It is build-time editorial configuration, not an expansion of the four-field public environment whitelist. No external dashboard is changed by editing it.

## Conversation model selection

The composer loads labels, Preview flags, availability and the default from backend `GET /models`. Signed-in users can choose an available approved model. Guests can open the same accessible menu, inspect the catalogue, and see padlocks and a sign-in action for restricted choices. Provider unavailability has a separate explanation. Qwen is labelled Preview. Answer labels show only the actual model name and Preview status; provider provenance stays in API/storage metadata. Changing the choice while an answer streams affects the next message; successful answers use the model attribution from the completion event.

Choices persist per conversation through the owner-checked backend API. Refresh/reopening restores them, new threads start at the backend default, and sign-out returns to guest behavior. An unavailable stored ID stays visible and blocks sending until an available model is selected. Unsaved choices offer a manual save retry; interrupted/failed answers remain incomplete. Old messages without model metadata display “Model unknown”.

The backend's existing `202610140001_model_selection.sql` migration supplies model persistence. Its columns were verified present on 2026-10-15; this chat refinement needs no additional migration. Exact adoption notes are in backend `docs/MODEL_SELECTION.md`. No new frontend environment settings or provider credentials are needed. Browser checks use the production bundle with fake auth/providers; set `CHROME_BIN` if Chrome is not at `/usr/bin/google-chrome`.

## Collaboration

`maadan-dev`'s root-routing and shared-client changes were pulled before this implementation. Their structure is retained and expanded for guest research and centralized auth state.

See [handoff and frontend tasks](docs/HANDOFF.md). The backend's `docs/API.md` is the canonical request/SSE contract. `src/lib/api.ts` and `src/lib/stream.ts` are the only request/stream boundaries; keep UI code independent of provider implementations.

Answers render safe Markdown, tables and numbered citations without raw HTML or remote images. User questions align right inside the same reading column; the composer has its own reserved bottom space. Guest invitations wait for auth restoration, use the shared Google/GitHub actions, and remember dismissal for this tab. Guest threads are temporary; saved history requires sign-in.

Auth-pending, initial load, background refresh, successful empty results and failures have separate UI states. Switching accounts replaces all private in-memory state and cancels old requests. Switching threads clears the previous thread immediately; same-thread refresh keeps valid content. Active thread IDs and scroll offsets are stored in tab storage, scoped by user and thread; private messages are fetched from the server. Signing in from a private URL keeps one validated thread ID in tab storage until the OAuth return, then checks ownership through the backend.

The intended public URL is **https://nuelexity.devs.surf** (owner confirmed; hosting/DNS not configured yet). Canonical/social metadata already uses it. The local implementation report, screenshot evidence and deployment steps are in `docs/RETURN_CAT_IMPLEMENTATION.md`; that report and `docs/evidence/` are intentionally excluded from Git. Nothing was deployed.

The library loads 30 conversations at a time and offers **Load older conversations**, including retry and end-of-list handling. Refreshes retain all loaded pages. Saved threads have private URLs at `/dashboard/<conversation-id>` with direct loading, refresh and browser back/forward support. Navigation restores each thread's scroll position and aborts a running answer when leaving it. Invalid, deleted and signed-out URLs offer recovery actions. The backend API and database schema are unchanged.

## Chat refinements

The conversation scroll region spans the main pane and contains a centered 880px column; answer/composer content measures 848px with the current gutters. The composer starts short, grows automatically, and keeps model choice, web/source status and Send/Stop in one toolbar. Scrolling follows a stream only near the bottom, including its final suggestions.

Contextual follow-ups come from the same bounded backend completion, remain optional, and reuse existing saved `follow_ups` metadata. Footer JSON is stripped before visible deltas and storage. Activating a question uses the normal authenticated/guest quota path; duplicate submissions are fenced. See the [implementation report, protocol details, checks and screenshot paths](docs/CHAT_REFINEMENTS.md).

## Node build and production deployment

```bash
npm run typecheck
npm test
npm run build
npm run test:startup
npm start
```

Vite supplies development serving/HMR and production bundling; the matching Tailwind Vite plugin compiles the existing CSS. React, routes, branding, model selection and research UI stay intact. `npm run check` combines typecheck, offline tests and production build. `npm run test:browser` additionally requires an installed Chrome/Chromium; set `CHROME_BIN` to its executable. These browser fixtures use fake auth/provider/history and cost no credits. The backend's `npm run test:browser` can also exercise this build against its real compiled Node HTTP/SSE handlers with fake services.

For a Node deployment, build with dev dependencies, then use `npm prune --omit=dev` and `npm start`. To install directly on a runtime host, copy `dist/`, `src/server.mjs`, `public-env.mjs`, `site-content.json`, `scripts/load-env.mjs`, `scripts/publication.mjs`, `package.json` and `package-lock.json`, run `npm ci --omit=dev`, and supply your own environment. Startup needs no Vite, tsx, TypeScript, test runner or Bun. `npm run test:startup` also works after pruning and checks SPA routes, assets, public settings and graceful shutdown. Reinstall with `npm ci` before developing/building again.

Node loads `.env.local`, `.env.production` for build/start or `.env.development` for dev, then `.env`; explicit process values win. Tests do not load developer files. Configure your own Supabase public URL/key and backend URL; OAuth redirect allowlists, migrations, provider keys and production Turnstile remain external setup, not npm lifecycle work. No hosting is provisioned. Scripts avoid POSIX-only environment assignment and use Node filesystem/process APIs; verification so far is Linux only.

`package-lock.json` is the canonical reproducible dependency graph. `npm install` is supported for deliberate dependency edits; commit its lockfile with the manifest and verify `npm ci`. GitHub Actions repeats the Node/npm checks, Chrome fixtures and production startup with dev dependencies omitted. Hosted CI must still run after these local changes are published.

## Optional Bun package manager

With Node/npm still installed, Bun 1.4.0 can install and invoke the same scripts:

```bash
bun install --no-save
bun run check
bun run dev
```

`package-lock.json` is the only committed lockfile and the reproducible install/CI contract is `npm ci`. Bun imports that lockfile. Its generated `bun.lock` is local/ignored; it is not a second source of truth. Before reinstalling with Bun after npm dependency edits, remove the local Bun lock with `node -e "require('node:fs').rmSync('bun.lock', {force:true})"` so it imports the current npm lock. Do not use `bun test` or run the old TypeScript/Bun server directly. The supported runtime is Node, including when scripts are invoked by Bun. After dependency changes, use `npm install`, commit `package.json` and `package-lock.json` together, and verify `npm ci`; do not commit generated Bun locks.

## Account, About and predeployment review

Signed-in workspace controls open `/account` using the existing session metadata. Sign-out is explicitly scoped to the current Supabase session and clears private workspace state across listening tabs; issued access JWTs can remain valid until expiry. It does not sign out Google/GitHub or delete history. `/about` and `/legal` are public, with compact footer links. Necessary storage is documented without adding optional tracking or a consent banner.

See [release verification](docs/RELEASE_PREPARATION.md), [Cloudflare Pages setup](docs/CLOUDFLARE_PAGES_RELEASE.md) and [complete policy wording/remaining decisions](docs/POLICY_REVIEW.md). The V1 presentation is owner-approved; policy publication remains held. No new SQL is needed and no already-confirmed migration should be repeated.
