# Consolidated frontend release

Use `release/frontend-v1` HEAD after the final handoff, including the accepted About frame/icons, approved 64-second playback and the complete reviewed eligibility, theme, public-page, policy, account/workspace and automatic guest-verification implementation. The prior `9b9aec5` commit alone is incomplete. The latest owner edits to eligibility/theme are preserved exactly and included.

The deployment target is GitHub-connected Cloudflare Pages with automatic production deployment off and preview branches None. See [exact settings/manual trigger/rollback](CLOUDFLARE_PAGES_RELEASE.md) and [post-deployment checks](PRODUCTION_ACCEPTANCE.md). Artifact builds no longer depend on fabricated production acceptance or duplicate review flags. Google branding and production acceptance remain factual, pending results; the minimal public-information build can supply Google's initial policy URLs.

[FINAL_POLICY.md](FINAL_POLICY.md) is the assembled full-app public policy exported from the rendered legal page. Private assessments, rights procedures, reports, evidence and credentials remain ignored and are excluded from source commits/static artifacts. Historical owner changes in `docs/HANDOFF.md` and the supplied policy-review record are preserved separately and do not supply missing runtime code.

No backend production code changes, Render redeployment, migration, dashboard change, live AI/search call or deployment is included in this preparation.
