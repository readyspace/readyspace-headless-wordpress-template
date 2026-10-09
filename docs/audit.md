# Repository and Academy reference audit

Read-only inspection on 9 October 2026, Singapore time. No Academy deployment, CMS change, CRM submission, newsletter send or DNS change was performed for this template task.

## Evidence sources and actual state

The existing template at `444e42f5077ba1505c84f6845c2710a7e2b3e5b4` used Next.js Pages Router, JavaScript and Faust. Its Rank Math adapter used the headless REST endpoint. This upgrade replaces that data adapter and Pages Router rather than carrying them into the new starter. WordPress content, SEO, taxonomy, navigation and media metadata in the starter use WPGraphQL exclusively. Rank Math is an editorial SEO plugin; it does **not** natively provide all those SEO fields through WPGraphQL. The supplied schema extension is a separate integration that must pass the compatibility tests described in its WordPress documentation.

The project-folder Academy checkout was clean on `staging` at `b1be5aca8700dab6ad4fe696a0330912e6d11616`. Its 6 October README described an undeployed local MVP. That checkout is stale: it cannot establish the current hosting result.

A separate temporary audit checkout of the current Academy remote `staging` branch was inspected at `250c6393f2f81fcf3fbe7bf72f97fdc635808761`. Remote `main` was also fetched and inspected separately at `570d005b095076cecb97a7e907d782a710b65134`. Both branches contain the REST content/SEO adapters; the newer staging commit also changes CMS administrative outbound access. The newer instructions identify a separate GitHub Desktop checkout as canonical and record the shared CMS decision, completed production releases and later fixes. No fetch, edit or deployment was made in the old Academy checkout.

Public HTTPS responses independently confirm the frontend is now deployed:

| Observation | Result |
| --- | --- |
| Production homepage | HTTP 200, Next.js assets/RSC headers, public canonical, `index, follow` metadata |
| Staging homepage | HTTP 200, Next.js/RSC response, `X-Robots-Tag: noindex, nofollow` |
| CMS homepage | HTTP 302 to the public site, WordPress redirect header, `noindex, nofollow` header |

These observations do not identify the exact serving production commit, verify CMS authentication or prove every conversion journey. An unauthenticated CMS GraphQL read did not produce a usable schema response. The current Academy source explicitly retires its unused WPGraphQL interface and continues using WordPress REST and Rank Math `getHead`. Consequently Academy is evidence for preservation and operational practices, **not a WPGraphQL data-layer reference**.

Reference repository: [ReadySpace Academy headless WordPress](https://github.com/readyspace/readyspace-academy-headless-wp). It is private; repository links require permission. Public frontend: [ReadySpace Academy](https://readyspace.academy/).

## Reusable practices

- Build and test an isolated release from an exact reviewed Git commit before selecting it. Keep source checkouts, runtime releases, private settings and public document roots separate.
- Preserve the existing permalink inventory, encoded path spelling, query parameters, authoritative redirects, media addresses and feed/sitemap addresses. Discover collisions before choosing a route winner. Academy's unusual encoded slug and duplicate lost-password identities demonstrate why a generic migration cannot presume every slug maps one-to-one.
- Fail closed for draft/private/password-protected content and publication withdrawal. An old snapshot must not resurrect withdrawn content after an access-denied or not-found response.
- Keep staging noindex, gate sending integrations, and distinguish a click or HTTP 200 from a confirmed booking, subscription or purchase.
- Use exact canonical/content identity checks before accepting SEO output. Academy found Rank Math can report a successful head response for a WordPress 404, so a frontend page must not blindly accept unrelated metadata.
- Validate the actual serving release after restart. Academy's LiteSpeed worker once continued serving an older release after `tmp/restart.txt` was touched. This starter verifies the commit through the public readiness endpoint and restores the previous pointer on mismatch; account-specific process signalling is not copied.
- Preserve recovery state. Academy found generated routing permissions of 0600 caused public failures under a private deployment umask; public routing must be readable while secrets stay private.

## Approaches deliberately replaced or kept site-specific

The Academy adapter fetches `/wp-json/wp/v2/...`, Rank Math REST and a custom review projection; its archive/sitemap inventory uses refreshed public snapshots. Those adapters are not copied into this starter. The starter queries its documented GraphQL schema and has no WordPress REST fallback.

Academy courses, training hosts, specific Google provider/location IDs, branding, review fixtures, private preview spool paths, selected-recipient tests, credentials and deployment account paths are site-specific. None are template defaults. Academy's editorial preview candidate remains disabled pending hosted editor acceptance; it is not evidence for working GraphQL previews.

The latest Academy newsletter records report an approved LIVE shared-CMS integration and historical exclusion ledger. This audit did not independently inspect private delivery records or send mail. Its booking/payment completion and authoritative GA4 conversion acceptance remain incomplete in the source record. The starter enables neither newsletters nor CRM sending by default and requires independent per-site tests.

## Verification limits and per-site gates

The stale checkout contains a dated local crawl artifact for 444 routes and 382 articles with no recorded route/article/redirect failures. The current repository records a later hosted census of 451 frontend routes, 382 articles and 345 historical responses, plus separate failure and recovery evidence. Those are Academy's recorded results, not tests newly run against every Academy route by this task.

Each instantiated site still needs a full URL/content/redirect/SEO inventory, real WPGraphQL/Rank Math integration checks, editor preview tests, withdrawal/revalidation tests, controlled CRM opt-in and suppression tests, existing media/plugin/license checks, hosted cPanel staging acceptance and frontend rollback rehearsal. A passing starter build cannot close these site-specific gates or guarantee search/AI ranking.
