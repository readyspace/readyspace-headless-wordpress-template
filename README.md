# ReadySpace Headless WordPress Starter Template

Reusable Next.js **App Router + TypeScript**, WordPress **WPGraphQL**, Rank Math editorial SEO and UltimateSales.ai/HighLevel integrations, deployed on ReadySpace cPanel. This v2 replaces the original Faust/Pages Router starter. Existing sites require a URL/content/conversion audit before adopting it; this repository does not migrate or deploy ReadySpace Academy.

## Architecture

```text
Public Next.js (main) ──── WPGraphQL ──── shared cms.<domain> WordPress
Staging Next.js (staging) ─ WPGraphQL ──── WPGraphQL + Rank Math + companion bridge
                                              │
                                 signed preview/cache invalidation
                                              │
Next.js server signup ───── HighLevel API v2 ───┤ pending opt-in / CRM
CMS newsletter plugin ───── HighLevel API v2 ──┘ publishing-triggered delivery
```

**All Next.js WordPress content/SEO queries use WPGraphQL only.** No Rank Math REST endpoint, WordPress REST client or Faust data layer remains. Rank Math does not natively expose all SEO data through GraphQL. The included [WordPress bridge](docs/wordpress.md) supplies a documented, published-only snapshot schema from Rank Math's native HTML output. Its CMS-local HTML warm requests are not frontend data fetches. Compatibility, snapshot freshness and site-specific Rank Math/PRO behavior must pass CMS acceptance before launch.

## Start locally

Use GitHub **Use this template**, create a separate repository for each website, and clone it through GitHub Desktop. Install Node 22 (server must support it), then:

```sh
cp .env.example .env.local
npm ci
npm run dev
```

Fill in the canonical production origin, actual deployment origin, shared CMS GraphQL endpoint, name/locale and menu location. Install/configure the bridge in WordPress as documented; never put secrets into `NEXT_PUBLIC_*` variables. Run the private read-only schema check with `node --env-file=.env.local scripts/check-cms.mjs`. `npm run typecheck`, `npm test`, `npm run build` and `npm run smoke` run without a live CMS; the build does not prove live integration. An unconfigured starter has noindex metadata.

## Included behavior

- Server-rendered Post/Page URI resolution, category/tag/author/blog archives, numbered archive pagination, navigation and CMS media URLs.
- Rank Math title/description/canonical/robots/OpenGraph/Twitter/JSON-LD, GraphQL paginated production sitemap and sitemap index. Staging noindex headers, metadata and blocked sitemap.
- Public anonymous GraphQL reads, private no-cache previews with signed short-lived tokens, HMAC CMS publication invalidation and bounded cache TTL.
- Validated lead and newsletter form endpoint. Signup starts OFF; pending confirmation, DND/suppression preservation, bot verification and distributed abuse controls are required before enabling.
- Optional consent-gated GA4/GTM, GSC/Bing verification, Google Maps and Google review link. A Maps/Reviews API rating display needs a separate audited provider implementation; this starter makes no invented claims.
- GitHub Desktop → staging → reviewed main → cPanel Git pull/build/restart with candidate releases, health verification and rollback.

`SignupForm` can be added to a site-specific page using `<SignupForm kind="newsletter" privacyUrl="/privacy/" turnstileSiteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || ""} />` (or `kind="lead"`); there is no automated newsletter campaign activation. Install the existing newsletter plugin separately: its alpha status, pending licensing and exact requirements are recorded in [integration documentation](docs/integrations.md).

## Read before release

- [Migration and URL acceptance](docs/migration.md)
- [WordPress schema, preview and publication setup](docs/wordpress.md)
- [CRM, newsletters and optional integrations](docs/integrations.md)
- [cPanel staging, production and rollback](docs/deployment.md)
- [Verified source audit and limits](docs/audit.md)
- [Validation and remaining acceptance](docs/validation.md)
- [Reusable per-site handoff prompt](docs/handoff-prompt.md)

Plain/query permalinks, custom types/taxonomies, feeds/date/language archives, page-builder functionality, historical upload paths and site-specific redirects require explicit adapters and acceptance; generic GraphQL URI lookup is not evidence that every legacy route is preserved. Keep production approval, DNS changes and CMS newsletter LIVE activation outside template development.

## Licensing

Frontend/template code: [MIT](LICENSE). The separately packaged WordPress bridge under `wordpress/readyspace-headless/` is **GPL-3.0-or-later** under its own license, overriding MIT for that directory. WPGraphQL/Rank Math are separately installed dependencies; Rank Math PRO needs a legitimate per-site license. The newsletter plugin is not bundled because its audited source does not yet grant a finalized reuse license.
