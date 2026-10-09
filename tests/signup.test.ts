import test from "node:test";
import assert from "node:assert/strict";
import { readSignupConfig, type SignupConfig } from "../src/lib/crm-config";
import { submitCrmSignup } from "../src/lib/crm";
import { createSignupHandler, distributedSignupLimit, validateSignup, verifyTurnstile } from "../src/lib/signup";

const config: SignupConfig = { enabled: true, origin: "https://site.example", locationId: "location-test",
  privateToken: "private-test-token", pendingTag: "pending", confirmedTag: "confirmed", unsubscribedTag: "unsubscribed",
  leadTag: "enquiry", suppressionTags: ["bounced"], policyVersion: "2026-10", turnstileSecret: "test-secret",
  trustedIpHeader: "x-real-ip", rateLimitUrl: "https://test.upstash.io", rateLimitToken: "redis-private",
  rateLimitSalt: "a".repeat(32) };
const input = { kind: "newsletter" as const, email: "reader@example.com", name: "Reader", message: "" };
function request(changes: Record<string, unknown> = {}, headerChanges: Record<string, string> = {}) {
  return new Request("https://site.example/api/signup", { method: "POST", headers: { origin: config.origin,
    "x-readyspace-signup": "1", "content-type": "application/json", "x-real-ip": "192.0.2.1", ...headerChanges },
    body: JSON.stringify({ ...input, consent: true, website: "", turnstileToken: "token", ...changes }) });
}
function mockCrm(responses: unknown[]) {
  const calls: { url: string; options: RequestInit }[] = [];
  const fetcher = (async (url, options) => {
    calls.push({ url: String(url), options: options || {} });
    assert.ok(responses.length, "Unexpected provider call");
    return Response.json(responses.shift());
  }) as typeof fetch;
  return { calls, fetcher };
}
test("signup is off by default and staging never falls back to production credentials", () => {
  assert.equal(readSignupConfig({}).enabled, false);
  assert.throws(() => readSignupConfig({ CRM_SIGNUP_ENABLED: "true", CRM_WORKFLOWS_VERIFIED: "true",
    SITE_ENV: "staging", CRM_LOCATION_ID: "production-id", CRM_PRIVATE_TOKEN: "production-token" }), /separate test/);
});
test("staging requires separate enabled test credentials and uses its deployment origin", () => {
  const env = { CRM_SIGNUP_ENABLED: "true", CRM_WORKFLOWS_VERIFIED: "true", CRM_SIGNUP_STAGING_ALLOWED: "true",
    SITE_ENV: "staging", SITE_URL: "https://site.example", DEPLOYMENT_URL: "https://staging.site.example",
    CRM_LOCATION_ID: "production-id", CRM_PRIVATE_TOKEN: "production-token", CRM_TEST_LOCATION_ID: config.locationId,
    CRM_TEST_PRIVATE_TOKEN: config.privateToken, CRM_CONSENT_POLICY_VERSION: config.policyVersion,
    TURNSTILE_SECRET_KEY: config.turnstileSecret, SIGNUP_TRUSTED_IP_HEADER: config.trustedIpHeader,
    SIGNUP_REDIS_REST_URL: config.rateLimitUrl, SIGNUP_REDIS_REST_TOKEN: config.rateLimitToken,
    SIGNUP_RATE_LIMIT_SALT: config.rateLimitSalt };
  assert.equal(readSignupConfig(env).origin, "https://staging.site.example");
  assert.throws(() => readSignupConfig({ ...env, CRM_TEST_LOCATION_ID: env.CRM_LOCATION_ID }), /separate test/);
  assert.throws(() => readSignupConfig({ ...env, SIGNUP_REDIS_REST_URL: "http://localhost:6379" }), /HTTPS Upstash/);
});
test("affirmative consent, bounds and enquiry content are enforced on the server", () => {
  assert.throws(() => validateSignup({ ...input, consent: "true" }));
  assert.throws(() => validateSignup({ ...input, consent: true, email: "a\nb@example.com" }));
  assert.throws(() => validateSignup({ ...input, consent: true, name: "x".repeat(101) }));
  assert.throws(() => validateSignup({ ...input, kind: "lead", consent: true, message: "" }));
});
test("cross-origin and oversized requests never reach the CRM", async () => {
  let called = false;
  const handler = createSignupHandler(config, { submit: async () => { called = true; } });
  assert.equal((await handler(request({}, { origin: "https://attacker.example" }))).status, 403);
  assert.equal((await handler(request({ extra: "x".repeat(10_000) }))).status, 400);
  assert.equal(called, false);
});
test("honeypot does not disclose itself or call external providers", async () => {
  const handler = createSignupHandler(config, { rateLimit: async () => { throw new Error("must not run"); } });
  assert.equal((await handler(request({ website: "spam" }))).status, 202);
});
test("rate limiting and Turnstile failures prevent CRM writes; successful requests have generic responses", async () => {
  let submitted = 0;
  const dependencies = { rateLimit: async () => true, verify: async () => true, submit: async () => { submitted++; } };
  assert.equal((await createSignupHandler(config, { ...dependencies, rateLimit: async () => false })(request())).status, 429);
  assert.equal((await createSignupHandler(config, { ...dependencies, verify: async () => false })(request())).status, 400);
  assert.equal((await createSignupHandler(config, { ...dependencies, rateLimit: async () => { throw new Error("offline"); } })(request())).status, 503);
  const result = await createSignupHandler(config, dependencies)(request());
  assert.equal(result.status, 202);
  assert.equal(submitted, 1);
  assert.ok(!(await result.text()).includes(input.email));
});
test("trusted proxy IP is mandatory and Turnstile binds both hostname and action", async () => {
  const handler = createSignupHandler(config);
  assert.equal((await handler(request({}, { "x-real-ip": "unknown" }))).status, 503);
  for (const body of [{ success: true, hostname: "attacker.example", action: "signup" },
    { success: true, hostname: "site.example", action: "other" }]) {
    assert.equal(await verifyTurnstile("token", "192.0.2.1", config, (async () => Response.json(body)) as typeof fetch), false);
  }
});
test("distributed rate limits use atomic expiry and hashed personal data, and fail closed on unexpected responses", async () => {
  let body = "";
  const fetcher = (async (_url, options) => { body = String(options?.body); return Response.json({ result: 1 }); }) as typeof fetch;
  assert.equal(await distributedSignupLimit(input.email, "192.0.2.1", config, fetcher), true);
  assert.ok(body.includes("EVAL"));
  assert.ok(body.includes("EXPIRE"));
  assert.ok(!body.includes(input.email) && !body.includes("192.0.2.1"));
  await assert.rejects(distributedSignupLimit(input.email, "192.0.2.1", config,
    (async () => Response.json({ error: "offline" })) as typeof fetch));
});
test("suppressed, confirmed, pending and unknown-DND contacts are never reactivated", async () => {
  for (const changes of [{ tags: ["unsubscribed"] }, { tags: ["bounced"] }, { dnd: true },
    { tags: ["confirmed"] }, { tags: ["pending"] }, { dnd: undefined }, { dndSettings: undefined }]) {
    const mock = mockCrm([{ contact: { id: "contact-test", locationId: config.locationId, email: input.email,
      tags: [], dnd: false, dndSettings: { Email: { status: "inactive" } }, ...changes } }]);
    await submitCrmSignup(input, config, mock.fetcher);
    assert.equal(mock.calls.length, 1);
  }
});
test("new signup records pending request before additive tag; never grants consent or clears DND", async () => {
  const mock = mockCrm([{ contact: null }, { new: true, contact: { id: "contact-test", locationId: config.locationId, email: input.email } }, {}, {}]);
  await submitCrmSignup(input, config, mock.fetcher, new Date("2026-10-09T00:00:00Z"));
  assert.equal(mock.calls.length, 4);
  assert.ok(mock.calls[2].url.endsWith("/notes"));
  assert.ok(String(mock.calls[2].options.body).includes("pending confirmation"));
  assert.ok(mock.calls[3].url.endsWith("/tags"));
  assert.deepEqual(JSON.parse(String(mock.calls[3].options.body)), { tags: ["pending"] });
  const upsert = JSON.parse(String(mock.calls[1].options.body));
  assert.equal(upsert.createNewIfDuplicateAllowed, false);
  assert.ok(!Object.hasOwn(upsert, "dnd") && !Object.hasOwn(upsert, "dndSettings") && !Object.hasOwn(upsert, "tags"));
  assert.ok(mock.calls.every((call) => call.url.startsWith("https://services.leadconnectorhq.com/")));
});
test("concurrent existing-contact upsert is reconciled before workflow activation", async () => {
  const existing = { id: "contact-test", locationId: config.locationId, email: input.email, tags: ["unsubscribed"], dnd: true };
  const mock = mockCrm([{ contact: null }, { new: false, contact: existing }, { contact: existing }]);
  await submitCrmSignup(input, config, mock.fetcher);
  assert.equal(mock.calls.length, 3);
});
test("provider contract uncertainty and wrong locations fail closed", async () => {
  await assert.rejects(submitCrmSignup(input, config, mockCrm([{}]).fetcher));
  await assert.rejects(submitCrmSignup(input, config, mockCrm([{ contact: {
    id: "contact-test", email: input.email, locationId: "wrong-location" } }]).fetcher));
});
test("lead request on a suppressed contact records only an enquiry note and preserves suppression", async () => {
  const mock = mockCrm([{ contact: { id: "contact-test", locationId: config.locationId, email: input.email, dnd: true, tags: ["unsubscribed"] } }, {}]);
  await submitCrmSignup({ ...input, kind: "lead", message: "Please explain your service." }, config, mock.fetcher);
  assert.equal(mock.calls.length, 2);
  assert.ok(mock.calls[1].url.endsWith("/notes"));
  assert.ok(String(mock.calls[1].options.body).includes("no marketing consent granted"));
});
