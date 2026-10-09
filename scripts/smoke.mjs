// Local fixture smoke test; never contacts a real CMS or CRM.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
const seo={ready:true,title:'Editorial title',description:'Editorial description',canonical:'https://cms.example.com/legacy/article/',robots:['index','follow'],jsonLd:JSON.stringify({'@context':'https://schema.org','@type':'Article',url:'https://cms.example.com/legacy/article/',image:'https://cms.example.com/wp-content/uploads/article.jpg'})};
const article={__typename:'Post',id:'post1',uri:'/legacy/article/',status:'publish',hasPassword:false,title:'Article &amp; title',content:'<p>Rendered content <script>unsafe()</script></p>',date:'2026-10-09T10:00:00',readyspaceSeo:seo};
const environment=process.env.SMOKE_ENV||'staging';
const calls=[];
const fixture=createServer(async(request,response)=>{
 assert.equal(request.method,'POST');assert.equal(request.url,'/graphql');
 let body='';for await(const chunk of request)body+=chunk;
 const input=JSON.parse(body);calls.push(input);
 let data;
 if(input.query.includes('ReadySpaceMenu'))data={menuItems:{nodes:[]}};
 else if(input.query.includes('ReadySpaceReadiness'))data={readyspaceFrontPageSeo:seo};
 else if(input.query.includes('ReadySpaceUri'))data={nodeByUri:input.variables.uri==='/legacy/article'?article:null,readyspaceSeo:seo};
 else if(input.query.includes('ReadySpaceSitemap')){const field=['posts','pages','categories','tags'].find(field=>input.query.includes(field+'('));data={[field]:{nodes:field==='posts'?[{uri:'/legacy/article/',modified:'2026-10-09T10:00:00',hasPassword:false,isRestricted:false}]:[],pageInfo:{hasNextPage:false,endCursor:null}}};}
 else if(input.query.includes('ReadySpaceColdSeo'))data={seo0:seo,seo1:seo};
 else if(input.query.includes('ReadySpacePosts'))data={posts:{nodes:[article],pageInfo:{hasNextPage:false,endCursor:null}}};
 else throw new Error('Unexpected query');
 response.writeHead(200,{'Content-Type':'application/json'});response.end(JSON.stringify({data}));
});
fixture.listen(0,'127.0.0.1');await once(fixture,'listening');
const fixturePort=fixture.address().port;
const cmsOrigin=`http://127.0.0.1:${fixturePort}`;
seo.canonical=cmsOrigin+'/legacy/article/';
seo.jsonLd=JSON.stringify({'@context':'https://schema.org','@type':'Article',url:seo.canonical,image:cmsOrigin+'/wp-content/uploads/article.jpg'});
const frontendPort=process.env.SMOKE_PORT||'31991';
const child=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port',frontendPort],{env:{...process.env,SITE_ENV:environment,SITE_URL:'https://example.com',DEPLOYMENT_URL:environment==='production'?'https://example.com':'https://staging.example.com',WORDPRESS_GRAPHQL_URL:`http://127.0.0.1:${fixturePort}/graphql`,CRM_SIGNUP_ENABLED:'false',RELEASE_COMMIT:'fixture'},stdio:['ignore','pipe','pipe']});
let log='';child.stdout.on('data',chunk=>{log+=chunk});child.stderr.on('data',chunk=>{log+=chunk});
const origin=`http://127.0.0.1:${frontendPort}`;
try{
 let ready=false;for(let index=0;index<80;index++){try{if((await fetch(origin+'/api/health')).ok){ready=true;break;}}catch{}await new Promise(resolve=>setTimeout(resolve,100));}
 assert.ok(ready,'Frontend did not start: '+log);
 const health=await fetch(origin+'/api/health?ready=1');assert.equal(health.status,200);assert.equal((await health.json()).commit,'fixture');
 const response=await fetch(origin+'/legacy/article/');assert.equal(response.status,200);if(environment==='staging')assert.match(response.headers.get('x-robots-tag'),/noindex/);else assert.equal(response.headers.get('x-robots-tag'),null);
 const html=await response.text();assert.match(html,/<title>Editorial title<\/title>/);assert.match(html,/https:\/\/example.com\/legacy\/article\//);assert.match(html,/Rendered content/);assert.doesNotMatch(html,/<script>unsafe/);assert.match(html,/application\/ld\+json/);assert.ok(html.includes(cmsOrigin+'/wp-content/uploads/article.jpg'),'Schema media must remain hosted at CMS origin');
 assert.equal((await fetch(origin+'/missing/')).status,404);
 const sitemap=await fetch(origin+'/sitemap.xml');
 if(environment==='staging'){assert.equal(sitemap.status,404);assert.match(await(await fetch(origin+'/robots.txt')).text(),/Disallow: \//);}
 else{assert.equal(sitemap.status,200);assert.ok((await sitemap.text()).includes('https://example.com/legacy/article/'));assert.match(await(await fetch(origin+'/robots.txt')).text(),/Sitemap:/);assert.ok(html.includes('content="index, follow'),'Production metadata must be indexable');}
 assert.equal((await fetch(origin+'/api/preview?token=invalid')).status,401);
 assert.equal((await fetch(origin+'/api/revalidate',{method:'POST',body:'{}'})).status,401);
 assert.equal((await fetch(origin+'/api/signup',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).status,503);
 assert.ok(calls.some(call=>call.variables?.uri==='/legacy/article'));
 console.log(environment+' local HTTP smoke passed: SSR legacy URI, metadata/schema/media, sanitized HTML, 404, environment robots/sitemap, CMS readiness, preview/webhook rejection and disabled signup.');
}finally{
 child.kill('SIGTERM');await once(child,'exit');fixture.close();await once(fixture,'close');
}
