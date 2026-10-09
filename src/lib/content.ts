import 'server-only';
import { graphql } from './graphql';
import { siteConfig } from './config';
import type {Node, Connection, Seo} from './types';
export const SEO_FIELDS = `ready generatedAt title description canonical robots openGraphTitle openGraphDescription openGraphImage openGraphUrl openGraphType openGraphSiteName twitterCard twitterTitle twitterDescription twitterImage jsonLd`;
const POST_FIELDS = `id databaseId uri title content excerpt status date modified isRestricted hasPassword readyspaceSeo { ${SEO_FIELDS} } author { node { name uri } } featuredImage { node { sourceUrl altText mediaDetails { width height } } } categories { nodes { name uri } } tags { nodes { name uri } }`;
const PAGE_FIELDS = `id databaseId uri title content status date modified isRestricted hasPassword readyspaceSeo { ${SEO_FIELDS} } featuredImage { node { sourceUrl altText } }`;
const LIST = `nodes { id uri title excerpt status isRestricted hasPassword } pageInfo { hasNextPage endCursor }`;
const URI_QUERY = `query ReadySpaceUri($uri:String!, $seoUri:String!, $after:String, $first:Int!) { readyspaceSeo(uri:$seoUri) {${SEO_FIELDS}} nodeByUri(uri:$uri) { __typename ... on ContentType { name isRestricted } ... on Post { ${POST_FIELDS} } ... on Page { ${PAGE_FIELDS} } ... on Category { id uri name description readyspaceSeo {${SEO_FIELDS}} posts(first:$first,after:$after,where:{status:PUBLISH}) {${LIST}} } ... on Tag { id uri name description readyspaceSeo {${SEO_FIELDS}} posts(first:$first,after:$after,where:{status:PUBLISH}) {${LIST}} } ... on User { id uri name posts(first:$first,after:$after,where:{status:PUBLISH}) {${LIST}} } } }`;
export async function resolveUri(uri:string, page = 1, seoUri=uri) {
  if (page > 1000) return null;
  let after:string|null = null;
  let data:{nodeByUri:Node|null;readyspaceSeo:Seo|null}|undefined;
  for (let index=1; index<=page; index++) {
    data = await graphql<{nodeByUri:Node|null;readyspaceSeo:Seo|null}>(URI_QUERY,{uri,seoUri,after,first:siteConfig().pageSize});
    const node:Node|null = data.nodeByUri;
    if (node && (node.isRestricted || node.hasPassword || (node.status && node.status !== 'publish') || (node.__typename==='ContentType' && node.name!=='post'))) return null;
    if (index < page) {
      if(node?.__typename==='ContentType' || (!node && uri==='/')) break;
      if (!node?.posts?.pageInfo.hasNextPage) return null;
      after = node.posts.pageInfo.endCursor;
    }
  }
  if (!data) return null;
  return {node:data.nodeByUri, seo:data.readyspaceSeo?.ready ? data.readyspaceSeo : (page===1 && data.nodeByUri?.readyspaceSeo?.ready ? data.nodeByUri.readyspaceSeo : data.readyspaceSeo)};
}
export async function postsPage(page=1):Promise<Connection<Node>|null> {
  if (page>1000) return null;
  let after:string|null=null, posts:Connection<Node>|null=null;
  for(let index=1;index<=page;index++) {
    const data:{posts:Connection<Node>} = await graphql<{posts:Connection<Node>}>(`query ReadySpacePosts($after:String,$first:Int!) { posts(first:$first,after:$after,where:{status:PUBLISH}) {${LIST}} }`,{after,first:siteConfig().pageSize});
    posts=data.posts;
    if (index<page && !posts.pageInfo.hasNextPage) return null;
    after=posts.pageInfo.endCursor;
  }
  return posts;
}
export async function navigation() {
  if (!siteConfig().endpoint || !siteConfig().menuLocation) return [];
  const data = await graphql<{menuItems:{nodes:{id:string;label:string;url:string;parentId:string|null}[];pageInfo:{hasNextPage:boolean}}}>(`query ReadySpaceMenu($location:MenuLocationEnum!) { menuItems(first:100,where:{location:$location}) { nodes { id label url parentId } pageInfo {hasNextPage} } }`,{location:siteConfig().menuLocation});
  if(data.menuItems.pageInfo?.hasNextPage) throw new Error('Menu exceeds template capacity; implement menu pagination');
  return data.menuItems.nodes;
}
export async function previewNode(id:number):Promise<Node|null> {
  const data = await graphql<{contentNode:Node|null}>(`query ReadySpacePreview($id:ID!) { contentNode(id:$id,idType:DATABASE_ID,asPreview:true) { __typename ... on Post { ${POST_FIELDS} } ... on Page { ${PAGE_FIELDS} } } }`,{id:String(id)},true);
  return data.contentNode && !data.contentNode.isRestricted && !data.contentNode.hasPassword ? data.contentNode : null;
}
export async function sitemapNodes():Promise<Node[]> {
  const nodes:Node[]=[];
  for (const field of ['posts','pages','categories','tags'] as const) {
    let after:string|null=null;
    for(let batch=0;batch<10000;batch++) {
      const where=field==='posts'||field==='pages' ? ',where:{status:PUBLISH}' : ',where:{hideEmpty:true}';
      const fields=field==='posts'||field==='pages' ? `uri modified isRestricted hasPassword` : `uri`;
      const result:Record<string,Connection<Node>> = await graphql(`query ReadySpaceSitemap($after:String) { ${field}(first:100,after:$after${where}) { nodes { ${fields} } pageInfo {hasNextPage endCursor} } }`,{after});
      nodes.push(...result[field].nodes.filter(node=>!node.isRestricted&&!node.hasPassword));
      if (!result[field].pageInfo.hasNextPage) break;
      const cursor=result[field].pageInfo.endCursor;
      if (!cursor || cursor===after) throw new Error('Invalid sitemap cursor');
      after=cursor;
      if(batch===9999) throw new Error('Sitemap capacity exceeded; add sitemap sharding');
    }
  }
  // Request snapshot metadata in pairs: the bridge permits two warm renders per
  // request. Recover any cached ready:false entry through a fresh anonymous query.
  const cold=nodes.filter(node=>!node.readyspaceSeo?.ready && node.uri);
  for(let index=0;index<cold.length;index+=2) {
    const pair=cold.slice(index,index+2);
    const definitions=pair.map((_,slot)=>`$uri${slot}:String!`).join(',');
    const fields=pair.map((_,slot)=>`seo${slot}:readyspaceSeo(uri:$uri${slot}) {${SEO_FIELDS}}`).join(' ');
    const variables=Object.fromEntries(pair.map((node,slot)=>[`uri${slot}`,node.uri]));
    let recovered=await graphql<Record<string,Seo>>(`query ReadySpaceColdSeo(${definitions}) {${fields}}`,variables);
    if(Object.values(recovered).some(seo=>!seo?.ready)) recovered=await graphql<Record<string,Seo>>(`query ReadySpaceColdSeo(${definitions}) {${fields}}`,variables,false,true);
    pair.forEach((node,slot)=>{node.readyspaceSeo=recovered[`seo${slot}`];});
  }
  return nodes;
}
