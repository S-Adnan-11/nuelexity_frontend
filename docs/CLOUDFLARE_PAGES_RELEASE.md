# Build and deploy the frontend on Cloudflare Pages

The frontend and API deploy independently. Cloudflare Pages serves the browser application; the [backend](https://github.com/S-Adnan-11/nuelexity_backend) supplies the API.

## Build settings

Connect the frontend Git repository to a **Pages** project and select the branch you release from. Set the framework preset to **None** and leave the root directory empty.

| Field | Value |
| --- | --- |
| Build command | `npm install --global npm@12.0.2 && npm ci --include=dev && npm run build:pages` |
| Build output directory | `pages-dist` |
| Build image | v3 |
| Build variables | `NODE_VERSION=22.23.2`, `SKIP_DEPENDENCY_INSTALL=1`, `NUELEXITY_ENV_FILE=none`, `NPM_CONFIG_INCLUDE=dev` |

Add the four public settings in the [README](../README.md#run-locally) for the production build. Use the current API origin (`https://nuelexity-backend.onrender.com`), the public Supabase settings for the same project as the API, and the production Turnstile site key. Never place server credentials in the frontend build.

Configure the public hostname in Pages before pointing DNS at its assigned target. Add the same origin to the backend's `FRONTEND_ORIGINS`, the hostname to the Turnstile widget, and the frontend's `/auth/callback` URL to Supabase Auth's redirect list. The OAuth provider callback remains the Supabase callback.

## Artifacts and publishing

`npm run build:pages` creates the deployable application. `npm run pages:prepare` creates a local review fixture in `pages-review/`; it is not deployment output. `npm run build:public` builds a separate information-only site to `pages-public-dist/`. Use the full application artifact for the research workspace.

Nuelexity's frontend releases are triggered manually from Git. Use a [Pages deploy hook](https://developers.cloudflare.com/pages/configuration/deploy-hooks/) or the [Create deployment API](https://developers.cloudflare.com/api/resources/pages/subresources/projects/subresources/deployments/methods/create/) for the intended branch. A hook URL can trigger a deployment; keep it out of source and logs. Confirm the resulting deployment's source commit.

After deploying, check the public homepage, guest verification, OAuth return and private thread navigation on the production hostname. The artifact checks establish that files are packaged correctly; they do not verify production service configuration. To restore a previous successful release, use [Pages rollback](https://developers.cloudflare.com/pages/configuration/rollbacks/).
