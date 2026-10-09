"use client";

import Script from "next/script";
import { useState } from "react";

export type OptionalIntegrationsProps = { ga4Id?: string; gtmId?: string; mapsEmbedUrl?: string; googleReviewUrl?: string };
declare global { interface Window { dataLayer?: unknown[]; gtag?: (...args: unknown[]) => void } }

function mapsUrl(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "www.google.com" &&
      url.pathname.startsWith("/maps/embed") && !url.username && !url.password ? url.toString() : null;
  } catch { return null; }
}
function reviewUrl(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && ["g.page", "www.google.com", "maps.google.com"].includes(url.hostname) &&
      !url.username && !url.password ? url.toString() : null;
  } catch { return null; }
}

export function OptionalIntegrations({ ga4Id, gtmId, mapsEmbedUrl, googleReviewUrl }: OptionalIntegrationsProps) {
  const [analytics, setAnalytics] = useState(false);
  const [maps, setMaps] = useState(false);
  const map = mapsUrl(mapsEmbedUrl);
  const review = reviewUrl(googleReviewUrl);
  // An ambiguous dual installation loads neither provider. Server configuration should also reject it.
  const ga = !gtmId && /^G-[A-Z0-9]+$/.test(ga4Id || "") ? ga4Id : undefined;
  const gtm = !ga4Id && /^GTM-[A-Z0-9]+$/.test(gtmId || "") ? gtmId : undefined;
  function allowAnalytics() {
    if (!ga && !gtm) return;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer?.push(arguments); };
    // Queue consent synchronously before rendering either external provider script.
    window.gtag("consent", "default", { analytics_storage: "denied", ad_storage: "denied",
      ad_user_data: "denied", ad_personalization: "denied" });
    window.gtag("consent", "update", { analytics_storage: "granted" });
    if (ga) {
      window.gtag("js", new Date());
      window.gtag("config", ga, { send_page_view: true });
    }
    setAnalytics(true);
  }

  if (!ga && !gtm && !map && !review) return null;
  return <aside className="optional-integrations" aria-label="Optional services">
    {(ga || gtm) && <div>
      <p>Optional analytics helps us understand use of this website.</p>
      {!analytics ? <button type="button" onClick={allowAnalytics}>Allow analytics for this visit</button> :
        <button type="button" onClick={() => window.location.reload()}>Withdraw analytics consent and reload</button>}
    </div>}
    {analytics && ga && <Script id="readyspace-ga4" src={`https://www.googletagmanager.com/gtag/js?id=${ga}`} strategy="afterInteractive" />}
    {analytics && gtm && <Script id="readyspace-gtm" strategy="afterInteractive">{
      `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s);j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer',${JSON.stringify(gtm)});`
    }</Script>}
    {map && <div>{!maps ? <button type="button" onClick={() => setMaps(true)}>Load Google Maps</button> :
      <><iframe src={map} title="Location on Google Maps" loading="lazy" referrerPolicy="no-referrer" width="100%" height="350" />
        <button type="button" onClick={() => setMaps(false)}>Remove map</button></>}</div>}
    {review && <p><a href={review} rel="noopener noreferrer" target="_blank">Read or leave a Google review</a></p>}
  </aside>;
}

export default OptionalIntegrations;
