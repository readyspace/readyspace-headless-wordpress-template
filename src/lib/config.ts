function origin(value: string, name: string): string {
  const url = new URL(value);
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || url.pathname !== '/') throw new Error(`Invalid ${name} origin`);
  if (url.protocol !== 'https:' && !['localhost','127.0.0.1'].includes(url.hostname)) throw new Error(`${name} requires HTTPS`);
  return url.origin;
}
export function siteConfig(env:Record<string,string|undefined> = process.env) {
  const siteUrl = origin(env.SITE_URL || 'https://example.com', 'SITE_URL');
  const deploymentUrl = origin(env.DEPLOYMENT_URL || siteUrl, 'DEPLOYMENT_URL');
  const environment = env.SITE_ENV || 'staging';
  if (!['staging','production'].includes(environment)) throw new Error('SITE_ENV must be staging or production');
  if (environment === 'production' && siteUrl !== deploymentUrl) throw new Error('Production origins must match');
  if(env.NEXT_PUBLIC_GA4_ID && env.NEXT_PUBLIC_GTM_ID) throw new Error('Configure GA4 or GTM, not both');
  const endpoint = env.WORDPRESS_GRAPHQL_URL || '';
  if (endpoint) {
    const url = new URL(endpoint);
    origin(url.origin, 'WORDPRESS_GRAPHQL_URL');
    if (url.username || url.password || url.search || url.hash || /wp-json/i.test(url.pathname) || !/^\/graphql\/?$/.test(url.pathname)) throw new Error('Use the WPGraphQL /graphql endpoint');
  }
  return {
    siteUrl, deploymentUrl, environment, endpoint,
    cmsOrigin: endpoint ? new URL(endpoint).origin : '',
    name: env.SITE_NAME || 'Your website', description: env.SITE_DESCRIPTION || '',
    locale: env.SITE_LOCALE || 'en', seoRequired: env.SEO_REQUIRED !== 'false',
    menuLocation: env.WORDPRESS_MENU_LOCATION ?? 'PRIMARY',
    pageSize: Math.max(1,Math.min(100,Number(env.WORDPRESS_POSTS_PER_PAGE)||10)),
    revalidateSeconds: Math.max(30, Math.min(3600, Number(env.CONTENT_CACHE_SECONDS) || 300)),
  };
}
