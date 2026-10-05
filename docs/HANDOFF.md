# Frontend handoff for maadan-dev

Your root-redirect/shared-Supabase patch is included at upstream `cd6ac87`. The app keeps `/auth` and `/dashboard`, a shared client, and session-aware routing. The root now opens the research page for both guests and signed-in users. Auth state is centralized in `AuthProvider` rather than duplicated by each screen.

## Working pieces

- Responsive search workspace, guest access, Google/GitHub sign-in and callback route.
- POST-based streaming with source cards, numbered citation links, follow-up context, and a Stop action.
- Owned conversation history, thread loading and deletion; guest history stays in memory.
- Loading/error/quota/interrupted-stream states and safe plain-text rendering.
- Explicit public environment whitelist. The old Vite-style local Supabase keys are mapped for compatibility, but new settings use `BUN_PUBLIC_*`.

The canonical [API contract](../../../backend/nuelexity_backend/docs/API.md) belongs to the backend repo. This relative link works in the combined workspace; in standalone checkouts use the backend repository's `docs/API.md`. `src/lib/api.ts`, `src/lib/stream.ts`, and `src/lib/types.ts` form the frontend integration boundary.

## Next frontend work

1. Refine spacing, typography, source cards, mobile navigation, focus behavior, and loading skeletons.
2. Add safe Markdown presentation, including lists/code blocks, without enabling raw HTML. Keep numbered citations mapped to returned sources.
3. Add paginated library browsing using the existing `offset` contract (the current UI displays the latest 30 threads).
4. Add route-based thread URLs and robust refresh/back navigation with owned conversation loading.
5. Add keyboard shortcuts and complete screen-reader testing, including navigation focus and stream announcement behavior.

Coordinate new API/event fields with the backend lead before implementation. Public sharing, files, paid plans, and model pickers are deferred. No need to put buttons for features the backend cannot serve yet.

## Quick verification

```bash
bun install --frozen-lockfile
bun run check
bun run dev
```

Use fake SSE responses for UI iteration; each live search uses limited shared quota. Preserve the Stop action, explicit completion/error behavior, and public env whitelist. Backend setup and remaining account configuration are documented in its README and `docs/DATABASE.md`.
