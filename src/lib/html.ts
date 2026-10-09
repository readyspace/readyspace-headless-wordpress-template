import sanitizeHtml from 'sanitize-html';
import { decodeHTML } from 'entities';
import { publicUrl, isMediaPath } from './paths';
export function cleanHtml(html:string, siteUrl:string, cmsOrigin:string):string {
  return sanitizeHtml(html, {
    allowedTags: [...sanitizeHtml.defaults.allowedTags, 'img','picture','source','figure','figcaption','video','audio'],
    allowedAttributes: {
      '*':['class','id','lang','dir'], a:['href','title','rel','target'],
      img:['src','alt','width','height','loading'], source:['src','type'],
      video:['src','controls','poster','width','height'],audio:['src','controls'],
      td:['colspan','rowspan'], th:['colspan','rowspan','scope'],
    },
    allowedSchemes: ['http','https','mailto','tel'],
    transformTags: {
      a: (tagName, attrs) => {
        if (attrs.href) { try { attrs.href=publicUrl(attrs.href,siteUrl,cmsOrigin); } catch { delete attrs.href; } }
        if (attrs.target==='_blank') attrs.rel='noopener noreferrer';
        return {tagName,attribs:attrs};
      },
      img: mediaTransform,
      source: mediaTransform,
      video: mediaTransform,
      audio: mediaTransform,
    },
  });
  function mediaTransform(tagName:string, attrs:Record<string,string>) {
    for(const field of ['src','poster']) {
      if(!attrs[field]) continue;
      try {
        // Relative media emitted by the CMS resolves at the CMS, not the frontend.
        const url=new URL(attrs[field],cmsOrigin||siteUrl);
        if(!['http:','https:'].includes(url.protocol)||url.username||url.password) throw new Error();
        attrs[field]=url.href;
      } catch { delete attrs[field]; }
    }
    return {tagName,attribs:attrs};
  }
}
export function plainText(html:string) { return decodeHTML(sanitizeHtml(html,{allowedTags:[],allowedAttributes:{}})); }
export function serializeSchema(json:string, siteUrl:string, cmsOrigin:string):string|null {
  try {
    if(json.length>1_000_000) return null;
    let count=0;
    const mediaKeys=new Set(['image','logo','thumbnailUrl','contentUrl','embedUrl','audio','video']);
    const rewrite=(value:unknown,key='',mediaObject=false,depth=0):unknown => {
      if(++count>10_000||depth>40) throw new Error('Schema exceeds safe limits');
      if(typeof value==='string' && cmsOrigin) {
        try {
          const url=new URL(value);
          if(url.origin===cmsOrigin && !isMediaPath(url.pathname) && !mediaKeys.has(key) && !(mediaObject&&key==='url')) {
            return publicUrl(value,siteUrl,cmsOrigin);
          }
        } catch { /* Non-URL text is preserved as editorial data. */ }
      }
      if(Array.isArray(value)) return value.map(item=>rewrite(item,key,mediaObject,depth+1));
      if(value && typeof value==='object') {
        const object=value as Record<string,unknown>;
        const types=Array.isArray(object['@type'])?object['@type']:[object['@type']];
        const media=types.some(type=>['ImageObject','VideoObject','AudioObject','MediaObject'].includes(String(type)));
        return Object.fromEntries(Object.entries(object).map(([childKey,item])=>[childKey,rewrite(item,childKey,media,depth+1)]));
      }
      return value;
    };
    const parsed=JSON.parse(json);
    if(!parsed || typeof parsed!=='object') return null;
    return JSON.stringify(rewrite(parsed)).replace(/</g,'\\u003c');
  } catch { return null; }
}
