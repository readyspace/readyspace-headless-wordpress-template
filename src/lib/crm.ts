import type { SignupConfig } from "./crm-config";

export type SignupInput = {
  kind: "newsletter" | "lead";
  email: string;
  name: string;
  message: string;
};
type Contact = { id: string; locationId: string; email: string; tags?: string[]; dnd?: boolean;
  dndSettings?: { Email?: { status?: string } } };

/** CRM HTTP calls are server-to-provider calls, never WordPress data access. */
export async function submitCrmSignup(
  input: SignupInput, config: SignupConfig, fetcher: typeof fetch = fetch, now = new Date(),
): Promise<void> {
  async function request(path: string, method: "GET" | "POST", body?: unknown): Promise<Record<string, unknown>> {
    const response = await fetcher(`https://services.leadconnectorhq.com${path}`, {
      method, redirect: "error", cache: "no-store", signal: AbortSignal.timeout(10_000),
      headers: { Authorization: `Bearer ${config.privateToken}`, Version: "2021-07-28",
        "Content-Type": "application/json", Accept: "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    if (!response.ok) throw new Error("CRM request failed; inspect private provider telemetry before retrying.");
    const data: unknown = await response.json();
    if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("Unexpected CRM response.");
    return data as Record<string, unknown>;
  }
  function parseContact(value: unknown): Contact {
    if (!value || typeof value !== "object") throw new Error("Unexpected CRM contact.");
    const contact = value as Contact;
    if (!/^[A-Za-z0-9_-]{5,100}$/.test(contact.id) || contact.locationId !== config.locationId ||
        typeof contact.email !== "string" || contact.email.toLowerCase() !== input.email ||
        (contact.tags !== undefined && (!Array.isArray(contact.tags) || contact.tags.some((tag) => typeof tag !== "string")))) {
      throw new Error("CRM returned an unexpected contact or location.");
    }
    return contact;
  }
  async function lookup(): Promise<Contact | null> {
    const query = new URLSearchParams({ locationId: config.locationId, email: input.email });
    const data = await request(`/contacts/search/duplicate?${query}`, "GET");
    // An unknown response is never treated as permission to create another contact.
    if (!Object.hasOwn(data, "contact")) throw new Error("Verify the provider duplicate-contact response contract.");
    return data.contact === null ? null : parseContact(data.contact);
  }
  let contact = await lookup();
  let created = false;
  if (!contact) {
    // Never replace tags, write DND=false, or grant consent during contact creation/upsert.
    const result = await request("/contacts/upsert", "POST", {
      locationId: config.locationId, email: input.email, createNewIfDuplicateAllowed: false,
    });
    if (typeof result.new !== "boolean") throw new Error("Unexpected CRM upsert outcome; reconcile before retrying.");
    created = result.new;
    contact = parseContact(result.contact);
    // A concurrent submission may have found an existing suppressed contact. Re-read it.
    if (!created) contact = await lookup();
    if (!contact) throw new Error("CRM contact reconciliation required.");
  }
  const tags = contact.tags || [];
  const suppressed = tags.some((tag) => [config.unsubscribedTag, ...config.suppressionTags].includes(tag)) ||
    contact.dnd === true || ["active", "enabled"].includes(contact.dndSettings?.Email?.status || "");
  if (input.kind === "newsletter") {
    // No reactivation of suppressed, confirmed or already pending contacts. Unknown DND fails closed.
    if (suppressed || tags.includes(config.confirmedTag) || tags.includes(config.pendingTag) ||
        (!created && (contact.dnd !== false ||
          !["inactive", "disabled"].includes(contact.dndSettings?.Email?.status || "")))) return;
  }
  const note = [
    input.kind === "newsletter" ? "Newsletter request: pending confirmation; no marketing consent granted." :
      "Website enquiry: permission to respond to this enquiry only; no marketing consent granted.",
    `Affirmative request received: ${now.toISOString()}`,
    `Source: ${config.origin}; consent notice version: ${config.policyVersion}`,
    ...(input.name ? [`Submitted name: ${input.name}`] : []),
    ...(input.message ? [`Enquiry: ${input.message}`] : []),
  ].join("\n");
  // Record the request before a tag can trigger a verified provider-side workflow.
  await request(`/contacts/${encodeURIComponent(contact.id)}/notes`, "POST", { body: note });
  if (suppressed) return;
  await request(`/contacts/${encodeURIComponent(contact.id)}/tags`, "POST", {
    tags: [input.kind === "newsletter" ? config.pendingTag : config.leadTag],
  });
}
