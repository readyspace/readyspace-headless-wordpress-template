const REQUEST_TIMEOUT_MS = 5000;

function isEnabled() {
  return process.env.RANK_MATH_ENABLED?.toLowerCase() === "true";
}

function toPathname(pathSegments) {
  if (!pathSegments) {
    return "/";
  }

  const segments = Array.isArray(pathSegments) ? pathSegments : [pathSegments];
  const pathname = `/${segments
    .map((segment) => encodeURIComponent(segment))
    .join("/")}`;
  return pathname.endsWith("/") ? pathname : `${pathname}/`;
}

export async function getRankMathHead(pathSegments) {
  if (!isEnabled()) {
    return null;
  }

  const wordpressUrl = process.env.NEXT_PUBLIC_WORDPRESS_URL;
  const publicSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;

  if (!wordpressUrl || !publicSiteUrl) {
    console.warn(
      "Rank Math is enabled, but NEXT_PUBLIC_WORDPRESS_URL or NEXT_PUBLIC_SITE_URL is missing.",
    );
    return null;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const pageUrl = new URL(
      toPathname(pathSegments),
      `${publicSiteUrl.replace(/\/$/, "")}/`,
    );
    const endpoint = new URL(
      "/wp-json/rankmath/v1/getHead",
      `${wordpressUrl.replace(/\/$/, "")}/`,
    );
    endpoint.searchParams.set("url", pageUrl.toString());

    const response = await fetch(endpoint, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const result = await response.json();

    if (result?.success !== true || typeof result?.head !== "string") {
      throw new Error("the response did not contain head metadata");
    }

    return result.head;
  } catch (error) {
    console.warn(`Unable to load Rank Math metadata: ${error.message}`);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
