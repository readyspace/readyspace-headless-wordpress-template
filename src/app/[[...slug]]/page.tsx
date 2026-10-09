import { cache } from 'react';
import { cookies, draftMode } from 'next/headers';
import { notFound } from 'next/navigation';
import { resolveUri, postsPage, previewNode } from '@/lib/content';
import { siteConfig } from '@/lib/config';
import { archivePath, routePath, publicUrl } from '@/lib/paths';
import { verifyPreview } from '@/lib/security';
import { seoMetadata } from '@/lib/seo';
import { cleanHtml, plainText, serializeSchema } from '@/lib/html';
import type { Node } from '@/lib/types';
export const dynamic='force-dynamic';
const load = cache(async (path:string) => {
  const config=siteConfig();
  if(!config.endpoint) return null;
  const draft=(await draftMode()).isEnabled;
  if(draft) {
    const claims=verifyPreview((await cookies()).get('readyspace_preview')?.value||'',process.env.PREVIEW_SECRET||'');
    if(!claims || claims.path.replace(/\/$/,'')!==path.replace(/\/$/,'')) notFound();
    const node=await previewNode(claims.id); if(!node) notFound();
    return {node,seo:null,preview:true,page:1,base:path,posts:null};
  }
  const {uri,page}=archivePath(path);
  // An actual page/post ending in /page/N wins over inferred archive pagination.
  if(page>1) {
    const direct=await resolveUri(path);
    if(direct?.node && ['Page','Post'].includes(direct.node.__typename)) return {...direct,preview:false,page:1,base:path,posts:null};
  }
  const result=await resolveUri(uri,page,path);
  if(!result) notFound();
  let posts=result.node?.posts||null;
  if(result.node?.__typename==='ContentType' || (!result.node && uri==='/')) posts=await postsPage(page);
  if(!result.node && !posts) notFound();
  if(page>1 && !posts) notFound();
  return {...result,preview:false,page,base:uri,posts};
});
export async function generateMetadata({params}:{params:Promise<{slug?:string[]}>}) {
  const path=routePath((await params).slug);
  const data=await load(path);
  return seoMetadata(data?.seo,data?.node||null,path,data?.preview);
}
function PostList({nodes}:{nodes:Node[]}) {
  const config=siteConfig();
  return <ul className="post-list">{nodes.filter(node=>!node.isRestricted&&!node.hasPassword&&(!node.status||node.status==='publish')).map(node=><li key={node.uri}><a href={publicUrl(node.uri||'/',config.siteUrl,config.cmsOrigin)}>{plainText(node.title||'Untitled')}</a><div dangerouslySetInnerHTML={{__html:cleanHtml(node.excerpt||'',config.siteUrl,config.cmsOrigin)}} /></li>)}</ul>;
}
export default async function WordPressPage({params}:{params:Promise<{slug?:string[]}>}) {
  const path=routePath((await params).slug),config=siteConfig(),data=await load(path);
  if(!data) return <><h1>{config.name}</h1><p>Configure this starter using the repository setup guide.</p></>;
  const {node,seo,preview,posts,page,base}=data;
  if(node && !['Post','Page','Category','Tag','User','ContentType'].includes(node.__typename)) notFound();
  const schema=!preview && seo?.ready && seo.jsonLd ? serializeSchema(seo.jsonLd,config.siteUrl,config.cmsOrigin):null;
  return <>
    {preview&&<aside className="preview">Editor preview · <a href="/api/exit-preview">Exit preview</a></aside>}
    {schema&&<script type="application/ld+json" dangerouslySetInnerHTML={{__html:schema}} />}
    <article>
      <h1>{plainText(node?.__typename==='ContentType'?config.name:(node?.title||node?.name||config.name))}{page>1?` — Page ${page}`:''}</h1>
      {node?.__typename==='Post'&&<p>{node.date&&<time dateTime={node.date}>{node.date.slice(0,10)}</time>} {node.author&&<> · <a href={node.author.node.uri}>{node.author.node.name}</a></>}</p>}
      {node?.featuredImage&&<img className="featured" src={node.featuredImage.node.sourceUrl} alt={node.featuredImage.node.altText||''} />}
      <div className="wp-content" dangerouslySetInnerHTML={{__html:cleanHtml(node?.content||node?.description||'',config.siteUrl,config.cmsOrigin)}} />
      {node?.categories&&<p>Categories: {node.categories.nodes.map(category=><a key={category.uri} href={category.uri}>{category.name} </a>)}</p>}
      {node?.tags&&<p>Tags: {node.tags.nodes.map(tag=><a key={tag.uri} href={tag.uri}>{tag.name} </a>)}</p>}
      {posts&&<><PostList nodes={posts.nodes}/><nav aria-label="Archive pages">{page>1&&<a href={page===2?base:`${base.replace(/\/$/,'')}/page/${page-1}/`}>Previous</a>} {posts.pageInfo.hasNextPage&&<a href={`${base.replace(/\/$/,'')}/page/${page+1}/`}>Next</a>}</nav></>}
    </article>
  </>;
}
