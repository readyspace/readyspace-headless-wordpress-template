# GitHub Desktop, staging and cPanel deployment

This starter uses `staging` for integration and `main` for reviewed production releases. Both frontends read one WordPress installation at `https://cms.<domain>`. The template task does not migrate Academy, create hosting resources or change live routing.

## First-time site setup

Create a new site repository from this template. Keep `main` and `staging`, require this repository's checks/review before merging, and use GitHub Desktop for the normal local commit/push workflow. Make code changes on a feature branch into `staging`, or follow the site's existing staging conventions. Do not rewrite shared branches. A staging-to-main PR must contain the exact accepted code; changes after staging acceptance require another review.

Before migration, audit existing permalinks, CMS IDs, taxonomy/search/feed/sitemap behavior, redirects across WordPress/CDN/server layers, existing forms/CRM funnels, uploads and licensing. Take private backups and demonstrate an isolated restore. Reconcile content/media deltas immediately before any eventual site cutover. Keep this inventory with the site repository, without personal records or secrets.

Install WPGraphQL, Rank Math and the supplied ReadySpace GraphQL extension in the shared CMS through the WordPress administrator's normal installation process. Use its documented flags and tests. There is no frontend `wp-json` or Rank Math REST adapter. Do not use a CMS-wide search-engine setting that turns all public Rank Math output into noindex; protect CMS HTML by hostname and verify the public GraphQL robots output independently. Restrict CMS admin by normal authentication/access controls without blocking the frontend's GraphQL connection. Leave newsletter processing OFF while setting up; follow [integration acceptance](integrations.md) before changing it.

One CMS means publishing changes can affect both frontends. Code staging is not editorial content isolation. Use drafts/private posts and the authenticated preview flow for editorial tests; mark test content excluded before any publication if the CMS newsletter worker is active. Never clone a live CMS publisher into a second sending installation.

## Hosting layout and runtime

Create two private cPanel Git checkouts and two separately registered applications, all owned by the correct hosting account. These are example **paths**, not settings to copy unchanged:

```text
/home/ACCOUNT/repositories/SITE-staging/      checkout: staging
/home/ACCOUNT/repositories/SITE-production/   checkout: main
/home/ACCOUNT/apps/SITE-staging/
  app.js                                    stable Passenger bootstrap
  current -> releases/<timestamp-commit>/
  releases/<timestamp-commit>/               code, dependencies, .next, private env
  public/                                   cPanel public alias only
  tmp/restart.txt
  .previous-release
/home/ACCOUNT/apps/SITE-production/           same structure, separate app
/home/ACCOUNT/private/SITE/staging.env         mode 600, outside Git/web root
/home/ACCOUNT/private/SITE/production.env      mode 600, outside Git/web root
```

Configure a supported Node 22 or 24 runtime in cPanel's Application Manager or Setup Node.js App. The control panel differs by server: activate the **exact virtual-environment command shown by that account**, then confirm `node --version`, `npm --version` and `command -v node`. Do not guess another site's NodeSelector path or assume an interactive system Node is the app's runtime. Configure startup file `app.js`, application root `/home/ACCOUNT/apps/SITE-staging` or `...-production`, and its assigned frontend hostname. Each app needs its own root, environment, logs and restart marker.

The bootstrap resolves `current` once, loads that release's private configuration and dependencies, and records the selected `.release-commit` in health responses. Passenger/NodeSelector must run under the owning account and support this loopback HTTP startup contract; verify this on the actual host before cutover. On ReadySpace LiteSpeed, a touched marker can leave an old worker alive. Use the supported cPanel application **Restart** control if required, then verify the returned commit. Do not kill all Node processes or signal unrelated apps.

Keep the CMS on its separate virtual host. Configure HTTPS, public asset serving and required proxy/Passenger directives through the hosting account's normal tooling. Preserve cPanel-owned PHP/Passenger blocks when adjusting any site-specific routing. This starter does not generate or replace origin `.htaccess`, remove WordPress files, change DNS or create public-root aliases. The app serves its own Next.js assets; do not expose release directories, `.git`, environment files or private backups as static content.

## Private environment files

Copy `.env.example` into each private server environment file and fill it through secure hosting controls. Never commit it or put credentials in clone URLs. Use a repository-specific read-only deploy key when the site repository is private.

Staging requires `SITE_ENV=staging`, production `SITE_URL`, separate staging `DEPLOYMENT_URL`, and the shared `WORDPRESS_GRAPHQL_URL`. Production requires `SITE_ENV=production` and matching public `SITE_URL`/`DEPLOYMENT_URL`. Both environments must use HTTPS and a separate CMS origin. Secrets remain server-only; the bootstrap rejects a release/environment mismatch. Keep any cPanel environment values aligned with the private file, because externally set variables take precedence over dotenv files.

CRM signup defaults to disabled. Staging signup requires explicit test-only location/token configuration and the staging approval flag; it must never fall back to the production location. Analytics delivery remains off on staging. CMS newsletter mode is a CMS setting, not a frontend environment toggle; deploying this app cannot safely turn it on or off. See [integrations](integrations.md).

Changing build-time public configuration requires a new build even when the Git commit is unchanged. Retain per-release environment files with the corresponding build. A frontend rollback selects that prior pair, but inherited cPanel/NodeSelector environment values still take precedence: separately restore any changed hosting variables before accepting recovery. A rollback does not revoke credentials, recall mail or reverse CMS/CRM records.

## Staging deployment

1. In GitHub Desktop, fetch/pull the site's `staging`, complete changes and checks, review the diff, commit and push.
2. In cPanel Git Version Control, use **Update from Remote** on the staging checkout. Verify branch, clean tree and the exact reviewed commit.
3. In the owning account's Terminal, activate the application's configured Node runtime. Run the checked-in script with real private paths and the exact reviewed hash:

```bash
bash /home/ACCOUNT/repositories/SITE-staging/scripts/deploy.sh \
  staging \
  /home/ACCOUNT/repositories/SITE-staging \
  /home/ACCOUNT/apps/SITE-staging \
  /home/ACCOUNT/private/SITE/staging.env \
  https://staging.example.com/api/health \
  REVIEWED_40_CHARACTER_COMMIT
```

The script checks account/path/config/branch safety, performs fetch plus fast-forward-only pull, and refuses a hash different from the reviewed commit. It archives that commit into a fresh release, installs locked dependencies, validates the environment, runs TypeScript/tests/build and starts a temporary loopback candidate. Candidate readiness checks the actual CMS/schema and reports the exact commit. Only then does the script atomically select `current`, touch Passenger's restart marker and verify the public readiness response/serving commit. It retains prior browser assets and the previous release pointer.

If hosted verification fails after selection, it reselects the previous release and checks serving recovery. If the host fails to restart, it explicitly reports recovery as unverified; use cPanel Restart and confirm the commit before continuing. For the first release there is no previous app: the failed selection is removed. Keep pre-migration public routing/site files intact until a separate accepted cutover plan exists.

The script can be called from a site's reviewed `.cpanel.yml` **Deploy HEAD Commit** task with fixed private paths and the exact reviewed commit. Do not add an auto-deploy task that publishes every new main commit before review. A queued task, successful pull, finished build or selected symlink is insufficient evidence of the serving release.

4. Verify HTTPS and the exact commit at `/api/health?ready=1`, staging noindex in HTML/header/robots and absence from public sitemaps. Crawl the complete URL preservation inventory; test redirects/query retention, content/media/navigation/taxonomies, Rank Math metadata/schema, authenticated drafts/preview and publish/update/withdrawal behavior. Use synthetic identities and an isolated CRM location for any separately authorized form tests. No production recipient, appointment, charge or campaign should be created by routine deployment checks.
5. Record the accepted commit, deployment environment, CMS/schema/plugin versions, evidence, decisions and rollback drill. Open or update the staging-to-main PR for review.

## Production promotion and reversal

After approval and merge, pull the clean `main` checkout through cPanel Git and run the same script with `production`, the separate production application/private file/health URL, and the exact approved main hash. The script does not merge branches, approve production or change public routing/DNS. Initial migration cutover remains a site-specific action after URL/conversion/backup acceptance; rehearse its independent routing reversal before proceeding.

For a frontend release rollback, verify the currently selected commit and run:

```bash
bash /home/ACCOUNT/repositories/SITE-production/scripts/rollback.sh \
  /home/ACCOUNT/apps/SITE-production \
  https://example.com/api/health \
  EXPECTED_CURRENT_40_CHARACTER_COMMIT
```

The rollback requires built releases inside this application's own release tree, matching environments, the exact current hash and the same deployment lock. It selects the saved previous release and environment file, restarts and verifies its public commit/readiness. Inherited hosting variables require the separate reconciliation described above. If a command fails, an interrupt/termination signal arrives, or readiness fails after mutation begins, it reselects the original release and reports recovery evidence. An abrupt host/power failure cannot run a shell trap; inspect the selected pointer and candidate's `.prior-release` recovery record, then independently verify the serving commit. A successful reversal atomically saves the forward release as the next reversal target. Preserve failed releases and private logs for diagnosis.

This operation restores frontend code only. It does not restore SQL, modify the shared CMS, reset newsletter history, alter contacts/orders or undo DNS. A code rollback can require disabling an incompatible CMS schema change through a separate reviewed plan. Never overwrite new editorial/customer records with an old backup without reconciling them. Keep at least the current and previous tested releases until recovery is accepted; do not delete a selected release or auto-prune private evidence.
