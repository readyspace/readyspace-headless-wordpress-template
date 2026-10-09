# Validation record

Template work on 9 October 2026, Singapore time. No production deployment, DNS cutover, real CRM signup or newsletter send was performed.

## Frontend and deployment checks

- Node 22.23.1; locked Next.js 16.4.0 / React 19.3.0 / TypeScript 5.9.3.
- `npm run typecheck`: passed.
- `npm test`: 34 passing tests covering public/preview GraphQL auth/cache separation, permalink/metadata/privacy, signatures/expiry/body limits, HTML/schema security, CRM opt-in/DND/suppression/abuse controls Passenger release configuration and rollback interruption/recovery simulations.
- `npm run build`: passed in default staging and `SITE_ENV=production` configurations.
- `npm run smoke`: local mock CMS HTTP checks passed in staging; `SMOKE_ENV=production npm run smoke` passed after the production build, including actual server-rendered title/canonical/schema/media, sanitized content, legacy URI, 404, robots/sitemap, readiness, invalid preview/webhook and disabled signup responses.
- Deployment/rollback Bash syntax and `app.js` syntax passed. No real cPanel deployment/restart/rollback was executed.
- Dependency installation reported zero known audit vulnerabilities at inspection. This is a point-in-time registry report.

The HTTP fixture runs only local servers and never reaches WordPress/HighLevel accounts. CI repeats TypeScript/tests/build/smoke for staging and production and runs native PHP syntax/harness plus isolated WordPress integration blueprint checks. See [WordPress validation](wordpress.md) for the companion bridge's PHP and isolated CMS evidence.

## Remaining per-site acceptance

Hosted schema/theme/Rank Math PRO/custom-field compatibility; exact permalink and canonical/slash/encoded path inventory; private/password/withdrawal and editor preview/autosave semantics; publication cron plus both signed frontend targets; all intended legacy/custom/media/feed/language/sitemap routes; real CRM provider/workflow/consent/suppression acceptance in a test location; newsletter licensing and controlled test delivery; trusted proxy/rate limiter configuration; actual NodeSelector/Passenger restart and rollback behavior.

A tested generic starter does not establish these facts for any instantiated site. Keep the PR draft until the relevant CMS integration review is complete; site cutover needs its own acceptance evidence.
