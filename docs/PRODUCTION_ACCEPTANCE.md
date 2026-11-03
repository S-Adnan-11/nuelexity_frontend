# Post-deployment acceptance — public portfolio beta

Production acceptance is **pending**. A passing build prepares the artifact; it cannot prove production results. Cloudflare Access, named tester windows and additional launch approvals are not default requirements. The deployment itself is a deliberate owner action using [the GitHub-connected Pages procedure](CLOUDFLARE_PAGES_RELEASE.md).

After deploying, record the actual origin, deployment ID, source SHA, date and pass/fail result for:

- HTTPS/custom domain; home/About/legal and footer anchors; assets, real missing-page/asset 404s, sitemap/canonical and pages.dev noindex; both themes, mobile and keyboard behavior. Informational pages remain readable without an account or Turnstile.
- Two initially unchecked eligibility confirmations; readable/scrollable layout; private app code loads after confirmation; system theme initially and explicit theme persistence.
- Real Google (after branding confirmation) and GitHub sign-in/cancel/error/return with unchanged callbacks; account details, owned conversation deep-link refresh, account separation and sign-out/stale-storage cleanup; private no-store/noindex headers.
- The existing Render origin permits the frontend; automatic guest Turnstile verifies for the actual hostname/action/secret pairing; same-tab pass reuse, expiry/reverification and startup coordination work. Do not infer these live results from public keys or local mocks.
- Local fake-service quota, invalid-pass, cancellation and isolation checks already passed. Any necessary live guest/signed-in streaming/source/Stop/model check needs explicit bounded AI/search permission within free allowances; this task grants none. An unperformed required live check stays pending and must never be recorded as passed. No automatic replay, retries or paid fallback.
- Physical mobile, Safari and a real screen reader if tested; otherwise state that limitation without treating local Chrome/Firefox evidence as those tests.

If a check fails, record the precise failure and use the existing rollback procedure as appropriate. After the actual required checks pass, record `productionAcceptanceComplete: true` for the tested release; do not flip it merely to build or deploy. Changing the factual status is not another launch-approval system. Recheck affected behavior after later runtime/config changes.

Backend production code is unchanged by this release. Preserve the existing Render deployment, secrets, tables and applied migrations.
