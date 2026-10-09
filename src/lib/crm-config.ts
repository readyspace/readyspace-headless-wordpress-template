/** Server configuration. Only route handlers may import this module. */
export type SignupConfig = {
  enabled: boolean;
  origin: string;
  locationId: string;
  privateToken: string;
  pendingTag: string;
  confirmedTag: string;
  unsubscribedTag: string;
  leadTag: string;
  suppressionTags: string[];
  policyVersion: string;
  turnstileSecret: string;
  trustedIpHeader: string;
  rateLimitUrl: string;
  rateLimitToken: string;
  rateLimitSalt: string;
};

export function readSignupConfig(env: Record<string, string | undefined> = process.env): SignupConfig {
  const enabled = env.CRM_SIGNUP_ENABLED === "true";
  const production = env.SITE_ENV === "production";
  const locationId = (production ? env.CRM_LOCATION_ID : env.CRM_TEST_LOCATION_ID) || "";
  const privateToken = (production ? env.CRM_PRIVATE_TOKEN : env.CRM_TEST_PRIVATE_TOKEN) || "";
  const site = new URL(env.DEPLOYMENT_URL || env.SITE_URL || "https://example.com");
  const origin = site.origin;
  const config: SignupConfig = {
    enabled, origin, locationId, privateToken,
    pendingTag: env.CRM_NEWSLETTER_PENDING_TAG || "newsletter-pending",
    confirmedTag: env.CRM_NEWSLETTER_CONFIRMED_TAG || "newsletter-confirmed",
    unsubscribedTag: env.CRM_NEWSLETTER_UNSUBSCRIBED_TAG || "newsletter-unsubscribed",
    leadTag: env.CRM_LEAD_TAG || "website-enquiry",
    suppressionTags: (env.CRM_SUPPRESSION_TAGS || "").split(",").map((tag) => tag.trim()).filter(Boolean),
    policyVersion: env.CRM_CONSENT_POLICY_VERSION || "",
    turnstileSecret: env.TURNSTILE_SECRET_KEY || "",
    trustedIpHeader: env.SIGNUP_TRUSTED_IP_HEADER || "",
    rateLimitUrl: env.SIGNUP_REDIS_REST_URL || "",
    rateLimitToken: env.SIGNUP_REDIS_REST_TOKEN || "",
    rateLimitSalt: env.SIGNUP_RATE_LIMIT_SALT || "",
  };
  if (!enabled) return config;
  if (env.CRM_WORKFLOWS_VERIFIED !== "true") throw new Error("CRM workflows must be verified before signup is enabled.");
  if (!production && (env.CRM_SIGNUP_STAGING_ALLOWED !== "true" ||
      (env.CRM_LOCATION_ID && locationId === env.CRM_LOCATION_ID) ||
      (env.CRM_PRIVATE_TOKEN && privateToken === env.CRM_PRIVATE_TOKEN))) {
    throw new Error("Nonproduction signup requires explicitly enabled, separate test credentials.");
  }
  if (site.protocol !== "https:" || site.username || site.password || site.pathname !== "/" || site.search || site.hash ||
      !/^[A-Za-z0-9_-]{5,100}$/.test(locationId) ||
      !privateToken || !config.turnstileSecret || !config.policyVersion ||
      !config.rateLimitToken || config.rateLimitSalt.length < 32 ||
      !["x-real-ip", "cf-connecting-ip"].includes(config.trustedIpHeader)) {
    throw new Error("Complete the secure signup configuration before enabling it.");
  }
  const rateUrl = new URL(config.rateLimitUrl);
  if (rateUrl.protocol !== "https:" || !rateUrl.hostname.endsWith(".upstash.io") ||
      rateUrl.username || rateUrl.password || rateUrl.port || rateUrl.search || rateUrl.hash ||
      !["", "/"].includes(rateUrl.pathname)) {
    throw new Error("Signup rate limits require a clean HTTPS Upstash Redis origin.");
  }
  const tags = [config.pendingTag, config.confirmedTag, config.unsubscribedTag, config.leadTag];
  if (new Set(tags).size !== tags.length || tags.some((tag) => !tag || tag.length > 100 || /[<>\x00-\x1f]/.test(tag))) {
    throw new Error("Signup tags must be distinct, bounded plain text values.");
  }
  if (config.suppressionTags.some((tag) => [config.pendingTag, config.confirmedTag, config.leadTag].includes(tag))) {
    throw new Error("Suppression tags cannot overlap workflow trigger tags.");
  }
  return config;
}
