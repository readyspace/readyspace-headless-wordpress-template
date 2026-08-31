import { Head, Html, Main, NextScript } from "next/document";
import { GoogleTagManagerNoScript } from "../components/GoogleIntegrations";

export default function Document() {
  return (
    <Html lang="en">
      <Head />
      <body>
        <GoogleTagManagerNoScript />
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
