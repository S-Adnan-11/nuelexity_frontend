# GitHub-connected Cloudflare Pages release

Use **S-Adnan-11/nuelexity_frontend**, branch **`release/frontend-v1`**. Deploy the consolidated branch HEAD, not `9b9aec5` alone. This task prepares and pushes source only; it does not create a project, deploy, change a dashboard or make live AI/search calls. The existing Render backend needs no code update or migration.

## Build settings

| Field | Full application |
| --- | --- |
| Product / integration | Cloudflare **Pages**, connected to GitHub; free plan |
| Repository / production branch | `S-Adnan-11/nuelexity_frontend` / `release/frontend-v1` |
| Root directory | Leave blank: this independent repository's root |
| Framework preset | None |
| Build command | `npm install --global npm@12.0.2 && npm ci --include=dev && npm run build:pages` |
| Output directory | `pages-dist` |
| Build image / Node | v3 / `NODE_VERSION=22.23.2` (also pinned in `.nvmrc`) |
| Installation | `SKIP_DEPENDENCY_INSTALL=1`; command installs pinned npm and canonical lockfile dependencies |
| Other build settings | `NUELEXITY_ENV_FILE=none`, `NPM_CONFIG_INCLUDE=dev` |
| Production deployments | **Enable automatic production branch deployments: off** |
| Preview branches | **None** |

The explicit npm install avoids depending on whether v3 honors an npm version override. No Node server, Worker, Functions, paid plan or Cloudflare Access layer is needed. See [build image/custom installation](https://developers.cloudflare.com/pages/configuration/build-image/).

The only application settings copied into browser `config.json` are `BUN_PUBLIC_BACKEND_URL`, `BUN_PUBLIC_SUPABASE_URL`, `BUN_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and `BUN_PUBLIC_TURNSTILE_SITE_KEY`. Their existing values and runtime settings are in the operator's **ignored, private local `.env.cloudflare-pages.local`**. Copy those four application values into Pages production build variables. Keep existing public keys, callbacks and provider settings; add no backend secret, service-role key or database password. The artifact validator rejects extra settings, private keys, localhost backends and test widget keys.

## Connect and turn automatic deployment off

1. In **Workers & Pages → Create application → Pages → Connect to Git**, authorize only the frontend GitHub repository and select `release/frontend-v1`. Choose Pages rather than Workers. Keep the GitHub Actions checks; they never deploy.
2. If creation exposes branch controls, turn automatic production deployment off and previews to None before saving. If controls appear only after project creation, use **`exit 1` as the temporary initial build command**: the initial setup build fails without publishing an artifact. Then open the new project's settings, complete the real settings above and proceed below. Do not create an initial public full-app deployment merely to reach its settings.
3. Project **Settings → Builds / Builds & deployments → Branch control / Configure Production deployments**: set production branch `release/frontend-v1`, clear **Enable automatic production branch deployments**, and save. Under preview branch controls choose **None** and save. Reopen both saved controls to verify. Cloudflare currently uses both labels in its guides; [branch controls](https://developers.cloudflare.com/pages/configuration/branch-build-controls/) and [Git integration](https://developers.cloudflare.com/pages/configuration/git-integration/) describe them.
4. Leave automatic deployment disabled for every later push. Preparation commits use the documented `[CF-Pages-Skip]` prefix as an additional safeguard, not proof of dashboard configuration. Do not use Wrangler asset upload or a Direct Upload project for this workflow.
5. Project **Custom domains → Set up a domain**: associate `nuelexity.devs.surf` before creating its CNAME, follow the exact target/validation Cloudflare displays, and preserve unrelated DNS. Wait for Active/HTTPS. Do not guess a Pages project hostname. [Custom domains](https://developers.cloudflare.com/pages/configuration/custom-domains/).

## Deliberately build the connected branch

After settings and the concrete publication items below are addressed, use Cloudflare's [Create a Pages deployment API](https://developers.cloudflare.com/api/resources/pages/subresources/projects/subresources/deployments/methods/create/). It explicitly supports a Git branch and builds that branch's **HEAD**; no uploaded manifest or artifact is supplied. The existing repository must be authorized in Pages. Use an account-scoped token with **Pages Write** and actual account/project identifiers, kept privately. Do not put them in frontend build settings or Git.

```sh
curl --fail-with-body --silent --show-error --request POST   --header "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}"   --form-string 'branch=release/frontend-v1'   "https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/pages/projects/${CLOUDFLARE_PAGES_PROJECT}/deployments"
```

This is an explicit Git build, independent of automatic push/preview triggers. The API documentation was checked; **no live API request was made**. Keep the branch unchanged while triggering and compare the resulting deployment's Source commit with the full release SHA supplied in the handoff. A `commit_hash` metadata field is not a substitute for checking which HEAD was built. A retry of an old deployment should not be assumed to fetch the newly pushed revision.

## Google and first policy publication

If Google branding is still pending, first use the same connected branch with build command `npm install --global npm@12.0.2 && npm ci --include=dev && npm run build:public`, output **`pages-public-dist`**. This minimal mode contains only public homepage/About/legal plus closed app-route shells; it restores no accounts and makes no API, OAuth or Turnstile requests. It needs no application environment values. Keep the same branch controls off and trigger it deliberately using the API above.

Publish genuine, unauthenticated pages at **https://nuelexity.devs.surf/**, **https://nuelexity.devs.surf/about**, **https://nuelexity.devs.surf/legal#privacy**, and **https://nuelexity.devs.surf/legal#terms**. Footer anchors match these URLs. Do not put authentication or Turnstile in front of Google reviewers. In `site-content.json`, set `effectiveDate` to the actual first-policy publication date before this first live build; keep that date on later builds until the policy changes. It is currently null because publication has not occurred; no date is backdated or fabricated.

Submit these URLs in the existing Google Auth Platform branding configuration. Only record `googleBrandingVerified: true` after actual confirmation. Then change build/output to the full-app settings above and deliberately build the same consolidated release branch. Actual OAuth callback `/auth/callback`, Supabase provider callback, redirect allowlist and client scopes stay unchanged. Google completion is a publication sequence item, **not a prerequisite to compiling the app**. No additional named-test window, Access installation or multiple launch-approval workflow is imposed.

## Concrete unresolved publication items

These are factual/legal items, not blanket approval checkboxes. Existing private assessments/runbook stay local; generating them is not regulatory approval.

- **Recipient facts and transfer ground:** project regions, account-specific retention/controls and applicable agreements cannot be inferred from public keys, the Render Frankfurt template or general provider documentation. Check Supabase project settings/backups/logs; Render service settings/logs; Groq Data Controls; Tavily account terms; Cloudflare account/Turnstile settings and support-mailbox arrangements. The actual recipient/country/safeguard basis must be recorded under **NDP Act ss41–43 and final GAID Art45/Schedule5**. Supabase confirms core data/backups follow the selected region with other operational processing; Groq documents US storage of retained inference content. Neither a generic DPA nor foreign SCCs alone establish Nigerian adequacy. **GAID Art18(1)(e)** must be addressed with the chosen ground: its consent language for destinations without an NDPC adequacy decision is subject to the Act; no applicable decision or flow-specific resolution is evidenced here. Do not invent consent or add a blanket terms checkbox as a substitute.
- **Actual DPIA steps:** final **GAID Art28(3)(o)** lists cross-border data transfer; **28(4), (9), (12)** require accredited certified-DPO vetting/signature and submission before processing where required. A factual DPIA/transfer draft already exists privately; no evidence of that vetting/submission is available. Resolve/record these actual requirements or an authoritative applicable determination before the affected public processing. This can also affect static hosting network data; a Google-only page does not remove it. The [final NDPC GAID](https://ndpc.gov.ng/wp-content/uploads/2025/03/NDP-ACT-GAID-2025-MARCH-20TH.pdf) supplied locally was checked, alongside the [enacted Act](https://dataprotection.africa/wp-content/uploads/Nigeria_DPA-23.pdf). No paid engagement, filing or regulator contact is authorized here.
- **Publication inputs:** actual first-policy date, Google outcome where needed, and the saved Pages settings above. Source cannot establish live dashboard toggles, origin/widget pairing or host-injected analytics. No optional analytics/advertising is authorized. These facts are not marked complete.

Verified general provider sources: [Groq data handling](https://console.groq.com/docs/your-data), [Tavily privacy](https://www.tavily.com/privacy), [Supabase residency/transfer FAQ](https://supabase.com/legal/privacy-resources/data-residency-and-transfers-faq). They support the qualified public disclosures, not an assertion about unseen account settings.

## Verification, acceptance and rollback

Locally run `npm run check`, `npm run build:pages`, `npm run release:check`, `npm run test:browser`, `npm run test:eligibility`, `npm run test:theme`, `npm run test:about`, `npm run test:about-details` and the actual loopback Pages-handler checks. These use fakes; no real search/model credit or authentication is used. `pages-dist/` is deliberately buildable while `productionAcceptanceComplete` is false. Content/config freshness, strict public-config validation, CSP, private no-store/noindex routes, true 404s and the explicit static allowlist remain enforced. No private docs, evidence, dotenv, source maps, source, Functions or build metadata is copied to the artifact.

After deployment follow [production acceptance](PRODUCTION_ACCEPTANCE.md). Record real production results only after testing the actual frontend origin. No Render redeploy or migration is part of this frontend release.

For each release retain its deployment ID, Git SHA and settings privately. If it fails, use **Pages → Deployments → previous successful production deployment → Rollback**; this promotes that already-built version, not a new Git build. Check HTTPS/routes/headers again. For a first full-app failure, roll back to the prior information-only deployment. If no successful prior deployment exists, fix the source/settings and trigger a deliberate new Git build; keep the failing deployment from being treated as accepted. Changing DNS alone does not withdraw the pages.dev hostname. Do not reset the database or redeploy Render to fix a frontend artifact. [Cloudflare rollbacks](https://developers.cloudflare.com/pages/configuration/rollbacks/).
