// pages/_document.tsx
import { Html, Head, Main, NextScript } from 'next/document'

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        {/* your other fonts, meta tags, etc. */}
        <link rel="stylesheet" href="https://use.typekit.net/wul4mrm.css" />

        {/* ——— Unity WebGL Preloads (raw only) ——— */}
      <link rel="preload" href="/UnityBuild/Build/Jumper.loader.js" as="script" />

      <link
        rel="preload"
        href="/UnityBuild/Build/Jumper.framework.js.br"
        as="fetch"
        crossOrigin="anonymous"
      />

      <link
        rel="preload"
        href="/UnityBuild/Build/Jumper.wasm.br"
        as="fetch"
        type="application/wasm"
        crossOrigin="anonymous"
      />

      <link
        rel="preload"
        href="/UnityBuild/Build/Jumper.data.br"
        as="fetch"
        type="application/octet-stream"
        crossOrigin="anonymous"
      />
        {/* ————————————— end Unity Preloads ————————————— */}
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}
