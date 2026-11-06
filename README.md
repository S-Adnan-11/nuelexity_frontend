# Nuelexity · Frontend

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="public/brand/v2/logos/lockup-sage.svg">
  <img src="public/brand/v2/logos/lockup-ink.svg" width="320" alt="Nuelexity Return Cat">
</picture>

Nuelexity searches the web and streams an answer with numbered sources. Check the evidence, ask a follow-up, or sign in to return to a saved conversation.

**[Open Nuelexity](https://nuelexity.devs.surf/) · [Backend repository](https://github.com/S-Adnan-11/nuelexity_backend) · [API contract](https://github.com/S-Adnan-11/nuelexity_backend/blob/main/docs/API.md)**

[![React](https://img.shields.io/badge/React-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-646CFF?logo=vite&logoColor=white)](https://vite.dev/)
[![Supabase](https://img.shields.io/badge/Supabase-3FCF8E?logo=supabase&logoColor=black)](https://supabase.com/)

## Run locally

Use Node.js **22.23.2 or later in the 22.x line** and npm **10.9–12**. The repo pins Node 22.23.2 and npm 12.0.2 for CI. Each repository has its own install and lockfile.

1. Set up and start the [backend](https://github.com/S-Adnan-11/nuelexity_backend#run-locally) in a separate terminal. By default it listens on port 3002.
2. Clone and configure this repository:

   ```sh
   git clone https://github.com/S-Adnan-11/nuelexity_frontend.git
   cd nuelexity_frontend
   npm ci
   npm run env:init
   ```

3. Fill in the frontend `.env` using the public settings below. The initializer leaves an existing file intact.
4. Run `npm run dev` and open **http://localhost:3000**. Keep both servers running; Ctrl+C stops either one. Restart after changing its environment.

| Browser setting | Use |
| --- | --- |
| `BUN_PUBLIC_BACKEND_URL` | API origin; `http://localhost:3002` for local development |
| `BUN_PUBLIC_SUPABASE_URL` | URL of the same Supabase project used by the API |
| `BUN_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase public key for the browser auth client |
| `BUN_PUBLIC_TURNSTILE_SITE_KEY` | Public widget key paired with the backend secret for production guest verification |

The `BUN_PUBLIC_*` names are configuration keys; Bun is not required. Only these four fields are exposed by `/config.json`. Keep provider keys, database credentials, OAuth client secrets and Supabase server keys out of the frontend. For local OAuth, allow `http://localhost:3000/auth/callback` in your Supabase project's redirect URLs. See the backend's [setup guide](https://github.com/S-Adnan-11/nuelexity_backend/blob/main/docs/SETUP.md) for service setup.

## How it works

The home route opens the research flow directly. Eligibility is handled before the workspace loads. Guests can draft while verification is pending and submit once clearance is ready. Guest conversations are temporary; Google or GitHub sign-in enables private saved threads and model selection.

The composer calls the API and parses server-sent events for status, sources, answer text and optional follow-ups. Model selection comes from the backend catalogue and persists per saved conversation. An active stream keeps the model chosen for that request. The library loads older conversations in pages, and `/dashboard/<conversation-id>` reopens an owned thread.

| Component | Role |
| --- | --- |
| React, React Router, TypeScript | Workspace, account state, routes and typed API boundaries |
| Vite and Tailwind CSS | Development server, assets and production styles |
| Supabase Auth | Shared browser client for Google and GitHub sign-in |
| Cloudflare Turnstile | Guest challenge; the backend validates it and issues the pass |
| `src/lib/api.ts`, `src/lib/stream.ts` | Request and stream boundaries |
| `src/components/pages/Dashboard.tsx` | Composer, conversation state and history |
| `src/lib/startup.ts`, `src/lib/useGuestSession.ts` | API readiness and guest verification |
| `build.ts`, `scripts/pages-artifacts.mjs` | Prerendered HTML, static artifacts and hosting rules |

Visit [About](https://nuelexity.devs.surf/about) for the product demonstration. See [privacy, storage and terms](https://nuelexity.devs.surf/legal) for the hosted service.

## Checks and builds

| Command | What it checks or produces |
| --- | --- |
| `npm run check` | TypeScript, unit tests and the production build |
| `npm run test:browser` | Built UI with fake auth/providers, plus server and startup checks |
| `npm run build` | Application output in `dist/` |
| `npm run preview:local` | Loopback preview of an existing build |
| `npm run build:pages` | Static Cloudflare Pages output in `pages-dist/` |

Browser checks require Chrome or Chromium; set `CHROME_BIN` if needed. Fixtures do not need a live search or model key. For a production Node server, build first and then run `npm start` with production public settings. The [Pages guide](docs/CLOUDFLARE_PAGES_RELEASE.md) explains artifact preparation and publishing. Build commands do not deploy.

When changing request fields or stream events, update the [API contract](https://github.com/S-Adnan-11/nuelexity_backend/blob/main/docs/API.md) and test the matching client and server together. For dependency changes, update the npm lockfile with the manifest and verify a clean `npm ci`.

The [brand assets](public/brand/v2/README.md) include font attribution; the GitHub icon includes its [license notice](public/brand/vendor/octicons-LICENSE.txt).
