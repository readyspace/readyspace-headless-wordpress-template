import { createHmac, timingSafeEqual } from 'node:crypto';
import { safePath } from './paths';
function sameHex(actual:string, expected:string) {
  return /^[a-f0-9]{64}$/.test(actual) && timingSafeEqual(Buffer.from(actual,'hex'),Buffer.from(expected,'hex'));
}
export function verifyWebhook(body:string, timestamp:string, signature:string, secret:string, now=Date.now()) {
  if (secret.length<32 || !/^\d{10}$/.test(timestamp) || Math.abs(now/1000-Number(timestamp))>300) return false;
  return sameHex(signature,createHmac('sha256',secret).update(`${timestamp}.${body}`).digest('hex'));
}
export interface PreviewClaims { id:number; path:string; exp:number }
export async function boundedBody(request:Request, limit=8192):Promise<string> {
  const declared=Number(request.headers.get('content-length')||0);
  if(!Number.isFinite(declared)||declared>limit) throw new Error('Body too large');
  const reader=request.body?.getReader();
  if(!reader) return '';
  const chunks:Uint8Array[]=[];let size=0;
  try {
    for (;;) {
      const {value,done}=await reader.read();if(done)break;
      size+=value.byteLength;
      if(size>limit){await reader.cancel();throw new Error('Body too large');}
      chunks.push(value);
    }
    return Buffer.concat(chunks).toString('utf8');
  } finally{reader.releaseLock();}
}
export function verifyPreview(token:string, secret:string, now=Date.now()):PreviewClaims|null {
  if(secret.length<32 || token.length>2048) return null;
  const parts=token.split('.');
  if(parts.length!==2 || !/^[A-Za-z0-9_-]+$/.test(parts[0])) return null;
  if(!sameHex(parts[1],createHmac('sha256',secret).update(parts[0]).digest('hex'))) return null;
  try {
    const claims=JSON.parse(Buffer.from(parts[0],'base64url').toString()) as PreviewClaims;
    if (!Number.isSafeInteger(claims.id) || claims.id<1 || !Number.isSafeInteger(claims.exp) || claims.exp<now/1000 || claims.exp>now/1000+300) return null;
    safePath(claims.path); return claims;
  } catch { return null; }
}
