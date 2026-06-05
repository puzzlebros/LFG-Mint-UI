// pages/_app.tsx
import Head from "next/head";
import type { AppProps } from "next/app";
import type { ReactNode } from "react";
import { useEffect, useMemo } from "react";

import { Analytics } from "@vercel/analytics/next";
import { ChakraProvider } from "@chakra-ui/react";
import { ParallaxProvider } from "react-scroll-parallax";

import "@solana/wallet-adapter-react-ui/styles.css";
import "@/styles/wallet.css";

import type { Adapter } from "@solana/wallet-adapter-base";
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { FilteredWalletModalProvider } from "../components/FilteredWalletModalProvider";

import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import { SolflareWalletAdapter } from "@solana/wallet-adapter-solflare";

import { image, headerText, description } from "@/settings";
import theme from "@/styles/theme";
import Layout from "../components/Layout";
import { UmiProvider } from "../utils/metaplex/UmiProvider";
import { SolanaTimeProvider } from "@/utils/metaplex/SolanaTimeContext";
import { LeaderboardProvider } from "../components/LeaderboardContext";

export default function MyApp({ Component, pageProps }: AppProps) {
  const network =
    process.env.NEXT_PUBLIC_ENVIRONMENT === "mainnet-beta" ||
    process.env.NEXT_PUBLIC_ENVIRONMENT === "mainnet"
      ? WalletAdapterNetwork.Mainnet
      : WalletAdapterNetwork.Devnet;

  const endpoint =
    process.env.NEXT_PUBLIC_RPC || "https://api.devnet.solana.com";

  const wallets = useMemo<Adapter[]>(() => {
    if (typeof window === "undefined") return [];

    return [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter({ network }),
    ];
  }, [network]);

  const getLayout =
    (Component as { getLayout?: (page: ReactNode) => ReactNode }).getLayout ??
    ((page: ReactNode) => <Layout>{page}</Layout>);

  return (
    <>
      <Head>
        <meta property="og:type" content="website" />
        <meta property="og:title" content={headerText} />
        <meta property="og:description" content={description} />
        <meta property="og:image" content={image} />
        <meta name="description" content="LFG" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{headerText}</title>

        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link rel="icon" type="image/png" href="/favicon-96x96.png" sizes="96x96" />
        <link rel="shortcut icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <meta name="apple-mobile-web-app-title" content="LFG" />
        <link rel="manifest" href="/site.webmanifest" />
      </Head>

      <ParallaxProvider>
        <ChakraProvider theme={theme}>
          <ConnectionProvider endpoint={endpoint}>
            <WalletProvider wallets={wallets} autoConnect>
              <FilteredWalletModalProvider>
                <LeaderboardProvider>
                  <UmiProvider endpoint={endpoint}>
                    <SolanaTimeProvider>
                      {getLayout(<Component {...pageProps} />)}
                    </SolanaTimeProvider>
                  </UmiProvider>
                </LeaderboardProvider>
              </FilteredWalletModalProvider>
            </WalletProvider>
          </ConnectionProvider>
        </ChakraProvider>
      </ParallaxProvider>

      <Analytics />
    </>
  );
}