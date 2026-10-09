import { siteConfig } from '@/lib/config';
export const dynamic='force-dynamic';
export async function GET(){
  const config=siteConfig();
  if(config.environment!=='production') return new Response('Not available',{status:404});
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><sitemap><loc>${config.siteUrl}/sitemap.xml</loc></sitemap></sitemapindex>`,{headers:{'Content-Type':'application/xml; charset=utf-8'}});
}
