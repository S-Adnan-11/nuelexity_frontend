# Nuelexity frontend

A Bun + React + TypeScript research workspace with guest search, Google/GitHub OAuth, streaming answers, numbered sources, follow-ups, and private saved conversations.

## Run

```bash
bun install --frozen-lockfile
# Copy .env.example to .env only if you do not already have .env.
bun run dev
```

Open `http://localhost:3000`. Start the backend separately on port 3002 and apply its Supabase migration before live searches.

Public settings:

```dotenv
BUN_PUBLIC_BACKEND_URL=http://localhost:3002
BUN_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
BUN_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
BUN_PUBLIC_TURNSTILE_SITE_KEY=
```

Only these four fields pass through `public-env.ts` into `/config.json`. The app loads that file before initializing its shared Supabase client. Local `VITE_SUPABASE_URL`/`VITE_SUPABASE_PUBLISHABLE_KEY` are supported for compatibility. Never use a Supabase secret/service role key, Tavily/Groq key, database URL, or OAuth client secret here. Bun's unrestricted `env="inline"` is forbidden.

Configure Supabase Auth to allow `http://localhost:3000/auth/callback`. Missing public auth settings show a setup message and guest search remains accessible. Production guest search requires matching backend Turnstile configuration.

## Verify and build

```bash
bun run check        # Typecheck, parser/public-config tests, production build
bun run build        # Static files in dist/, including config.json
bun run start        # Production Bun server, loads public settings at startup
```

Static hosting must include `dist/config.json` and rewrite SPA paths (`/dashboard`, `/auth`, `/auth/callback`) to `index.html`. Configure the backend HTTPS URL before building for deployment. `start` serves the application through Bun; it does not use the `dist` directory. No hosting service is selected or provisioned.

## Collaboration

`maadan-dev`'s root-routing and shared-client changes were pulled before this implementation. Their structure is retained and expanded for guest research and centralized auth state.

See [handoff and frontend tasks](docs/HANDOFF.md) and [AGENTS.md](AGENTS.md). The backend's `docs/API.md` is the canonical request/SSE contract. `src/lib/api.ts` and `src/lib/stream.ts` are the only request/stream boundaries; keep UI code independent of provider implementations.

The current answer renderer uses safe text and inline citation links. Rich Markdown, paginated library browsing, route-based thread URLs, and expanded keyboard/accessibility polish are planned frontend tasks. Guest threads are temporary; saved history requires sign-in.
