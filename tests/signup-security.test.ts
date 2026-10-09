import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanHtml, plainText, serializeSchema } from '../src/lib/html';
import { publicUrl, safePath } from '../src/lib/paths';

const publicOrigin='https://site.example',cms='https://cms.site.example';
test('public navigation rejects executable URL schemes and rewrites only CMS page URLs',()=>{
  for(const value of ['javascript:alert(1)','data:text/html,test','file:///private/file','https://user:pass@site.example/']) {
    assert.throws(()=>publicUrl(value,publicOrigin,cms));
  }
  assert.equal(publicUrl(`${cms}/article/?view=full#section`,publicOrigin,cms),`${publicOrigin}/article/?view=full#section`);
  assert.equal(publicUrl(`${cms}/wp-content/uploads/photo.webp`,publicOrigin,cms),`${cms}/wp-content/uploads/photo.webp`);
  assert.equal(publicUrl('mailto:hello@example.com',publicOrigin,cms),'mailto:hello@example.com');
});
test('HTML preserves CMS media and removes active content while remapping article links',()=>{
  const html=cleanHtml(`<script>alert(1)</script><img src="/wp-content/uploads/a.webp" onerror="alert(1)"><a href="${cms}/guide/" target="_blank">Guide</a>`,publicOrigin,cms);
  assert.ok(!html.includes('script')&&!html.includes('onerror'));
  assert.ok(html.includes(`src="${cms}/wp-content/uploads/a.webp"`));
  assert.ok(html.includes(`href="${publicOrigin}/guide/"`));
  assert.ok(html.includes('noopener noreferrer'));
});
test('plain text decodes entities once for React titles without restoring executable markup',()=>{
  assert.equal(plainText('<b>Research &amp; development &#8212; caf&eacute;</b>'),'Research & development — café');
  assert.equal(plainText('<script>secret</script>Safe'),'Safe');
});
test('JSON-LD rewrites identities but retains CMS image/audio/binary URLs and escapes script boundaries',()=>{
  const schema=serializeSchema(JSON.stringify({ '@context':'https://schema.org', '@graph':[
    { '@type':'WebPage','@id':`${cms}/guide/#webpage`,url:`${cms}/guide/`,image:`${cms}/image-resource/`,name:'</script><script>alert(1)</script>' },
    { '@type':'ImageObject','@id':`${cms}/guide/#primaryimage`,url:`${cms}/image-resource/`,contentUrl:`${cms}/wp-content/uploads/photo.webp` },
  ] }),publicOrigin,cms);
  assert.ok(schema&&!schema.includes('</script>'));
  const graph=JSON.parse(schema!)['@graph'];
  assert.equal(graph[0]['@id'],`${publicOrigin}/guide/#webpage`);
  assert.equal(graph[0].url,`${publicOrigin}/guide/`);
  assert.equal(graph[0].image,`${cms}/image-resource/`);
  assert.equal(graph[1]['@id'],`${publicOrigin}/guide/#primaryimage`);
  assert.equal(graph[1].url,`${cms}/image-resource/`);
  assert.equal(graph[1].contentUrl,`${cms}/wp-content/uploads/photo.webp`);
});
test('oversized and deeply nested schema fails closed and preview paths cannot escape the origin',()=>{
  assert.equal(serializeSchema('x'.repeat(1_000_001),publicOrigin,cms),null);
  let nested:unknown={};for(let index=0;index<45;index++) nested={nested};
  assert.equal(serializeSchema(JSON.stringify(nested),publicOrigin,cms),null);
  for(const path of ['//attacker.example/','/%2f%2fattacker.example/','/x/../private','/x/%0a']) assert.throws(()=>safePath(path));
});
