export function safePath(value: string): string {
  if (!value.startsWith('/') || value.startsWith('//') || /[\\\u0000-\u0020?#]/.test(value)) throw new Error('Invalid path');
  const decoded = decodeURIComponent(value);
  if (/[\\\u0000-\u001f?#]/.test(decoded) || decoded.startsWith('//') || decoded.split('/').some(part => part === '.' || part === '..')) throw new Error('Invalid path');
  return value;
}
export function routePath(segments: string[] = []) {
  return safePath('/' + segments.map(segment => encodeURIComponent(segment)).join('/'));
}
export function archivePath(path: string): {uri:string;page:number} {
  const match = /^(.*)\/page\/([1-9]\d*)\/?$/.exec(path);
  return match ? {uri: match[1] ? `${match[1]}/` : '/', page: Number(match[2])} : {uri: path, page:1};
}
export function publicUrl(value: string, siteUrl: string, cmsOrigin: string): string {
  const url = new URL(value, siteUrl);
  if (!['http:', 'https:', 'mailto:', 'tel:'].includes(url.protocol) || url.username || url.password) throw new Error('Unsafe public URL');
  // CMS media remains served by WordPress. Only page identity URLs move to the frontend.
  if (url.origin === cmsOrigin && !isMediaPath(url.pathname)) return new URL(url.pathname + url.search + url.hash, siteUrl).href;
  return url.href;
}

export function isMediaPath(path: string): boolean {
  return /^\/(?:wp-content|wp-includes)\//i.test(path) ||
    /\.(?:avif|bmp|gif|heic|ico|jpe?g|png|svg|tiff?|webp|pdf|docx?|xlsx?|pptx?|zip|mp[34]|m4[av]|mov|ogg|wav|webm|woff2?|ttf|css|js)(?:$)/i.test(path);
}
