import { revalidateTag, revalidatePath } from 'next/cache';
import { verifyWebhook, boundedBody } from '@/lib/security';
import { safePath } from '@/lib/paths';
import { CONTENT_TAG } from '@/lib/graphql';
export async function POST(request:Request) {
  let body:string;
  try{body=await boundedBody(request);}catch{return new Response('Too large',{status:413});}
  if(!verifyWebhook(body,request.headers.get('x-readyspace-timestamp')||'',request.headers.get('x-readyspace-signature')||'',process.env.REVALIDATION_SECRET||'')) return new Response('Unauthorized',{status:401});
  try {
    const payload=JSON.parse(body) as {paths:unknown[]};
    if(!Array.isArray(payload.paths)||payload.paths.length>100||!payload.paths.length) throw new Error();
    const paths=payload.paths.map(path=>{if(typeof path!=='string') throw new Error();return safePath(path);});
    revalidateTag(CONTENT_TAG,{expire:0});
    for(const path of paths) revalidatePath(path);
    revalidatePath('/sitemap.xml');
    return Response.json({revalidated:true});
  } catch { return new Response('Invalid payload',{status:400}); }
}
