import { sitemapNodes, resolveUri } from '@/lib/content';
import { siteConfig } from '@/lib/config';
import { publicUrl } from '@/lib/paths';
export const dynamic='force-dynamic';
const xml=(value:string)=>value.replace(/[<>&"']/g,ch=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[ch]!));
export async function GET() {
  const config=siteConfig();
  if(config.environment!=='production') return new Response('Not available',{status:404});
  const nodes=await sitemapNodes(),home=await resolveUri('/');
  nodes.unshift({__typename:'Page',uri:'/',readyspaceSeo:home?.seo||undefined});
  if(config.seoRequired && nodes.some(node=>!node.readyspaceSeo?.ready)) return new Response('SEO snapshots require warming before sitemap publication',{status:503,headers:{'Cache-Control':'no-store'}});
  const urls=new Map<string,string>();
  for(const node of nodes) {
    if(!node.uri || node.readyspaceSeo?.robots?.includes('noindex') || (config.seoRequired && !node.readyspaceSeo?.ready)) continue;
    const url=publicUrl(node.readyspaceSeo?.canonical||node.uri,config.siteUrl,config.cmsOrigin);
    if(new URL(url).origin!==config.siteUrl) continue;
    urls.set(url,`<url><loc>${xml(url)}</loc>${node.modified?`<lastmod>${xml(node.modified)}</lastmod>`:''}</url>`);
  }
  if(urls.size>50000) return new Response('Sitemap sharding required',{status:503});
  const body=`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${[...urls.values()].join('')}</urlset>`;
  if(Buffer.byteLength(body)>50*1024*1024) return new Response('Sitemap sharding required',{status:503});
  return new Response(body,{headers:{'Content-Type':'application/xml; charset=utf-8','Cache-Control':'public, max-age=60'}});
}
