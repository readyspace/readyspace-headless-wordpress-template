# Optional integrations and subscriber safety

All integrations are disabled until configured. WordPress content and SEO use WPGraphQL exclusively. The server-side HTTP APIs in this document belong to the CRM, Cloudflare and Redis; they are not WordPress REST APIs. This starter does not make WordPress administrative HTTP calls.

## Lead and newsletter signup

`SignupForm` posts to the local `/api/signup` handler. The handler checks an exact deployment origin, a custom same-origin header, JSON content type, bounded input/body size, affirmative permission, a honeypot, a trusted proxy IP, an atomic shared rate limit and server-verified Turnstile. Responses never reveal whether an email is subscribed, suppressed or already present. Credentials remain in server route modules and private environment settings.

Enable only after verifying your account and workflow configuration:

| Variable | Meaning |
| --- | --- |
| `CRM_SIGNUP_ENABLED` | `true` enables the local handler; default `false` |
| `CRM_WORKFLOWS_VERIFIED` | Operator acknowledgement of the acceptance checks below |
| `CRM_LOCATION_ID`, `CRM_PRIVATE_TOKEN` | Production location/private integration; server only |
| `CRM_SIGNUP_STAGING_ALLOWED` | Explicit permission to exercise an isolated test account |
| `CRM_TEST_LOCATION_ID`, `CRM_TEST_PRIVATE_TOKEN` | The only credentials used when `SITE_ENV` is not production |
| `CRM_NEWSLETTER_PENDING_TAG` | Pending request tag; default `newsletter-pending` |
| `CRM_NEWSLETTER_CONFIRMED_TAG` | Confirmed subscriber tag; default `newsletter-confirmed` |
| `CRM_NEWSLETTER_UNSUBSCRIBED_TAG` | Unsubscribed tag; default `newsletter-unsubscribed` |
| `CRM_SUPPRESSION_TAGS` | Comma-separated additional bounce/complaint/suppression tags |
| `CRM_LEAD_TAG` | Enquiry workflow tag; default `website-enquiry` |
| `CRM_CONSENT_POLICY_VERSION` | Version of the actual signup notice/privacy policy |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` | Public widget key and private verification key |
| `SIGNUP_TRUSTED_IP_HEADER` | `x-real-ip` or `cf-connecting-ip`, overwritten by your trusted proxy |
| `SIGNUP_REDIS_REST_URL`, `SIGNUP_REDIS_REST_TOKEN` | Dedicated Upstash Redis HTTPS origin and private write token |
| `SIGNUP_RATE_LIMIT_SALT` | Private random value of at least 32 characters |

Use a location-level integration with `contacts.readonly` and `contacts.write`. The adapter pins HighLevel's documented `2021-07-28` contacts contract and a fixed `services.leadconnectorhq.com` host. Verify that UltimateSales.ai provides these endpoints for your account. It reads duplicate contacts, upserts an email without replacing tags or DND, stores a request note, then uses the additive tags API. API acceptance does not prove workflow delivery. References: [duplicate lookup](https://marketplace.gohighlevel.com/docs/2021-07-28/ghl/contacts/get-duplicate-contact/), [upsert](https://marketplace.gohighlevel.com/docs/2021-07-28/ghl/contacts/upsert-contact/), [notes](https://marketplace.gohighlevel.com/docs/2021-07-28/ghl/contacts/create-note/), [add tags](https://marketplace.gohighlevel.com/docs/2021-07-28/ghl/contacts/add-tags/).

The adapter fails closed if duplicate lookup does not return `{ contact: null }` or a contact with the exact email/location, or if upsert omits its boolean `new` result. Check the actual tenant response before activation; adapt and test the response parser if your supported contract differs. No blind retries occur after an uncertain provider write. Inspect provider records privately before retrying. The test suite uses mocked provider responses and has not verified a real account.

The newsletter form records a **pending request**, never a confirmed subscription. Existing confirmed/pending contacts are left alone; existing contacts with missing DND evidence, active DND, unsubscribe or configured suppression tags are not reactivated. New contacts retain the provider's defaults. The enquiry form records permission to respond to that enquiry, separately from marketing. It preserves suppression and does not grant newsletter consent. Do not attach unsolicited campaigns to generic contact-created, note-created or enquiry-tag events.

In the isolated test location, configure and test a double opt-in workflow for the pending tag. A fresh DND/suppression check must precede even a confirmation message. Confirmation must validate an expiring token proving control of the address, retain evidence of the notice/version and timestamp, and only then move pending to confirmed. Unsubscribe/bounce/complaint events must remove confirmation and maintain suppression. The starter neither implements that provider workflow nor clears DND automatically. Match all three consent tags to the publishing plugin's configuration. Confirm mailbox delivery, expired/reused token handling, existing-contact behavior and unsubscribe suppression before setting `CRM_WORKFLOWS_VERIFIED=true`.

For a site-specific page, render `<SignupForm kind="lead" privacyUrl="/privacy/" turnstileSiteKey={publicKey} />`; newsletter is the default kind. Use the site's existing privacy URL. Render forms only when enabled and the public key is present. Validate the visible text against your actual practices before launch.

### Abuse protection and staging

The Redis limiter uses an atomic Lua command with expiration: 10 attempts per IP and 3 per normalized email in 15 minutes. Redis contains salted HMAC keys rather than raw email/IP; entries expire after 15 minutes. A Redis failure prevents CRM writes. Use a dedicated database/account with scoped access where supported. [Upstash REST command transport](https://upstash.com/docs/redis/features/restapi) is a provider integration separate from WordPress.

Your reverse proxy must strip visitors' values and overwrite the chosen IP header. Restrict direct origin access so visitors cannot bypass that proxy. Do not trust `x-forwarded-for` supplied by a client. On cPanel, have the host confirm the Apache/Passenger or proxy header behavior; leave signup disabled until it is established. Add host/edge limits for request volume and a strict HTTP body/read timeout as well. Multiple workers share Redis limits; an in-memory counter is deliberately not used.

Turnstile verification checks success, the exact deployment hostname and action `signup`. Configure separate test keys/allowed staging hosts and account for its browser script in your Content Security Policy. [Cloudflare requires server verification](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/).

Staging uses `DEPLOYMENT_URL` for origin checks and never falls back to production CRM credentials. Even with `CRM_SIGNUP_STAGING_ALLOWED=true`, separate test location/token values are required and must differ from available production values. An operator must independently verify that the supplied test location is actually isolated; code cannot determine that from an arbitrary identifier. Keep production CRM secrets out of staging entirely. Shared WordPress does not mean shared test audiences or permission to send mail.

## WordPress publication newsletter plugin

Audited upstream source: [WP-Ultimatesales.ai-Newsletter-Plugin](https://github.com/readyspace/WP-Ultimatesales.ai-Newsletter-Plugin), commit `6c61cb991ee46b8c9d0c9698de83c368bfbbcd85`, on 2026-10-09. Its current version is `0.3.0-alpha.2`, a developer preview requiring maintainer acceptance. Its README states licensing is pending, with no additional reuse/redistribution grant. The starter links to it and does not bundle its source. Resolve the licence with its maintainer before redistributing it or treating it as a production dependency.

The plugin runs inside WordPress on first publication, delays five minutes, and emails a 10–150-word explicit Excerpt. It excludes the existing archive on activation and does not resend edits/republishes. It checks the public article's status, canonical, single H1 and indexing state before a campaign. Signup and confirmation workflows must already exist. It reads confirmed eligible contacts and rejects pending/unsubscribed/DND contacts. These behaviors are supported by the inspected PHP implementation, not assumptions about the repository name.

Follow upstream [installation](https://github.com/readyspace/WP-Ultimatesales.ai-Newsletter-Plugin/blob/6c61cb991ee46b8c9d0c9698de83c368bfbbcd85/docs/INSTALLATION.md) and [operations](https://github.com/readyspace/WP-Ultimatesales.ai-Newsletter-Plugin/blob/6c61cb991ee46b8c9d0c9698de83c368bfbbcd85/docs/OPERATIONS.md). It requires single-site WordPress, PHP 8.1+ (OpenSSL, DOM, JSON, libxml), database advisory locks, HTTPS administration and a reliable scoped cron runner. Its private integration needs `contacts.readonly`, `users.readonly`, `emails/campaigns.readonly` and `emails/campaigns.write`, distinct from the frontend signup token.

Put its `RS_NEWSLETTER_CONFIG` in private `wp-config.php`: location; the three distinct consent tags; CMS/public HTTPS origins; brand; sender/reply addresses; timezone; legal name/postal address; same-public-origin privacy URL; and preview text. Enter the token using its native WordPress administrator screen, which encrypts it. Preserve the legacy `cleverspeed-newsletter` folder/options/ledger. The upstream native admin + scoped WP-CLI verification and cron instructions require no WordPress REST calls.

Keep delivery Off until isolated provider/draft/subscriber/unsubscribe acceptance is recorded; then test Draft-only before a controlled, explicitly approved Live test. Configuration changes invalidate verification. Preserve the duplicate-send ledger and reconcile uncertain outcomes rather than deleting history. The source's prior pilot WordPress version is not certification across supported versions.

**Shared CMS safety:** installing/enabling this plugin acts on the CMS publication stream, independent of the frontend branch. A staging Next.js build must never change its mode, verified flag, credential, recipient tags or cron. The public origin in the CMS plugin must be the intended production frontend. A shared live CMS is unsuitable for newsletter acceptance tests: use an isolated CMS and test location. This template work does not install or enable the plugin, send a campaign, or publish a test article on the live CMS.

## Analytics, verification, maps and reviews

`OptionalIntegrations` accepts public `ga4Id`, `gtmId`, `mapsEmbedUrl` and `googleReviewUrl` props. Use GA4 **or** GTM; the component loads neither if both are present. No analytics request is made until the visitor chooses "Allow analytics for this visit". Advertising consent remains denied; configure GTM consent requirements on every tag and do not add ad tags to the analytics-only choice. Withdrawal reloads the page without reloading analytics. This basic visit-level choice is not a complete consent management platform: use your site-specific CMP where persistent consent, preferences, audit records or regional rules are required.

Google Maps loads only after a separate visitor action; allow only a `https://www.google.com/maps/embed...` URL. Removing it stops that embed but cannot erase Google's existing third-party storage. Google reviews use a configured external link, not scraped ratings or invented review schema. If you later use the Places API, add a server-only API credential, verify attribution/caching terms and test the actual business profile first.

Search Console and Bing verification are server-rendered meta values from public configuration. Verify ownership manually with those providers. No indexing-submission API, Maps billing account or automatic review retrieval is activated by this starter.
