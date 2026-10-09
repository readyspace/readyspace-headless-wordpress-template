import { draftMode } from 'next/headers';
import { NextResponse } from 'next/server';
import { verifyPreview } from '@/lib/security';
import { previewNode } from '@/lib/content';
import { siteConfig } from '@/lib/config';
export async function GET(request:Request) {
  const token=new URL(request.url).searchParams.get('token')||'';
  const claims=verifyPreview(token,process.env.PREVIEW_SECRET||'');
  if(!claims) return new Response('Invalid or expired preview',{status:401,headers:{'Cache-Control':'no-store'}});
  try {
    if(!await previewNode(claims.id)) return new Response('Preview unavailable',{status:404});
    (await draftMode()).enable();
    const response=NextResponse.redirect(new URL(claims.path,siteConfig().deploymentUrl));
    response.cookies.set('readyspace_preview',token,{httpOnly:true,secure:true,sameSite:'lax',maxAge:300,path:'/'});
    response.headers.set('Cache-Control','private, no-store');
    response.headers.set('Referrer-Policy','no-referrer');
    response.headers.set('X-Robots-Tag','noindex, nofollow');
    return response;
  } catch { return new Response('Preview unavailable',{status:503}); }
}
