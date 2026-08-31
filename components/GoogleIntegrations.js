import Head from "next/head";
import Script from "next/script";

const GTM_ID_PATTERN = /^GTM-[A-Z0-9]+$/i;
const GOOGLE_TAG_ID_PATTERN = /^(G|AW|DC)-[A-Z0-9-]+$/i;

export function getGoogleTagManagerId() {
  const id = process.env.NEXT_PUBLIC_GTM_ID?.trim();
  return GTM_ID_PATTERN.test(id || "") ? id : null;
}

function getGoogleTagId() {
  const id = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim();
  return GOOGLE_TAG_ID_PATTERN.test(id || "") ? id : null;
}

export function GoogleSiteVerification() {
  const verificationToken =
    process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION?.trim();

  if (!verificationToken) {
    return null;
  }

  return (
    <Head>
      <meta
        name="google-site-verification"
        content={verificationToken}
        key="google-site-verification"
      />
    </Head>
  );
}

export function GoogleTagManager() {
  const containerId = getGoogleTagManagerId();

  if (!containerId) {
    return null;
  }

  const containerIdJson = JSON.stringify(containerId);

  return (
    <Script id="google-tag-manager" strategy="afterInteractive">
      {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer',${containerIdJson});`}
    </Script>
  );
}

export function GoogleTagManagerNoScript() {
  const containerId = getGoogleTagManagerId();

  if (!containerId) {
    return null;
  }

  return (
    <noscript>
      <iframe
        src={`https://www.googletagmanager.com/ns.html?id=${encodeURIComponent(
          containerId,
        )}`}
        height="0"
        width="0"
        style={{ display: "none", visibility: "hidden" }}
        title="Google Tag Manager"
      />
    </noscript>
  );
}

export function GoogleAnalytics() {
  const tagId = getGoogleTagId();

  if (!tagId) {
    return null;
  }

  const tagIdJson = JSON.stringify(tagId);

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(
          tagId,
        )}`}
        strategy="afterInteractive"
      />
      <Script id="google-analytics" strategy="afterInteractive">
        {`window.dataLayer=window.dataLayer||[];
function gtag(){dataLayer.push(arguments);}
gtag('js',new Date());
gtag('config',${tagIdJson});`}
      </Script>
    </>
  );
}
