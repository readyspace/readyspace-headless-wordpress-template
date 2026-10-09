import { readFile, writeFile } from 'node:fs/promises';
const [origin,register,output]=process.argv.slice(2);
if(!origin||!register||!output) throw new Error('Usage: npm run audit:urls -- https://staging.example.com audited-register.json result.json');
const target=new URL(origin);
if(!['https:','http:'].includes(target.protocol)||target.username||target.password||target.pathname!=='/'||target.search||target.hash) throw new Error('Use a plain deployment origin');
const rows=JSON.parse(await readFile(register,'utf8'));
if(!Array.isArray(rows)||rows.length>100000) throw new Error('Invalid URL register');
const result=[];
for(const row of rows) {
  if(typeof row.path!=='string'||!row.path.startsWith('/')||row.path.startsWith('//')||/[\\?#\s]/.test(row.path)||decodeURIComponent(row.path).split('/').includes('..')) throw new Error('Register requires local paths');
  const url=new URL(row.path,target);
  if(url.origin!==target.origin) throw new Error('Cross-origin URL rejected');
  try {
    const response=await fetch(url,{redirect:'manual',signal:AbortSignal.timeout(15000)});
    const html=response.headers.get('content-type')?.includes('text/html')?await response.text():'';
    const canonicalTag=html.match(/<link\b[^>]*rel=["']canonical["'][^>]*>/i)?.[0];
    const canonical=canonicalTag?.match(/href=["']([^"']+)["']/i)?.[1]||null;
    const canonicalPath=canonical?new URL(canonical,url).pathname:null;
    result.push({path:row.path,status:response.status,canonical,location:response.headers.get('location'),pass:response.status===row.status&&(!row.canonical||canonicalPath===row.canonical)});
  } catch { result.push({path:row.path,pass:false,error:'Request failed'}); }
}
await writeFile(output,JSON.stringify(result,null,2)+'\n');
console.log(`${result.filter(row=>row.pass).length}/${result.length} URL checks passed`);
if(result.some(row=>!row.pass)) process.exitCode=1;
