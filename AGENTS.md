# Template implementation conventions

Use App Router/TypeScript. WordPress content and SEO access MUST use WPGraphQL, never WordPress REST or Rank Math's REST endpoint. Any exception for plugin administrative access requires the human's explicit approval. Do not automatically deploy, merge main, migrate Academy, change DNS or enable newsletter LIVE.

Keep canonical production and deployment origins distinct, no business/CRM credentials in source. Public GraphQL queries are anonymous; WordPress application-password authentication is restricted to signed editor previews. All integrations start disabled. Staging uses only explicitly configured separate test CRM credentials and noindex/access restrictions.

Preserve legacy paths using per-site audit evidence. Document unsupported adapters. Validate typecheck, tests, build and PHP harness; test publication/status/privacy transitions in a disposable CMS before accepting a site. Use feature PR into staging, acceptance then reviewed main. Deployment scripts build a candidate, verify commit/readiness and restore previous release on failure.
