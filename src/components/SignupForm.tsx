"use client";

import Script from "next/script";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";

type Turnstile = { render: (container: HTMLElement, options: Record<string, unknown>) => string;
  reset: (id: string) => void; remove: (id: string) => void };
declare global { interface Window { turnstile?: Turnstile } }

export type SignupFormProps = { kind?: "newsletter" | "lead"; privacyUrl: string; turnstileSiteKey: string };

export default function SignupForm({ kind = "newsletter", privacyUrl, turnstileSiteKey }: SignupFormProps) {
  const id = useId();
  const widget = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const [scriptReady, setScriptReady] = useState(false);
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!window.turnstile || !widget.current || !turnstileSiteKey) return;
    widgetId.current = window.turnstile.render(widget.current, {
      sitekey: turnstileSiteKey, action: "signup",
      callback: (value: string) => setToken(value),
      "expired-callback": () => setToken(""), "error-callback": () => setToken(""),
    });
    return () => { if (widgetId.current) window.turnstile?.remove(widgetId.current); widgetId.current = null; };
  }, [scriptReady, turnstileSiteKey]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusy(true);
    setMessage("");
    try {
      const result = await fetch("/api/signup", {
        method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json", "x-readyspace-signup": "1" },
        body: JSON.stringify({ kind, email: data.get("email"), name: data.get("name"),
          message: data.get("message") || "", consent: data.get("consent") === "yes",
          website: data.get("website"), turnstileToken: token }),
      });
      const body = await result.json() as { message?: string };
      setMessage(body.message || "Please try again later.");
      if (result.ok) form.reset();
    } catch { setMessage("We could not process this request. Please try later."); }
    finally {
      setBusy(false); setToken("");
      if (widgetId.current) window.turnstile?.reset(widgetId.current);
    }
  }

  return <form onSubmit={submit} className="signup-form" aria-label={kind === "newsletter" ? "Newsletter signup" : "Contact enquiry"}>
    <h2>{kind === "newsletter" ? "Subscribe to new articles" : "Send an enquiry"}</h2>
    <label htmlFor={`${id}-name`}>Name <span>(optional)</span></label>
    <input id={`${id}-name`} name="name" autoComplete="name" maxLength={100} />
    <label htmlFor={`${id}-email`}>Email</label>
    <input id={`${id}-email`} name="email" type="email" autoComplete="email" maxLength={254} required />
    {kind === "lead" && <><label htmlFor={`${id}-message`}>Your enquiry</label>
      <textarea id={`${id}-message`} name="message" maxLength={2000} required rows={4} /></>}
    <div style={{ position: "absolute", left: "-10000px" }} aria-hidden="true">
      <label htmlFor={`${id}-website`}>Leave this field empty</label>
      <input id={`${id}-website`} name="website" tabIndex={-1} autoComplete="off" maxLength={200} />
    </div>
    <label><input type="checkbox" name="consent" value="yes" required /> {kind === "newsletter" ?
      "I want email notifications of new articles. I understand that I must confirm my email before subscribing." :
      "I agree that my details may be used to respond to this enquiry."} Read the <a href={privacyUrl}>privacy notice</a>.</label>
    {turnstileSiteKey && <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
      strategy="afterInteractive" onReady={() => setScriptReady(true)} />}
    <div ref={widget} />
    <button type="submit" disabled={busy || !token}>{busy ? "Submitting…" : kind === "newsletter" ? "Request subscription" : "Send enquiry"}</button>
    <p role="status" aria-live="polite">{message}</p>
  </form>;
}
