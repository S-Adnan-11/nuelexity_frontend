# Frontend V1 release preparation — 2026-10-28

The owner approved the current demonstration, 64-second timing, zoom/scroll, cat blink and wording. Visual review is closed. The presentation is unchanged in this release-preparation pass except that the legal page now displays the already-confirmed operator name. Policy approval and Google-branding confirmation remain separate; no frontend publication has occurred.

## Intended release

Branch: **`release/frontend-v1`**, based on the reviewed local `main` at `23d08f3`. It retains the two earlier local commits `32d6034` (Node/npm/chat work) and `23d08f3` (saved-thread navigation), plus the reviewed owner working-tree changes: account/profile/sign-out, public pages/footer/metadata, startup coordination, model wording, fixed About demo, cat blink and shared composer/source styling. Existing OAuth actions and the single Supabase client interface are preserved.

Release preparation adds the static Pages artifact builder, public-config validation, security/cache/indexing rules, private deep-link mapping, stronger policy-source freshness checks and a distinct owner Google-verification gate. Public deployment output is `pages-dist/`; an unresolved gate removes stale output and fails the build. No dependency version/lockfile, backend, migration or external dashboard is changed.

The public-safe source, tests, setup guide and policy review are intended for the release commit. Developer-local dotenv files, private working reports, screenshots/recordings, build folders and Cloudflare local state are excluded. The pre-existing local `docs/HANDOFF.md` edit is retained unstaged because it is historical/private coordination work rather than release configuration. Nothing is discarded.

## Verification

- **`npm run check`:** TypeScript, **46 tests in 12 files**, production build pass. New tests cover independent Google confirmation, draft/impossible-date/stale-policy rejection, exact public config, private-key/test-key rejection, static artifact allowlisting and stale deployment-output removal.
- **`npm run test:browser`:** all six existing offline browser/server suites pass against the release build, including saved threads, account/two-tab sign-out, OAuth wiring, startup/verification/failure states, safe Markdown and actual Node CSP.
- **`npm run test:pages`:** pass against **Wrangler 4.154.0's actual local static handler**, with no Functions and 7 parsed redirect / 16 parsed header rules. Checks cover public production indexing/cache without local-preview blanket controls, private route noindex/no-store, exact conversation URLs, callback/account entries, true asset/page 404s, structured-data CSP, canonical/social metadata, sitemap/robots, immutable assets and both pages.dev hostname forms. **32** desktop/mobile dark/light browser layouts pass with intercepted fake app/auth responses; no external/provider request or search is made.
- The emulator exposed a platform detail: proxying to `/private.html` redirects to `/private`, losing a conversation URL. The final rule proxies to **`/private`** and the regression asserts a direct **200**, without following redirects, before rendering the deep link. Host-specific rules are tested with raw HTTP because the runtime's `fetch` controls the Host header.
- The previous approved demo full-loop, no-request, cleanup/reduced-motion and native Firefox 100/125/200% zoom evidence is reused for unchanged presentation code. It is local evidence, not a new physical-device/Safari/screen-reader acceptance claim.
- `npm run audit:release` and human diff review cover staged source plus outgoing earlier changes; exact configured private values and credential-shaped content are checked without logging matches. Supplied SVGs and `package-lock.json` remain unchanged. Generated Pages output contains only its allowlisted static files and four public settings, with no source/report/build metadata.
- `npm run release:check` and `npm run build:pages` **intentionally fail** until the actual policy/date/Google decisions are approved. An operator/contact/audience resubmission is not a gate.

Screenshots and request inventories remain local under `docs/evidence/frontend-release-2026-10-28/`; the earlier approved demo/Firefox material remains under `docs/evidence/frontend-v1-2026-10-28/`. Neither evidence folder is staged or deployed. Local Node review is available with `PORT=3010 npm run preview:local`, at `http://localhost:3010/legal` or `/about`, with noindex/no-store headers.

## Publication blockers and concrete resolution

| Current gate | Resolution |
| --- | --- |
| Policy choices unapproved | Review the [complete current wording and five decisions](POLICY_REVIEW.md); approve or amend eligibility, lawful bases/transfers, current retention/provider controls and manual rights handling. Apply the approved wording without leaving draft/pending passages. |
| Effective date missing | Supply the actual intended date when approving the assembled final policy, then set its review/effective dates and policy approval flags. |
| Google branding unconfirmed | Owner completes its separate verification and explicitly confirms completion before `googleBrandingVerified` becomes true. No GitHub sign-in change is needed. |
| Live Pages setup/acceptance not performed | Follow [exact build/manual deployment/DNS/acceptance/rollback steps](CLOUDFLARE_PAGES_RELEASE.md) after the policy/Google gates pass. The actual generated pages.dev target is not yet assigned; no hostname or DNS record is invented. |

## Push/deployment controls

Read-only GitHub inspection found the public repository's only branch was `main` at `ae7421f`; repository webhooks, environments and recorded deployments were empty, and GitHub Pages was not configured (404); the only check/app was GitHub Actions, and the only workflow was **Frontend checks**. Local workflow review confirms read-only contents permission and no upload/deploy job. No Cloudflare account/project is connected in this workspace, so saved Pages branch settings cannot be claimed inspected or changed.

The release uses **`[CF-Pages-Skip]` at the start of the commit message** as Cloudflare's documented per-commit deployment skip, and retains the failing build-time publication gate. No push to `main`, force-push, merge or project creation is part of this preparation. Remote deployment/check state should be rechecked after a permitted branch push; the commit hash and push result are delivered to the owner separately.
