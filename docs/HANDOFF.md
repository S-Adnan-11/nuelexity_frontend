# Frontend handoff for maadan-dev

The Return Cat v2 implementation now covers branding, safe Markdown, user-right/answer-left conversation layout, guest OAuth invitations and refresh/loading isolation. Implementation details, placement inventory, evidence and owner setup are in the local `docs/RETURN_CAT_IMPLEMENTATION.md`; the report and screenshots are intentionally excluded from Git. Changes are published to `main` only at the owner's request. No collaborator messages or deployments were made.

Guest verification uses `src/lib/useGuestSession.ts` and backend `/guest/session`. The hook exchanges Turnstile once, retains the signed pass in `sessionStorage`, and checks it after refresh. Keep `src/lib/api.ts` as the only request boundary; it attaches `X-Guest-Pass` only to guest searches. A pass lasts at most two hours and cannot reset quotas. Keep the widget unmounted while clearance is valid, and never automatically retry a failed search after re-verification. Tests cover storage, headers, refresh/expiry recovery, and quotas.

Your root-redirect/shared-Supabase patch is included at upstream `cd6ac87`. The app keeps `/auth` and `/dashboard`, a shared client, and session-aware routing. The root now opens the research page for both guests and signed-in users. Auth state is centralized in `AuthProvider` rather than duplicated by each screen.

## Working pieces

- Responsive search workspace, guest access, Google/GitHub sign-in and callback route.
- POST-based streaming with source cards, numbered citation links, follow-up context, and a Stop action.
- Owned conversation history with older-page browsing, direct thread URLs, back/forward navigation, loading and deletion; guest history stays in memory.
- Distinct auth/loading/refresh/empty/error states, thread retry, account/request isolation, safe Markdown and numbered citations.
- Explicit public environment whitelist. The old Vite-style local Supabase keys are mapped for compatibility, but new settings use `BUN_PUBLIC_*`.

The canonical [API contract](../../../backend/nuelexity_backend/docs/API.md) belongs to the backend repo. This relative link works in the combined workspace; in standalone checkouts use the backend repository's `docs/API.md`. `src/lib/api.ts`, `src/lib/stream.ts`, and `src/lib/types.ts` form the frontend integration boundary.

## Follow-on work

1. Verify on physical Android/iOS keyboards and run a full screen-reader audit. Headless Chrome covers narrow layouts, focus, keyboard-sized viewports and reduced motion, but cannot validate physical mobile keyboards.
2. Finish deployment and OAuth/Turnstile origin configuration described in the implementation report.

The composer already supports the backend-approved model catalogue, per-thread choice persistence and immutable actual-answer attribution. Public sharing, uploads and paid plans remain outside the API contract. Coordinate any new API/event fields with the backend lead.

## Quick verification

```bash
npm ci
npm run check
npm run dev
```

Use fake SSE responses for UI iteration; each live search uses limited shared quota. Preserve the Stop action, explicit completion/error behavior, and public env whitelist. Backend setup and remaining account configuration are documented in its README and `docs/DATABASE.md`.

## Chat refinement update — 2026-10-15

See [chat refinement implementation and verification](CHAT_REFINEMENTS.md). The main pane owns conversation scrolling; a shared width-constrained column aligns answers and the compact composer. The model menu now uses the existing Radix Select primitive, including guest padlocks, keyboard discovery, a sign-in action and distinct unavailability copy. Visible labels omit the provider suffix while retaining provenance in API/storage.

`follow_ups` still carries `{questions: string[]}`, now zero to three contextual optional questions from the existing completion. Invalid optional payloads become empty arrays. The UI applies questions only to the matching completed answer, and the existing stored array supports reopening. There is no migration or extra model call. Backend `app.ts`, `lib/follow-ups.ts`, `lib/providers.ts` and `prompts.ts` must ship together for generation. Frontend/old-backend operation remains safe: old generic templates are omitted from display, without rewriting history.

## Library and navigation update — 2026-10-16

The library starts with 30 threads and offers **Load older conversations** using the existing `offset` API. Requests advance by returned row count, deduplicate overlapping IDs, stop at a short page or the API's maximum offset, and offer an explicit failed-page retry. Rapid repeated activation makes one request. Refreshes revalidate every loaded page before replacing the visible list. Account replacement/sign-out aborts outstanding pages and discards private state.

Saved threads use `/dashboard/<conversation-id>`. Real links support opening another tab; direct loads, refresh, browser back/forward and New search load through the existing owned API. Each thread retains its scroll position. The old per-user tab pointer is adopted only on initial entry without a thread URL. Assigning a new streaming answer's URL preserves the active request; leaving it aborts the stream. Invalid, missing, deleted and signed-out URLs show recoverable states. Signing in from a private URL remembers only a validated UUID for one OAuth return; it uses the existing callback URL and performs the usual ownership check after sign-in. Blocked tab storage still permits sign-in.

The Node production server serves the SPA on thread URLs; static hosts must rewrite these paths to `index.html`. No backend API, migration or provider configuration changed. `npm run check` and `npm run test:browser` cover pagination/retries/overlap, loaded-page refresh, navigation/scroll, direct URL loading, deletion, streaming cancellation, guest/auth isolation and mocked OAuth return. Real OAuth, physical-device and hosting verification remain external follow-on work.
