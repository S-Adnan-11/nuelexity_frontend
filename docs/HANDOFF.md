# Frontend handoff for maadan-dev

The Return Cat v2 implementation now covers branding, safe Markdown, user-right/answer-left conversation layout, guest OAuth invitations and refresh/loading isolation. Implementation details, placement inventory, evidence and owner setup are in the local `docs/RETURN_CAT_IMPLEMENTATION.md`; the report and screenshots are intentionally excluded from Git. Changes are published to `main` only at the owner's request. No collaborator messages or deployments were made.

Guest verification uses `src/lib/useGuestSession.ts` and backend `/guest/session`. The hook exchanges Turnstile once, retains the signed pass in `sessionStorage`, and checks it after refresh. Keep `src/lib/api.ts` as the only request boundary; it attaches `X-Guest-Pass` only to guest searches. A pass lasts at most two hours and cannot reset quotas. Keep the widget unmounted while clearance is valid, and never automatically retry a failed search after re-verification. Tests cover storage, headers, refresh/expiry recovery, and quotas.

Your root-redirect/shared-Supabase patch is included at upstream `cd6ac87`. The app keeps `/auth` and `/dashboard`, a shared client, and session-aware routing. The root now opens the research page for both guests and signed-in users. Auth state is centralized in `AuthProvider` rather than duplicated by each screen.

## Working pieces

- Responsive search workspace, guest access, Google/GitHub sign-in and callback route.
- POST-based streaming with source cards, numbered citation links, follow-up context, and a Stop action.
- Owned conversation history, thread loading and deletion; guest history stays in memory.
- Distinct auth/loading/refresh/empty/error states, thread retry, account/request isolation, safe Markdown and numbered citations.
- Explicit public environment whitelist. The old Vite-style local Supabase keys are mapped for compatibility, but new settings use `BUN_PUBLIC_*`.

The canonical [API contract](../../../backend/nuelexity_backend/docs/API.md) belongs to the backend repo. This relative link works in the combined workspace; in standalone checkouts use the backend repository's `docs/API.md`. `src/lib/api.ts`, `src/lib/stream.ts`, and `src/lib/types.ts` form the frontend integration boundary.

## Follow-on work

1. Add paginated library browsing using the existing `offset` contract (the current UI displays the latest 30 threads).
2. Add route-based thread URLs and back navigation through owned conversation loading.
3. Verify on physical Android/iOS keyboards and run a full screen-reader audit. Headless Chrome covers narrow layouts, focus, keyboard-sized viewports and reduced motion, but cannot validate physical mobile keyboards.
4. Finish deployment and OAuth/Turnstile origin configuration described in the implementation report.

The composer already supports the backend-approved model catalogue, per-thread choice persistence and immutable actual-answer attribution. Public sharing, uploads and paid plans remain outside the API contract. Coordinate any new API/event fields with the backend lead.

## Quick verification

```bash
bun install --frozen-lockfile
bun run check
bun run dev
```

Use fake SSE responses for UI iteration; each live search uses limited shared quota. Preserve the Stop action, explicit completion/error behavior, and public env whitelist. Backend setup and remaining account configuration are documented in its README and `docs/DATABASE.md`.
