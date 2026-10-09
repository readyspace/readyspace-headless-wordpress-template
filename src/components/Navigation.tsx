import { siteConfig } from '@/lib/config';
import { publicUrl } from '@/lib/paths';
import { plainText } from '@/lib/html';
type Item={id:string;label:string;url:string;parentId:string|null};
export default function Navigation({items}:{items:Item[]}) {
  const config=siteConfig(),ids=new Set(items.map(item=>item.id));
  function list(parent:string|null,ancestors:Set<string>):React.ReactNode {
    if(ancestors.size>10) throw new Error('Menu hierarchy exceeds supported depth');
    const children=items.filter(item=>parent===null ? !item.parentId||!ids.has(item.parentId) : item.parentId===parent);
    if(!children.length)return null;
    return <ul>{children.map(item=>{
      if(ancestors.has(item.id))throw new Error('Menu hierarchy contains a cycle');
      let href:string;try{href=publicUrl(item.url,config.siteUrl,config.cmsOrigin);}catch{return null;}
      return <li key={item.id}><a href={href}>{plainText(item.label)}</a>{list(item.id,new Set([...ancestors,item.id]))}</li>;
    })}</ul>;
  }
  return <nav aria-label="Main navigation">{list(null,new Set())}</nav>;
}
