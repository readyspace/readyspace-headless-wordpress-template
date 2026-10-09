import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { siteConfig } from '../src/lib/config';
import { verifyPreview, verifyWebhook, boundedBody } from '../src/lib/security';
import { seoMetadata } from '../src/lib/seo';
import { graphql } from '../src/lib/graphql';
import { resolveUri, postsPage, previewNode, sitemapNodes } from '../src/lib/content';
const secret='a'.repeat(40),now=1700000000000;
function token(claims:unknown) {const encoded=Buffer.from(JSON.stringify(claims)).toString('base64url');return encoded+'.'+createHmac('sha256',secret).update(encoded).digest('hex');}
test('preview claims enforce expiry, signature, ID and local safe path',()=>{
 const claims={id:7,path:'/nested/article/',exp:now/1000+120};
 assert.deepEqual(verifyPreview(token(claims),secret,now),claims);
 for(const altered of [{...claims,exp:now/1000-1},{...claims,exp:now/1000+1000},{...claims,id:0},{...claims,path:'//evil.example'},{...claims,path:'/%2f%2fevil.example'},{...claims,path:'/../api'},{...claims,path:'/x?preview=1'}]) assert.equal(verifyPreview(token(altered),secret,now),null);
 assert.equal(verifyPreview(token(claims)+'a',secret,now),null);
 assert.equal(verifyPreview(token(claims),'short',now),null);
});
test('webhooks authenticate exact raw body with bounded timestamp',()=>{
 const body=JSON.stringify({paths:['/article/']}),ts=String(now/1000);
 const signature=createHmac('sha256',secret).update(ts+'.'+body).digest('hex');
 assert.equal(verifyWebhook(body,ts,signature,secret,now),true);
 assert.equal(verifyWebhook(body+' ',ts,signature,secret,now),false);
 assert.equal(verifyWebhook(body,ts,signature,secret,now+301000),false);
 assert.equal(verifyWebhook(body,ts,'f'.repeat(64),secret,now),false);
});
test('site configuration rejects WordPress REST, embedded credentials and mixed production origins',()=>{
 assert.throws(()=>siteConfig({WORDPRESS_GRAPHQL_URL:'https://cms.example.com/wp-json/rankmath/v1/getHead'}));
 assert.throws(()=>siteConfig({WORDPRESS_GRAPHQL_URL:'https://user:secret@cms.example.com/graphql'}));
 assert.throws(()=>siteConfig({SITE_ENV:'production',SITE_URL:'https://example.com',DEPLOYMENT_URL:'https://staging.example.com'}));
 assert.equal(siteConfig({WORDPRESS_GRAPHQL_URL:'https://cms.example.com/graphql'}).environment,'staging');
});
test('public SEO honors editorial directives and noindex when SEO is not ready',()=>{
 const before={...process.env};
 process.env.SITE_ENV='production';process.env.SITE_URL='https://example.com';process.env.DEPLOYMENT_URL='https://example.com';process.env.WORDPRESS_GRAPHQL_URL='https://cms.example.com/graphql';
 try {
  assert.equal((seoMetadata(null,null,'/article/').robots as {index:boolean}).index,false);
  const data=seoMetadata({ready:true,title:'Title',canonical:'https://cms.example.com/article/',robots:['noindex','nofollow','max-snippet:0']},null,'/article/');
  assert.deepEqual(data.alternates?.canonical,'https://example.com/article/');
  assert.equal((data.robots as {index:boolean;follow:boolean}).index,false);
  assert.equal((data.robots as {follow:boolean}).follow,false);
  assert.equal((seoMetadata({ready:true},null,'/article/',true).robots as {index:boolean}).index,false);
 } finally {process.env=before;}
});
test('GraphQL public reads are anonymous; previews authenticated and uncached; schema errors fail closed',async()=>{
 const before={...process.env},original=globalThis.fetch;const calls:RequestInit[]=[];
 process.env.WORDPRESS_GRAPHQL_URL='https://cms.example.com/graphql';process.env.WPGRAPHQL_PREVIEW_USER='editor';process.env.WPGRAPHQL_PREVIEW_PASSWORD='private-password';
 globalThis.fetch=async(_url,options)=>{calls.push(options!);return Response.json({data:{ok:true}});};
 try {
  await graphql('query { ok }');await graphql('query { ok }',{},true);
  assert.equal((calls[0].headers as Record<string,string>).Authorization,undefined);
  assert.equal(calls[0].cache,'force-cache');assert.equal(calls[1].cache,'no-store');
  assert.match((calls[1].headers as Record<string,string>).Authorization,/^Basic /);
  assert.equal(calls[1].redirect,'error');
  globalThis.fetch=async()=>Response.json({errors:[{message:'schema mismatch'}]});
  await assert.rejects(graphql('query { bad }'),/schema/);
 } finally {process.env=before;globalThis.fetch=original;}
});
test('URI resolution rejects private/password/CPT nodes and queries page-specific SEO',async()=>{
 const before={...process.env},original=globalThis.fetch;process.env.WORDPRESS_GRAPHQL_URL='https://cms.example.com/graphql';
 let node:Record<string,unknown>={__typename:'Post',uri:'/article/',status:'private'};let variables:Record<string,unknown>={};
 globalThis.fetch=async(_url,options)=>{variables=JSON.parse(String(options?.body)).variables;return Response.json({data:{nodeByUri:node,readyspaceSeo:{ready:true}}});};
 try {
  assert.equal(await resolveUri('/article/'),null);
  node={__typename:'Post',status:'publish',hasPassword:true};assert.equal(await resolveUri('/article/'),null);
  node={__typename:'ContentType',name:'product'};assert.equal(await resolveUri('/products/'),null);
  node={__typename:'ContentType',name:'post'};assert.ok(await resolveUri('/',2,'/page/2/'));assert.equal(variables.seoUri,'/page/2/');
  node={__typename:'Post',status:'publish'};assert.ok(await resolveUri('/year/article/'));
 } finally{process.env=before;globalThis.fetch=original;}
});
test('archive cursor pagination is bounded and does not silently repeat page one',async()=>{
 const before={...process.env},original=globalThis.fetch;process.env.WORDPRESS_GRAPHQL_URL='https://cms.example.com/graphql';
 const after:unknown[]=[];
 globalThis.fetch=async(_url,options)=>{const input=JSON.parse(String(options?.body));after.push(input.variables.after);return Response.json({data:{posts:{nodes:[{uri:after.length===1?'/one/':'/two/'}],pageInfo:{hasNextPage:after.length===1,endCursor:'cursor-one'}}}});};
 try{const page=await postsPage(2);assert.equal(page?.nodes[0].uri,'/two/');assert.deepEqual(after,[null,'cursor-one']);assert.equal(await postsPage(1001),null);}
 finally{process.env=before;globalThis.fetch=original;}
});
test('preview and sitemap exclude password protected content even with authenticated visibility',async()=>{
 const before={...process.env},original=globalThis.fetch;process.env.WORDPRESS_GRAPHQL_URL='https://cms.example.com/graphql';process.env.WPGRAPHQL_PREVIEW_USER='editor';process.env.WPGRAPHQL_PREVIEW_PASSWORD='private-password';
 globalThis.fetch=async()=>Response.json({data:{contentNode:{__typename:'Post',hasPassword:true,isRestricted:false}}});
 try{
  assert.equal(await previewNode(1),null);
  globalThis.fetch=async(_url,options)=>{const query=JSON.parse(String(options?.body)).query;if(query.includes('ReadySpaceColdSeo'))return Response.json({data:{seo0:{ready:true},seo1:{ready:true}}});const field=['posts','pages','categories','tags'].find(field=>query.includes(field+'('))!;return Response.json({data:{[field]:{nodes:[{uri:'/protected/',hasPassword:true},{uri:'/public/'}],pageInfo:{hasNextPage:false,endCursor:null}}}});};
  const nodes=await sitemapNodes();assert.equal(nodes.some(node=>node.uri==='/protected/'),false);assert.equal(nodes.length,4);
 }finally{process.env=before;globalThis.fetch=original;}
});

test('revalidation bounds streamed bytes before authentication and cancels oversized bodies',async()=>{
 const request=new Request('https://example.com/api/revalidate',{method:'POST',body:'a'.repeat(8193)});
 await assert.rejects(boundedBody(request),/large/);
 assert.equal(await boundedBody(new Request('https://example.com/api/revalidate',{method:'POST',body:'{}'})),'{}');
});
