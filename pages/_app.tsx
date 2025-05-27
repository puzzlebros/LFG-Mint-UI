// pages/_app.tsx
import Head from "next/head";
import type { AppProps } from "next/app";
import { Analytics } from "@vercel/analytics/next";
import { image, headerText } from "@/settings";
import { ChakraProvider } from "@chakra-ui/react";
import { ParallaxProvider } from "react-scroll-parallax";
import Layout from "../components/Layout";
import "@solana/wallet-adapter-react-ui/styles.css";
import theme from "@/styles/theme";

import type { WalletAdapter } from "@solana/wallet-adapter-base";
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import {
  ConnectionProvider,
  WalletProvider
} from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-wallets";

import { useMemo, useEffect } from "react";

import { UmiProvider } from "../utils/metaplex/UmiProvider";
import { SolanaTimeProvider } from "@/utils/metaplex/SolanaTimeContext";

export default function MyApp({ Component, pageProps }: AppProps) {
  // pick network
  let network = WalletAdapterNetwork.Devnet;
  if (
    process.env.NEXT_PUBLIC_ENVIRONMENT === "mainnet-beta" ||
    process.env.NEXT_PUBLIC_ENVIRONMENT === "mainnet"
  ) {
    network = WalletAdapterNetwork.Mainnet;
  }

  // RPC endpoint
  const endpoint =
    process.env.NEXT_PUBLIC_RPC ?? "https://api.devnet.solana.com";

  // only Phantom adapter everywhere
  const wallets = useMemo<WalletAdapter[]>(
    () => [new PhantomWalletAdapter()],
    [network]
  );

  // support per-page layouts
  const getLayout =
    (Component as any).getLayout ||
    ((page: React.ReactNode) => <Layout>{page}</Layout>);

  return (
    <>
      <Head>
        <meta property="og:type" content="website" />
        <meta property="og:title" content={headerText} />
        <meta property="og:description" content="LFG" />
        <meta property="og:image" content={image} />
        <meta name="description" content="LFG" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{headerText}</title>
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <ParallaxProvider>
        <ChakraProvider theme={theme}>
          <ConnectionProvider endpoint={endpoint}>
            <WalletProvider wallets={wallets} autoConnect>
              <WalletModalProvider>
                <UmiProvider endpoint={endpoint}>
                  <SolanaTimeProvider>
                    {getLayout(<Component {...pageProps} />)}
                  </SolanaTimeProvider>
                </UmiProvider>
              </WalletModalProvider>
            </WalletProvider>
          </ConnectionProvider>
        </ChakraProvider>
      </ParallaxProvider>
      <Analytics />
    </>
  );
}
