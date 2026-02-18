// pages/_app.tsx
import Head from "next/head";
import type { AppProps } from "next/app";
import { Analytics } from "@vercel/analytics/next";
import { image, headerText, description } from "@/settings";
import { ChakraProvider } from "@chakra-ui/react";
import { ParallaxProvider } from "react-scroll-parallax";
import Layout from "../components/Layout";
import "@solana/wallet-adapter-react-ui/styles.css";
import theme from "@/styles/theme";

import type { WalletAdapter } from "@solana/wallet-adapter-base";
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";

import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
  CoinbaseWalletAdapter,
  LedgerWalletAdapter,
  // Keep adding ONLY adapters that your installed version actually exports.
} from "@solana/wallet-adapter-wallets";

import {
  SolanaMobileWalletAdapter,
  createDefaultAddressSelector,
  createDefaultAuthorizationResultCache,
  createDefaultWalletNotFoundHandler,
} from "@solana-mobile/wallet-adapter-mobile";

import { useMemo } from "react";

import { UmiProvider } from "../utils/metaplex/UmiProvider";
import { SolanaTimeProvider } from "@/utils/metaplex/SolanaTimeContext";
import { LeaderboardProvider } from "../components/LeaderboardContext";

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
  const endpoint = process.env.NEXT_PUBLIC_RPC ?? "https://api.devnet.solana.com";

  // For mobile adapter config
  const cluster =
    network === WalletAdapterNetwork.Mainnet ? "mainnet-beta" : "devnet";

  // Use a real app URL (recommended). Falls back safely.
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    (typeof window !== "undefined" ? window.location.origin : "https://example.com");

  const wallets = useMemo<WalletAdapter[]>(() => {
    // prevent SSR crashes (wallets touch `window`)
    if (typeof window === "undefined") return [];

    const list: WalletAdapter[] = [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter({ network }),
      new CoinbaseWalletAdapter(),
      new LedgerWalletAdapter(),
    ];

    // Mobile Wallet Adapter (MWA)
    list.push(
      new SolanaMobileWalletAdapter({
        addressSelector: createDefaultAddressSelector(),
        authorizationResultCache: createDefaultAuthorizationResultCache(),
        cluster,
        appIdentity: {
          name: headerText ?? "LFG",
          uri: appUrl,
          icon: `${appUrl}/apple-touch-icon.png`,
        },
        onWalletNotFound: createDefaultWalletNotFoundHandler(),
      })
    );

    return list;
  }, [network, cluster, appUrl]);

  const getLayout =
    (Component as any).getLayout ||
    ((page: React.ReactNode) => <Layout>{page}</Layout>);

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
              <WalletModalProvider>
                <LeaderboardProvider>
                  <UmiProvider endpoint={endpoint}>
                    <SolanaTimeProvider>
                      {getLayout(<Component {...pageProps} />)}
                    </SolanaTimeProvider>
                  </UmiProvider>
                </LeaderboardProvider>
              </WalletModalProvider>
            </WalletProvider>
          </ConnectionProvider>
        </ChakraProvider>
      </ParallaxProvider>
      <Analytics />
    </>
  );
}
