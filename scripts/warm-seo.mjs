// Explicit GraphQL warm-up. Run with private env loaded; native rendering happens inside the CMS bridge.
const endpoint=process.env.WORDPRESS_GRAPHQL_URL;
if(!endpoint||!/^https:\/\/[^/]+\/graphql\/?$/.test(endpoint))throw new Error('Set HTTPS WORDPRESS_GRAPHQL_URL');
const headers={'Content-Type':'application/json',...(process.env.WPGRAPHQL_GATEWAY_TOKEN?{'X-ReadySpace-Read-Token':process.env.WPGRAPHQL_GATEWAY_TOKEN}:{})};
async function query(query,variables={}){
 const response=await fetch(endpoint,{method:'POST',headers,redirect:'error',signal:AbortSignal.timeout(20000),body:JSON.stringify({query,variables})});
 const result=await response.json();if(!response.ok||result.errors||!result.data)throw new Error('GraphQL warm-up failed');return result.data;
}
const paths=new Set(['/']);
for(const field of ['posts','pages','categories','tags']){
 let after=null;
 for(let batch=0;batch<10000;batch++){
  const content=['posts','pages'].includes(field),where=content?',where:{status:PUBLISH}':',where:{hideEmpty:true}';
  const data=await query(`query WarmInventory($after:String) { ${field}(first:100,after:$after${where}) { nodes {uri ${content?'isRestricted hasPassword':''}} pageInfo {hasNextPage endCursor} } }`,{after});
  for(const node of data[field].nodes)if(node.uri&&!node.isRestricted&&!node.hasPassword)paths.add(node.uri);
  if(!data[field].pageInfo.hasNextPage)break;
  if(!data[field].pageInfo.endCursor||data[field].pageInfo.endCursor===after)throw new Error('Invalid cursor');after=data[field].pageInfo.endCursor;
  if(batch===9999)throw new Error('Inventory exceeds warm capacity');
 }
}
// Optional audited URI paths include archive pagination, posts page and authors.
if(process.argv[2]){
 const {readFile}=await import('node:fs/promises');
 for(const row of JSON.parse(await readFile(process.argv[2],'utf8')))if(typeof row.path==='string')paths.add(row.path);
}
let ready=0;
for(const uri of paths){const data=await query('query WarmSeo($uri:String!) { readyspaceSeo(uri:$uri) {ready} }',{uri});if(data.readyspaceSeo?.ready)ready++;}
console.log(`${ready}/${paths.size} SEO snapshots ready. Revalidate frontend caches after warming.`);
if(ready!==paths.size)process.exitCode=1;
