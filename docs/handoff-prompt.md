# Per-site implementation handoff

Use this prompt with a fresh repository created from the approved ReadySpace starter version. Supply URLs and account identifiers; provide credentials only through the secure local/server environment.

```text
Implement a migration using https://github.com/readyspace/readyspace-headless-wordpress-template.
Production: [https://domain]
Staging: [https://staging.domain]
Shared WordPress CMS: [https://cms.domain]
cPanel: [server URL; supported Node runtime/app root]
Per-site GitHub repository: [URL]
UltimateSales.ai location: [UI URL and API location ID]
Required preserved URLs/integrations: [known constraints]

Audit the real existing content, permalinks, canonical/robots/schema, taxonomies,
menus/media, redirects, sitemap/feed/archive/language routes and conversion paths.
Read docs/migration.md and record every public URL with acceptance evidence.
Use Next.js App Router + TypeScript and WPGraphQL for ALL WordPress content/SEO.
No WordPress REST or Rank Math REST endpoint. Install the companion bridge and
verify compatibility/license, public/private boundaries and SEO snapshot freshness.
Keep all CRM/preview/revalidation secrets server-side. Newsletter signup is pending
confirmation and must preserve DND/suppression; publication plugin starts OFF until
controlled TEST delivery and explicit LIVE approval. Preserve existing forms/funnels.

Work locally through GitHub Desktop: feature branch -> staging -> reviewed main ->
cPanel Git pull/build/restart. Shared CMS, separate apps/env/secrets; noindex staging,
separate CRM test location. Run tests/build/CMS and every legacy URL acceptance check.
Prepare a reviewable PR and deployment/rollback evidence before production approval.
Do not merge/deploy/change DNS or start real email campaigns without approval.
Report verified changes, tests, remaining adapters/blockers and links.
```
