import type { Metadata } from 'next';
import type { Node, Seo } from './types';
import { siteConfig } from './config';
import { publicUrl } from './paths';
import { plainText } from './html';
export function seoMetadata(seo:Seo|null|undefined, node:Node|null, path:string, preview=false):Metadata {
  const config=siteConfig();
  const noindex = preview || config.environment!=='production' || (config.seoRequired && !seo?.ready) || seo?.robots?.includes('noindex');
  const nofollow = preview || config.environment!=='production' || seo?.robots?.includes('nofollow');
  const title=plainText(seo?.title || node?.title || node?.name || config.name);
  const description=plainText(seo?.description || config.description);
  const canonical=publicUrl(seo?.canonical || path,config.siteUrl,config.cmsOrigin);
  return {
    title, description, alternates: preview ? undefined : {canonical},
    robots:{index:!noindex,follow:!nofollow,noarchive:seo?.robots?.includes('noarchive'),nosnippet:seo?.robots?.includes('nosnippet'),noimageindex:seo?.robots?.includes('noimageindex'),
      'max-snippet':Number(seo?.robots?.find(value=>value.startsWith('max-snippet:'))?.split(':')[1]||-1),
      'max-video-preview':Number(seo?.robots?.find(value=>value.startsWith('max-video-preview:'))?.split(':')[1]||-1),
      'max-image-preview':seo?.robots?.includes('max-image-preview:large')?'large':seo?.robots?.includes('max-image-preview:none')?'none':'standard'},
    openGraph:{title:plainText(seo?.openGraphTitle||title),description:plainText(seo?.openGraphDescription||description),url:canonical,siteName:seo?.openGraphSiteName||config.name,type:node?.__typename==='Post'?'article':'website',images:seo?.openGraphImage?[seo.openGraphImage]:[]},
    twitter:{card:seo?.twitterCard==='summary_large_image'?'summary_large_image':'summary',title:plainText(seo?.twitterTitle||title),description:plainText(seo?.twitterDescription||description),images:seo?.twitterImage?[seo.twitterImage]:[]},
  };
}
