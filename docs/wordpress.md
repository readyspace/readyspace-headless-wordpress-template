# WordPress, WPGraphQL and Rank Math

The frontend obtains WordPress content and SEO **only through WPGraphQL**. It does not call WordPress REST or Rank Math's headless REST endpoint. Rank Math explicitly states that GraphQL is not supported out of the box in its [headless CMS documentation](https://rankmath.com/kb/headless-cms-support/). The included `wordpress/readyspace-headless` plugin is this project's schema extension; it is not an official Rank Math GraphQL integration.

## Installation and CMS configuration

1. Back up WordPress files and database. Install this bridge on an isolated development CMS first. This template task does not change the production Academy CMS, publishing settings, DNS or newsletter delivery.
2. Use a maintained WordPress release, PHP 8.1+ with DOM/libxml, and maintained WPGraphQL and Rank Math releases. Configure pretty permalinks. Both WordPress Address and Site Address must resolve to `https://cms.<domain>` for the fixed-origin snapshot renderer; a separate WordPress URL/siteurl split or subdirectory install requires a reviewed adapter change.
3. Copy `wordpress/readyspace-headless` into `wp-content/plugins/readyspace-headless`, excluding the test/config example files if desired. Activate WPGraphQL, Rank Math SEO and this bridge. Complete Rank Math’s official setup wizard (or choose its supported free registration skip) and configure Titles & Meta, social settings, schema and business settings in WordPress; a freshly activated but unconfigured Rank Math can omit its frontend head integration. The test blueprint uses the free wizard-skip option only in the isolated fixture; it supplies no Rank Math account/license credentials. Configure public post types/taxonomies with `show_in_graphql`, unique GraphQL names, and public queryability. Expose only the custom fields the site actually needs.
4. Preserve the existing permalink structure, page hierarchy, category/tag bases, navigation locations and media paths. The frontend resolves WPGraphQL URIs; it cannot infer historical redirects, deleted URLs, custom query routes or an existing page builder's interactive behavior.
5. Put real target origins and independent random revalidation/preview secrets into `wp-config.php` using `wordpress/readyspace-headless/wp-config.example.php`. Keep those secrets outside Git. The shared CMS may target production and staging; each target's secret must match that environment's server-side frontend configuration.
6. Keep WordPress's "Discourage search engines" disabled when the public frontend should be indexed: that global flag influences Rank Math's rendered robots directives. The bridge instead adds `X-Robots-Tag: noindex, nofollow` to native CMS responses; protect CMS copies at the hosting layer too. Frontend robots are controlled by environment and Rank Math's editorial settings.
7. Use a real server cron for WP-Cron on cPanel; traffic-triggered cron can leave publications stale. Monitor the WordPress admin warning for failed revalidation. Anonymous CMS loopback rendering must work without Basic Auth, redirects or external full-page caches intercepting the request. Ensure the native CMS theme renders Rank Math's `rank_math/head` action.

Do not enable Rank Math's headless REST support to make this adapter work. No administrative REST operation is required by the bridge. WordPress itself or separately installed third-party plugins may register administrative REST routes; this project neither calls those routes nor silently disables plugins that depend on them. Any requested future frontend/admin integration that requires REST must be explicitly reviewed with the owner first.

## Rendered SEO adapter and query contract

Rank Math uses the native WordPress query context and a per-request singleton to calculate SEO, including variables, global defaults, term settings, filters and schema. Reconstructing raw meta in Next.js loses that behavior; resetting private Rank Math internals via reflection also creates upgrade risk. This bridge captures Rank Math's normal `rank_math/head` output in a published, anonymous native CMS request, parses the title/meta/canonical and valid JSON-LD, and stores a one-day transient. Executable scripts and arbitrary head HTML are never exposed.

On a cache miss, the WPGraphQL resolver can warm **at most two** native HTML requests per GraphQL request to the configured CMS origin. This is CMS-internal rendering, not frontend WordPress data access: the frontend makes only GraphQL calls. The warm request has no cookies/authentication, does not automatically follow redirects, rejects unsafe paths, uses a bounded response/timeout and never receives a user-selected origin. One canonical permalink redirect may be followed manually only after validating the destination as the exact same CMS origin with a safe path; external origins, scheme/port changes, credentials and administrative routes are rejected. The canonical snapshot is also cached as an alias for the original slash variant. Pages can also be warmed by visiting their native anonymous CMS permalinks. This requires spare PHP worker capacity; a single-worker server can deadlock on loopback and fail readiness. Prewarm SEO before building a large sitemap/site audit rather than querying hundreds of cold SEO nodes in one request.

```graphql
query SeoForExistingUri($uri: String!) {
  readyspaceSeo(uri: $uri) {
    ready generatedAt title description canonical robots
    openGraphTitle openGraphDescription openGraphImage
    openGraphUrl openGraphType openGraphSiteName
    twitterCard twitterTitle twitterDescription twitterImage jsonLd
  }
  readyspaceSettings { frontPageUri postsPageUri }
}
```

`ContentNode.readyspaceSeo`, `TermNode.readyspaceSeo` and `readyspaceFrontPageSeo` expose the same `ReadySpaceSeo` object. The root URI should be an exact audited path including its trailing slash, without query strings or fragments. The frontend maps CMS-origin canonical/OG/schema URLs to the production public origin and preserves an editor's intentionally external canonical. JSON-LD is returned as a JSON string, which the frontend must parse and safely encode before placing in a script element; never insert it as raw unescaped HTML.

`ready: false` means metadata is unavailable, the CMS cannot render the native route, the warm limit has been reached, or the source is no longer public. `generatedAt` identifies the captured snapshot. Do not approve a release with missing SEO on required public routes. The frontend may render safe fallback metadata, but fallback is not evidence that Rank Math editorial settings were imported correctly.

The adapter captures published public singular posts/pages/custom types, public category/tag/custom taxonomy archives, public post type archives, author archives with at least one public published password-free post, and the front/posts page. Drafts, private/future/trash/revision posts, password-protected posts, private types/taxonomies, logged-in CMS responses, previews, search, feeds and date archives are not captured. Native numbered archive pages are captured at their complete request URI, so Rank Math calculates the page-specific canonical/robots rather than reusing page one. The frontend must request `readyspaceSeo` with the complete `/page/N/` URI while resolving the archive content independently. Audit single-post `<!--nextpage-->` and custom pagination routes separately. It deliberately does not expose raw postmeta/options or Rank Math management/mutation fields. A cached post/term's current publication status is checked again before returning it, including when the GraphQL caller is authenticated.

Publication/content changes, Rank Math post/term meta changes, taxonomy/author-profile changes, navigation changes, and Rank Math/site/permalink/front-page option changes invalidate the snapshot epoch. Direct database writes or third-party code that bypasses normal WordPress hooks require manual invalidation and cache purging. One-day expiry bounds missed invalidations; it is not an adequate publication safety guarantee by itself. The bridge remembers the 5000 most recently captured URI variants, automatically queues that inventory plus affected paths after edits, and renews snapshots older than 20 hours via an hourly WP-Cron task. Background jobs warm at most four routes per batch, retry unavailable metadata twice, and issue another global frontend revalidation after the queue drains; the initial publication/withdrawal webhook remains immediate. Removed native routes returning 404/410 leave the inventory. Monitor the admin warm-failure notice, and size real cron/PHP worker capacity for the site. Larger inventories can recover metadata through the frontend’s separate GraphQL queries and should use their audited URL warming job. CMS full-page caches must not serve outdated rendered heads when warming.

## Compatibility and licensing

Source inspection on 9 October 2026 verified these upstream contracts:

- WPGraphQL's [schema registration API](https://www.wpgraphql.com/functions/register_graphql_field) supports custom fields/resolvers. Its [repository](https://github.com/wp-graphql/wp-graphql) is GPL-3.0. The [2.23.1 release](https://github.com/wp-graphql/wp-graphql/releases/tag/wp-graphql%2Fv2.23.1) includes a media authorization fix; use maintained patched releases rather than assuming old versions are safe.
- Rank Math's public [plugin header](https://github.com/rankmath/seo-by-rank-math/blob/master/rank-math.php) declares GPL-3.0+ and, at inspection, version 1.0.280. Its [head implementation](https://github.com/rankmath/seo-by-rank-math/blob/master/includes/frontend/class-head.php) renders the `rank_math/head` action; its [JSON-LD implementation](https://github.com/rankmath/seo-by-rank-math/blob/master/includes/modules/schema/class-jsonld.php) renders structured schema on that action. The bridge uses these hooks and core WordPress APIs rather than importing upstream implementation code.

The companion WordPress plugin is explicitly **GPL-3.0-or-later**, with its own `LICENSE.txt`. The frontend's MIT license does not relicense the plugin or upstream dependencies. WPGraphQL and Rank Math are installed separately; no upstream or PRO code is bundled. PRO modules, third-party extensions, custom Rank Math filters, WooCommerce/ACF/page-builder plugins and license entitlements must be verified for each site. Rendered-hook reuse is designed to retain installed module behavior, but full Rank Math PRO/schema/AI-feature parity has not been integration-tested and is not guaranteed. Rank Math editorial scores or structured data alone do not guarantee rankings or AI citation/visibility.

## GraphQL security and previews

Public frontend queries are anonymous and must never use editor/admin credentials. Protect WPGraphQL with HTTPS, request size/query complexity/depth/rate limits at the hosting/WAF layer, disable public IDE access where appropriate, and audit other extensions for private-field leakage. Do not globally block anonymous WPGraphQL if the public frontend needs it. The bridge protects its own SEO fields; it does not redefine the authorization rules of every other installed WPGraphQL extension.

Create a dedicated least-privilege WordPress preview account. Its application password lives only in the frontend server environment and is used only for explicitly authorized preview queries with caching disabled. Grant read/edit access only to previewable content. Never put a password or authorization header in a browser URL or public query. WPGraphQL [preview semantics](https://www.wpgraphql.com/docs/previews) vary by version and field; test drafts, autosaves/revisions and custom fields against the installed version rather than assuming all fields use revision data.

The bridge replaces an editor's Preview link with the configured target's `/api/preview?token=...`. The token is `<base64url(JSON claims)>.<hex HMAC-SHA256>` over the encoded claims, with `{id,path,exp}` and a maximum five-minute lifetime. It is created only for an editor who can `edit_post` and never for password-protected content. Keep it private: it grants temporary preview access to whoever holds it. The frontend must validate signature, expiry, id/path and route, use a secure HTTP-only cookie, mark previews `noindex`/`no-store`, and provide an exit flow. The downloaded WPGraphQL 2.23.1 `src/Router.php` registers `application_password_is_api_request` for GraphQL HTTP requests, consistent with its [authentication guide](https://github.com/wp-graphql/wp-graphql/blob/main/plugins/wp-graphql/docs/authentication-and-authorization.md). cPanel/proxies must preserve `Authorization`, WordPress must detect HTTPS, and security plugins must permit this authentication; verify the actual preview account through a GraphQL `viewer` query before activation. Draft SEO is intentionally not published as a public snapshot; preview metadata should use `noindex` fallback. Preview route access is separate from public content queries.

## Cache invalidation and publication safety

After editorial writes complete, the bridge queues `readyspace_headless_revalidate`. The request body is `{ "paths": ["/changed/", "/old-permalink/", "/"] }`. Headers are `x-readyspace-timestamp` (Unix seconds) and `x-readyspace-signature` (hex HMAC-SHA256 of `timestamp + "." + exactRawBody`). Oversized imports (>100 paths or >8000 serialized bytes) send a bounded root-only notification, which still invalidates the shared WordPress tag. Each configured frontend independently verifies the HMAC/timestamp and invalidates its shared WordPress cache tag plus affected paths/layouts. This handles newly published URLs, changed slugs, archives, menus, metadata and unpublishing. No nonce/session/auth secret is sent to browsers.

Delivery retries up to three times with increasing delay. Failure records an admin notice without recording secrets; delivery is not proof of successful frontend rendering. Real WP-Cron scheduling, frontend reachability, correct signatures, old permalink removal and output refresh must be checked on staging. Secrets/target URLs come from trusted wp-config settings; do not accept remote target URLs from GraphQL arguments.

The bridge **never sends newsletter email** and adds no publishing workflow to UltimateSales.ai. Keep the existing WP-Ultimatesales.ai newsletter plugin disabled until its separate subscriber, opt-in, workflow, publishing-trigger and delivery tests pass. Staging and production share CMS publication events, so a staging test can trigger a real newsletter if that plugin is active. Use a sandbox location/list or a cloned test CMS for end-to-end newsletter testing; do not republish production posts as a test.

## Tests and required site acceptance

Standalone tests (PHP with DOM required):

```sh
find wordpress/readyspace-headless -name '*.php' -exec php -l {} \;
php wordpress/readyspace-headless/tests/run.php
```

These tests cover permalink input validation, publication/password/type/taxonomy guards, current-status checks on cached SEO, rendered meta/robots/canonical/JSON-LD parsing, executable-script exclusion, fixed-origin/no-auth/manual same-origin redirect warming, bounded background scheduling/retry/lock behavior, bulk webhook limits, and the signing contract. The standalone suite uses small WordPress stubs; a separate pinned integration blueprint verifies real plugin/schema/hook behavior. The implementation host has no native PHP executable. All five plugin PHP files passed syntax validation and the standalone harness passed 56 checks using WordPress Playground’s official `@php-wasm/cli` 3.1.51 temporary runtime. Native PHP CI repeats these checks. An isolated WordPress Playground integration test also passed on WordPress 6.8.3 / PHP 8.3 / WPGraphQL 2.23.1 / Rank Math 1.0.280. It verified schema registration, the exact rendered Rank Math fixture title/description, index robots, canonical and valid JSON-LD through real WordPress `wp()`/`wp_head()` hooks, root/nested Post SEO resolvers, the frontend URI query, a registered menu location, all four sitemap connections, authenticated draft `asPreview`, and anonymous draft denial. It does not verify installed-site/theme/PRO parity, CMS-local HTTP loopback workers, HTTP Application Password authentication, or cPanel request/header behavior. The per-site CMS acceptance matrix remains required.

The reproducible isolated integration uses only disposable content/users supplied by WordPress Playground and official dependency downloads; no production CMS, CRM or newsletter endpoint is accessed. Run from the repository root:

```sh
npx @wp-playground/cli@3.1.51 run-blueprint \
  --blueprint=wordpress/readyspace-headless/tests/blueprint.json \
  --wp=6.8.3 --php=8.3 \
  --mount="$PWD/wordpress/readyspace-headless:/wordpress/wp-content/plugins/readyspace-headless"
```

The blueprint throws on query errors, missing native SEO, altered fixture metadata, preview failure or anonymous draft exposure. Its frontend query strings are a checked-in contract fixture; update them deliberately when `src/lib/content.ts` changes. It makes direct in-CMS `graphql()` calls; this does not prove remote HTTP authentication or a hosting reverse proxy works.

Before enabling a real site, record installed WordPress/PHP/WPGraphQL/Rank Math versions and verify:

| Check | Required result |
| --- | --- |
| Anonymous homepage/post/page/term GraphQL SEO | `ready: true`; title, description, canonical, robots, OG and schema match installed Rank Math/native output after public-origin mapping |
| Title/description templates and overrides | Expanded values match editor choices, including escaped/non-ASCII text |
| Noindex/external canonical/social image | Survive GraphQL to server-rendered frontend exactly |
| Draft/private/future/password post | Absent from public frontend queries, SEO snapshots and sitemaps, even if authenticated SEO resolver is probed |
| Unpublish/delete/change slug | Old cache cannot serve the previous public page after signed invalidation; old/new URLs and redirects reviewed |
| Authorized editor preview | Short-lived signature accepted, anonymous/expired/tampered preview denied; custom fields/autosaves verified; response noindex/no-store |
| Rank Math/settings/term/menu edit | Snapshot generatedAt advances and both target environments revalidate |
| Cron/revalidation failure | Retry/notice visible; no production newsletter activated by the bridge |
| Historical URI inventory | All retained URLs resolve; intentional redirects documented; unsupported custom/query routes block release until adapted; numbered archive canonical/robots verified |
| CMS indexing and API controls | Native CMS copies noindex; frontend SEO remains indexable as intended; other schema extensions audited |

Keep this version matrix and URL inventory with the per-site migration evidence. A frontend build against fixtures does not replace this CMS acceptance gate.
