# V1 frontend release preparation

The owner approved the V1 presentation on 2026-10-28. No redesign remains. Source is prepared on `release/frontend-v1`; publication remains blocked for the [policy review](POLICY_REVIEW.md), its effective date/final approval, and the owner's Google-branding confirmation. GitHub sign-in is retained. No database migration, backend deployment or provider-credit test is required for this preparation.

## Exact Pages build settings

This is the independent **S-Adnan-11/nuelexity_frontend** repository, not the outer workspace or backend repository.

| Field | Value |
| --- | --- |
| Project type | Cloudflare **Pages**, static assets; framework preset **None** |
| Repository | `S-Adnan-11/nuelexity_frontend` |
| Root directory | Repository root: leave blank (equivalent to `/`). Do not enter the workspace's `frontend/nuelexity_frontend` path. |
| Production branch | `release/frontend-v1` if choosing Git integration after approval |
| Build command | `npm ci && npm run build:pages` |
| Build output directory | `pages-dist` |
| Build runtime | Node **22.23.2** (`.nvmrc`); npm **12.0.2**. No Node server/Functions/Workers runtime is deployed. |
| Build image | v3, with explicit version overrides below |
| `NODE_VERSION` | `22.23.2` |
| `NPM_VERSION` | `12.0.2` |
| `SKIP_DEPENDENCY_INSTALL` | `1`, because the build command uses canonical `npm ci` |
| `NPM_CONFIG_INCLUDE` | `dev`, so Vite/TypeScript are installed for the build |
| `NUELEXITY_ENV_FILE` | `none`, so a cloud build does not read developer-local dotenv files |

Cloudflare documents [version overrides/custom dependency installation](https://developers.cloudflare.com/pages/configuration/build-image/); the repository pins Node/npm and keeps `package-lock.json` canonical. The `build:pages` command removes stale deployable output, requires policy/Google approval, builds the app, checks the resulting policy/configuration and assembles a minimal static artifact. It performs no upload. A blocked build leaves **no `pages-dist/`**.

### The only public application environment variables

| Name | Production value/source |
| --- | --- |
| `BUN_PUBLIC_BACKEND_URL` | `https://nuelexity-backend.onrender.com` |
| `BUN_PUBLIC_SUPABASE_URL` | Existing project public URL, `https://afavuxsdbbvgblhxnpcj.supabase.co` |
| `BUN_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Existing **public publishable/anon** key, carried from the current whitelisted `config.json`; no key rotation is requested. |
| `BUN_PUBLIC_TURNSTILE_SITE_KEY` | Existing non-test public site key from the current whitelisted `config.json`. It must belong to the intended production widget. |

The current concrete four-field values are available locally in `pages-review/config.json` after `npm run pages:prepare`; copy those public values into Pages build settings. They are not copied into a committed dotenv file. Production output rejects localhost backend settings, missing/test Turnstile keys, extra settings and Supabase service-role/secret keys. Build-time values must be correct because static hosting has no Node runtime `/config.json` override.

Before release, confirm the widget allows **`nuelexity.devs.surf`**, its existing secret remains only on the backend, and hostname/action/pairing acceptance passes. A production-shaped key alone does not prove those dashboard settings. Do not put provider keys, service-role keys, database URLs/passwords, guest signing secrets or Turnstile secrets in Pages build variables. No paid plan, proxy model gateway, analytics, optional tracker or Functions binding is needed.

## Keep publication manual

**Recommended for manual control:** create a **Direct Upload** Pages project only when publication is authorized, build the approved revision locally and upload `pages-dist/` manually. GitHub pushes cannot publish a Direct Upload project. This option does not use cloud build fields, but the same Node/npm settings and release command produce its artifact. A Direct Upload project cannot later become Git-integrated without creating another project; see [Direct Upload](https://developers.cloudflare.com/pages/get-started/direct-upload/).

If the owner chooses Git integration instead:

1. Keep the repository disconnected while the current policy/Google gates fail. Do not click **Save and Deploy** merely to prepare a connection; a first connection can launch a build.
2. After approval, set the build/output fields above. Under **Settings → Builds & deployments → Configure Production deployments**, clear **Enable automatic production branch deployments** and save.
3. Under preview branch controls choose **None** and save. The default is to build every non-production branch; disabling only production is insufficient.
4. Add no deploy hook and no GitHub Actions deploy job. Existing Actions run checks only. Leave those checks enabled.
5. Use an explicit manual deployment/retry for the approved commit. Recheck both saved branch controls before subsequent pushes.

These controls follow [Cloudflare branch deployment controls](https://developers.cloudflare.com/pages/configuration/branch-build-controls/). Preparation commits use the Cloudflare-specific **`[CF-Pages-Skip]` prefix**, documented in [GitHub integration](https://developers.cloudflare.com/pages/configuration/git-integration/github-integration/), to suppress an incidental Pages Git build while preserving ordinary GitHub Actions checks. This is an additional control, not a substitute for the publication gate or saved project settings.

## What the static artifact actually contains

- Prerendered `index.html`, `about.html`, `legal.html`, a real `404.html`, generic private documents for account/auth/dashboard, `auth/callback.html`, and the private-conversation rewrite target.
- Only `assets/`, approved `brand/` assets, four-field `config.json`, `robots.txt`, `sitemap.xml`, generated `_headers` and `_redirects` accompany those documents. No source, Node server, report, screenshot, recording, dotenv file or policy hash/build metadata is copied.
- Public route documents are flat `.html` files so Pages serves `/about` and `/legal` at their existing canonical URLs. Explicit trailing-slash redirects preserve them. `/dashboard/*` rewrites to the generic private document; there is **no catch-all rewrite to the public home page**. Unknown paths/assets retain actual 404s. This uses [Pages file matching/404 behavior](https://developers.cloudflare.com/pages/configuration/serving-pages/) and [proxy rules](https://developers.cloudflare.com/pages/configuration/redirects/).
- Static security headers retain the approved CSP, no-referrer, nosniff, frame protection and device-permission restrictions. CSP connects only to self, the approved backend, the configured public Supabase origin and Turnstile. Structured-data hashes are taken from the actual build.
- Public production HTML uses Pages' normal revalidation behavior, without local-preview blanket `noindex`/`no-store`. Fingerprinted assets are browser-cacheable/immutable. Public indexing/canonical/social metadata and the sitemap target **https://nuelexity.devs.surf**.
- Account/auth/callback/private conversation routes and both sides of the private rewrite receive `noindex, nofollow` and `private, no-store`. Config is `no-store`. Generic private HTML contains no account/thread text. Noindex is not authentication; the existing backend ownership checks still apply.
- Both the production `*.pages.dev` hostname and version preview hostnames get noindex rules; only the intended custom domain's public pages are indexable. Keep zone Cache Rules from overriding private/config directives or caching API/callback responses. `_headers` behavior is documented by [Cloudflare](https://developers.cloudflare.com/pages/configuration/headers/).

`npm run preview:local` remains a separate loopback Node preview with blanket `noindex, nofollow`/`no-store`; those headers are not copied into the static public artifact. `npm run pages:prepare` creates **`pages-review/`**, an explicitly unapproved local inspection fixture, never the configured Pages output. Do not upload `dist/` or `pages-review/` to bypass release checks.

## Domain and DNS: use Cloudflare's actual target

No Pages project/domain has been created by this preparation. **A real Pages hostname has not been assigned.** Do not assume `nuelexity.pages.dev` or any DNS IP.

After publication is authorized:

1. Create/select the Pages project and copy its **actual generated `<project>.pages.dev` hostname** from Cloudflare.
2. In that project's **Custom domains → Set up a domain**, enter `nuelexity.devs.surf`. Associate it with the project before creating an external CNAME.
3. Use the exact target/validation records Cloudflare displays. If the authoritative zone is `devs.surf`, its administrator creates `CNAME nuelexity → <actual-project-hostname>.pages.dev`; many DNS interfaces also accept the full name `nuelexity.devs.surf`. The target has no `https://` or path. If the zone is managed by Cloudflare, follow its offered record creation. No parent-domain nameserver change or guessed IP is required for this subdomain.
4. If the subdomain is delegated or DNS is controlled by another operator, give that operator Cloudflare's exact requested records. Preserve unrelated DNS records; resolve conflicts only for this hostname.
5. Wait for Cloudflare to show the custom domain active and HTTPS ready, then verify that the certificate covers `nuelexity.devs.surf`. Follow any actual CAA/domain-validation requirement Cloudflare reports.

Cloudflare warns that creating the CNAME without first associating the domain can fail. These steps derive from its [custom-domain documentation](https://developers.cloudflare.com/pages/configuration/custom-domains/); the actual target is a remaining setup result, not an already-known value.

## Required checks before a manual upload

1. Review [the full policy and decisions](POLICY_REVIEW.md). Apply only approved wording, set the approved effective/review dates and policy flags, and obtain the separate owner Google-branding confirmation before setting `googleBrandingVerified: true`.
2. Run `npm run check`, `npm run release:check`, then `npm run build:pages`. All must pass. A deployable artifact exists only after the last command succeeds.
3. Review the staged/outgoing diff and run `npm run audit:release`. No environment/evidence/private report is to be staged. The old local working documents remain outside the intended release; the GitHub source repository is public.
4. Reuse the owner-approved demo/Firefox/zoom evidence for the unchanged presentation. Rerun the affected Pages and existing browser checks as documented below after hosting/policy/configuration changes.

Local static-handler verification (no account or upload required):

```sh
npm run pages:prepare
WRANGLER_SEND_METRICS=false npx --yes wrangler@4.154.0 pages dev pages-review --ip 127.0.0.1 --port 8788 --compatibility-date=2026-10-23
# In another terminal, against that loopback emulator:
npm run test:pages
npm run test:browser
```

The Pages browser test intercepts fake config/auth/backend responses, rejects every external request and sends no query. It also reads actual artifact HTTP responses to check CSP/caching/indexing/deep links/404s. This is local emulator evidence, not a claim that Cloudflare's live project, DNS or widget has been accepted.

## Short production acceptance checklist

- [ ] Policy/Google gates pass for the exact revision; automatic production/preview deployments are disabled or the project is Direct Upload.
- [ ] Custom-domain HTTPS, home/About/legal, manifest/fonts/icons/social image, sitemap/robots, canonical URLs, true missing-page/asset 404s and pages.dev noindex all behave as prepared.
- [ ] Private account/auth/callback and a signed-in owned conversation deep link refresh correctly with noindex/no-store; no sensitive document is edge/browser cached.
- [ ] Existing GitHub sign-in still works; Google's branding confirmation is recorded and its sign-in/cancel/error behavior is checked on the production origin. No OAuth redesign is introduced.
- [ ] The backend permits the exact production origin. Guest Turnstile verifies with the intended widget; same-tab pass reuse/expiry, account isolation and sign-out cleanup work. These checks need no search/generation call.
- [ ] Only a separately authorized, deliberately small guest/signed-in search tests live streaming/sources/Stop/model access and quota behavior. Do not run it as part of this preparation, auto-retry or consume credits in CI.
- [ ] Physical mobile keyboards/safe areas, a real screen reader and Safari remain owner acceptance unless performed separately. Prior Chrome and native Firefox zoom evidence is not a substitute.

## Rollback

Record the successful production deployment ID, source commit and approved artifact before a later release. Keep auto-deployments off. If a new release fails, use **Pages → Deployments → the previous successful production deployment → Rollback** and recheck public/private routes, headers and config. Cloudflare supports [production rollbacks](https://developers.cloudflare.com/pages/configuration/rollbacks/); do not roll back the backend or database for a static frontend regression.

For a first deployment with no prior good production version, manually upload a minimal static maintenance page with `noindex`/`no-store` and no app scripts while fixing the release, or have the owner withdraw the site. Removing only the custom-domain CNAME does not withdraw its default pages.dev URL. Do not silently delete the project or modify DNS. Preserve the failed artifact privately for comparison; fix on a new commit and repeat gates/checks before the next explicit manual deployment. A Git revert alone does not redeploy while automatic deployments are disabled.
