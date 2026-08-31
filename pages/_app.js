import { useRouter } from "next/router";
import { FaustProvider } from "@faustwp/core";
import {
  GoogleAnalytics,
  GoogleSiteVerification,
  GoogleTagManager,
} from "../components/GoogleIntegrations";
import RankMathHead from "../components/RankMathHead";
import "../faust.config";

export default function App({ Component, pageProps }) {
  const router = useRouter();

  return (
    <FaustProvider pageProps={pageProps}>
      <GoogleSiteVerification />
      <RankMathHead markup={pageProps.rankMathHead} />
      <GoogleTagManager />
      <GoogleAnalytics />
      <Component {...pageProps} key={router.asPath} />
    </FaustProvider>
  );
}
