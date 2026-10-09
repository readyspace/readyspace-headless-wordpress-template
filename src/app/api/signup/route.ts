import "server-only";
import { readSignupConfig } from "../../../lib/crm-config";
import { createSignupHandler } from "../../../lib/signup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  try {
    return await createSignupHandler(readSignupConfig())(request);
  } catch {
    return Response.json({ message: "Signup is currently unavailable." }, { status: 503,
      headers: { "Cache-Control": "no-store" } });
  }
}
