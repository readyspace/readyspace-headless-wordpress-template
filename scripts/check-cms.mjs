// Read-only GraphQL readiness check. Load private env via node --env-file=.env.local.
const endpoint=process.env.WORDPRESS_GRAPHQL_URL;
if(!endpoint || !/^https:\/\/[^/]+\/graphql\/?$/.test(endpoint)) throw new Error('Set HTTPS WORDPRESS_GRAPHQL_URL');
const response=await fetch(endpoint,{method:'POST',redirect:'error',signal:AbortSignal.timeout(10000),headers:{'Content-Type':'application/json',...(process.env.WPGRAPHQL_GATEWAY_TOKEN?{'X-ReadySpace-Read-Token':process.env.WPGRAPHQL_GATEWAY_TOKEN}:{})},body:JSON.stringify({query:`query ReadySpaceCheck { readyspaceFrontPageSeo { ready generatedAt title canonical robots } nodeByUri(uri:"/") { __typename } posts(first:1,where:{status:PUBLISH}) { nodes { uri isRestricted readyspaceSeo { ready } } } menuItems(first:1) { nodes { id } } }`})});
const data=await response.json();
if(!response.ok || data.errors || !data.data?.readyspaceFrontPageSeo?.ready) throw new Error('CMS schema or SEO snapshot not ready; see docs/wordpress.md');
console.log('WPGraphQL schema and front page SEO snapshot ready. No credentials or CMS content printed.');
