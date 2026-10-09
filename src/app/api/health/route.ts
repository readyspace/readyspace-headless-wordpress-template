import { graphql } from '@/lib/graphql';
import { SEO_FIELDS } from '@/lib/content';
import type { Seo } from '@/lib/types';
export const dynamic='force-dynamic';
export async function GET(request:Request) {
  const commit=process.env.RELEASE_COMMIT||'development';
  if(new URL(request.url).searchParams.get('ready')==='1') {
    try {
      const data=await graphql<{readyspaceFrontPageSeo:Seo}>(`query ReadySpaceReadiness { readyspaceFrontPageSeo {${SEO_FIELDS}} }`);
      if(!data.readyspaceFrontPageSeo?.ready) throw new Error();
    } catch { return Response.json({ok:false,commit},{status:503,headers:{'Cache-Control':'no-store'}}); }
  }
  return Response.json({ok:true,commit},{headers:{'Cache-Control':'no-store'}});
}
