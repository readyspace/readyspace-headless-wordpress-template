import {siteConfig} from '@/lib/config';
export const dynamic='force-dynamic';
export async function GET(){
 const config=siteConfig();
 const body=config.environment==='production' && config.endpoint ? `User-agent: *\nAllow: /\nDisallow: /api/\nSitemap: ${config.siteUrl}/sitemap_index.xml\n`:'User-agent: *\nDisallow: /\n';
 return new Response(body,{headers:{'Content-Type':'text/plain; charset=utf-8'}});
}
