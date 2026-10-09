import 'server-only';
import { siteConfig } from './config';
export const CONTENT_TAG = 'wordpress-public';
export async function graphql<T>(query:string, variables:Record<string,unknown> = {}, preview = false, freshPublic = false):Promise<T> {
  const config = siteConfig();
  if (!config.endpoint) throw new Error('Configure WORDPRESS_GRAPHQL_URL');
  const headers:Record<string,string> = {'Content-Type':'application/json', Accept:'application/json'};
  if (process.env.WPGRAPHQL_GATEWAY_TOKEN) headers['X-ReadySpace-Read-Token'] = process.env.WPGRAPHQL_GATEWAY_TOKEN;
  if (preview) {
    if (!process.env.WPGRAPHQL_PREVIEW_USER || !process.env.WPGRAPHQL_PREVIEW_PASSWORD) throw new Error('Preview credentials unavailable');
    headers.Authorization = 'Basic ' + Buffer.from(`${process.env.WPGRAPHQL_PREVIEW_USER}:${process.env.WPGRAPHQL_PREVIEW_PASSWORD}`).toString('base64');
  }
  const response = await fetch(config.endpoint, {
    method:'POST', headers, body:JSON.stringify({query,variables}), redirect:'error',
    signal:AbortSignal.timeout(10000),
    ...(preview || freshPublic ? {cache:'no-store' as const} : {cache:'force-cache' as const,next:{revalidate:config.revalidateSeconds,tags:[CONTENT_TAG]}}),
  });
  if (!response.ok) throw new Error('WPGraphQL transport unavailable');
  const result = await response.json() as {data?:T;errors?:unknown[]};
  if (result.errors?.length || !result.data) throw new Error('WPGraphQL schema/query failed; run npm run check:cms');
  return result.data;
}
