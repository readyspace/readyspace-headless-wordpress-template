import type {Metadata} from 'next';
import { siteConfig } from '@/lib/config';
import { navigation } from '@/lib/content';
import OptionalIntegrations from '@/components/OptionalIntegrations';
import Navigation from '@/components/Navigation';
import './globals.css';
export function generateMetadata():Metadata {
  const config=siteConfig();
  return {metadataBase:new URL(config.siteUrl),verification:{google:process.env.GOOGLE_SITE_VERIFICATION||undefined,other:process.env.BING_SITE_VERIFICATION?{'msvalidate.01':process.env.BING_SITE_VERIFICATION}:{} }};
}
export default async function Layout({children}:{children:React.ReactNode}) {
  const config=siteConfig(),menu=await navigation();
  return <html lang={config.locale}><body><a className="skip-link" href="#main">Skip to content</a>
    <header><a className="brand" href="/">{config.name}</a><Navigation items={menu} /></header>
    <main id="main">{children}</main><footer><p>{config.name}</p></footer>
    <OptionalIntegrations ga4Id={config.environment==='production'?process.env.NEXT_PUBLIC_GA4_ID:undefined} gtmId={config.environment==='production'?process.env.NEXT_PUBLIC_GTM_ID:undefined} mapsEmbedUrl={process.env.NEXT_PUBLIC_MAPS_EMBED_URL} googleReviewUrl={process.env.NEXT_PUBLIC_GOOGLE_REVIEW_URL}/>
  </body></html>;
}
