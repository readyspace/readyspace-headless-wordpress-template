import { createHmac } from "node:crypto";
import { isIP } from "node:net";
import type { SignupConfig } from "./crm-config";
import { submitCrmSignup, type SignupInput } from "./crm";

const ACCEPTED = "If your request is eligible, it will be processed. Newsletter requests require email confirmation.";
const MAX_BYTES = 8_192;
type Dependencies = { fetcher?: typeof fetch;
  verify?: (token: string, ip: string) => Promise<boolean>;
  rateLimit?: (email: string, ip: string) => Promise<boolean>;
  submit?: (input: SignupInput) => Promise<void> };

function response(status: number, message: string): Response {
  return Response.json({ message }, { status, headers: { "Cache-Control": "no-store" } });
}
function text(value: unknown, max: number): string {
  if (value === undefined) return "";
  if (typeof value !== "string" || value.length > max || /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f<>]/.test(value)) {
    throw new Error("Invalid input.");
  }
  return value.trim();
}
export function validateSignup(value: unknown): SignupInput & { website: string; token: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid input.");
  const body = value as Record<string, unknown>;
  if (body.consent !== true || !["newsletter", "lead"].includes(String(body.kind))) throw new Error("Affirmative permission is required.");
  const email = text(body.email, 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || /[\r\n]/.test(email)) throw new Error("Enter a valid email address.");
  const kind = body.kind as SignupInput["kind"];
  const message = kind === "lead" ? text(body.message, 2_000) : "";
  if (kind === "lead" && message.length < 3) throw new Error("Include your enquiry.");
  return { kind, email, name: text(body.name, 100), message,
    website: text(body.website, 200), token: text(body.turnstileToken, 2_048) };
}
async function readBody(request: Request): Promise<unknown> {
  if (Number(request.headers.get("content-length")) > MAX_BYTES) throw new Error("Request too large.");
  const reader = request.body?.getReader();
  if (!reader) throw new Error("Missing body.");
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > MAX_BYTES) { await reader.cancel(); throw new Error("Request too large."); }
    chunks.push(value);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

export async function verifyTurnstile(token: string, ip: string, config: SignupConfig, fetcher: typeof fetch): Promise<boolean> {
  if (!token) return false;
  const result = await fetcher("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST", redirect: "error", cache: "no-store", signal: AbortSignal.timeout(8_000),
    body: new URLSearchParams({ secret: config.turnstileSecret, response: token, remoteip: ip }),
  });
  if (!result.ok) return false;
  const data = await result.json() as { success?: boolean; hostname?: string; action?: string };
  return data.success === true && data.hostname === new URL(config.origin).hostname && data.action === "signup";
}

/** Atomic shared limits: 10 requests/IP and 3 requests/email per 15 minutes. No raw personal data is stored. */
export async function distributedSignupLimit(email: string, ip: string, config: SignupConfig, fetcher: typeof fetch): Promise<boolean> {
  const hash = (value: string) => createHmac("sha256", config.rateLimitSalt).update(value).digest("hex");
  const script = "local a=redis.call('INCR',KEYS[1]);if a==1 then redis.call('EXPIRE',KEYS[1],ARGV[1]) end;local b=redis.call('INCR',KEYS[2]);if b==1 then redis.call('EXPIRE',KEYS[2],ARGV[1]) end;if a>tonumber(ARGV[2]) or b>tonumber(ARGV[3]) then return 0 end;return 1";
  const result = await fetcher(config.rateLimitUrl, {
    method: "POST", redirect: "error", cache: "no-store", signal: AbortSignal.timeout(5_000),
    headers: { Authorization: `Bearer ${config.rateLimitToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(["EVAL", script, "2", `signup:${hash(config.origin)}:ip:${hash(ip)}`,
      `signup:${hash(config.origin)}:email:${hash(email)}`, "900", "10", "3"]),
  });
  if (!result.ok) throw new Error("Signup rate limit unavailable.");
  const data = await result.json() as { result?: number; error?: string };
  if (data.error || ![0, 1].includes(data.result ?? -1)) throw new Error("Signup rate limit unavailable.");
  return data.result === 1;
}

export function createSignupHandler(config: SignupConfig, dependencies: Dependencies = {}) {
  const fetcher = dependencies.fetcher || fetch;
  const verify = dependencies.verify || ((token: string, ip: string) => verifyTurnstile(token, ip, config, fetcher));
  const rateLimit = dependencies.rateLimit || ((email: string, ip: string) => distributedSignupLimit(email, ip, config, fetcher));
  const submit = dependencies.submit || ((input: SignupInput) => submitCrmSignup(input, config, fetcher));
  return async (request: Request): Promise<Response> => {
    if (!config.enabled) return response(503, "Signup is currently unavailable.");
    if (request.method !== "POST") return response(405, "Use the signup form.");
    if (request.headers.get("origin") !== config.origin || request.headers.get("x-readyspace-signup") !== "1" ||
        (request.headers.get("sec-fetch-site") && request.headers.get("sec-fetch-site") !== "same-origin")) {
      return response(403, "Submit the form from this website.");
    }
    if (!/^application\/json(?:;|$)/i.test(request.headers.get("content-type") || "")) return response(415, "Unsupported request.");
    let input: ReturnType<typeof validateSignup>;
    try { input = validateSignup(await readBody(request)); } catch { return response(400, "Check your details and permission, then submit again."); }
    if (input.website) return response(202, ACCEPTED);
    // This header must be replaced by the trusted reverse proxy, never passed through from visitors.
    const ip = request.headers.get(config.trustedIpHeader) || "";
    if (!isIP(ip)) return response(503, "Signup is currently unavailable.");
    try {
      if (!await rateLimit(input.email, ip)) return response(429, "Please wait before trying again.");
      if (!await verify(input.token, ip)) return response(400, "Complete the verification and submit again.");
      await submit(input);
      return response(202, ACCEPTED);
    } catch {
      // Do not disclose subscriber existence, provider bodies, credentials or personal data.
      return response(503, "We could not process this request. Please try later.");
    }
  };
}
