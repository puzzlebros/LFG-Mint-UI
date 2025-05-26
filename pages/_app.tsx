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
  WalletProvider,
  useWallet,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-wallets";
import {
  SolanaMobileWalletAdapter,
  createDefaultAddressSelector,
  type AuthorizationResultCache,
} from "@solana-mobile/wallet-adapter-mobile";

import { useMemo, useEffect } from "react";

import { UmiProvider } from "../utils/metaplex/UmiProvider";
import { SolanaTimeProvider } from "@/utils/metaplex/SolanaTimeContext";
import {
  ensureDappKeypair,
  decryptPhantomPayload,
} from "../utils/leaderboard/phantom";

// LocalStorage-based cache implementing AuthorizationResultCache
class LocalStorageCache implements AuthorizationResultCache {
  private readonly key = "solanaMobileAuth";

  // Return the cached authorization result (or undefined)
  async get() {
    const json = window.localStorage.getItem(this.key);
    if (!json) return undefined;
    try {
      return JSON.parse(json);
    } catch {
      return undefined;
    }
  }

  // Store the authorization result
  async set(authResult: any) {
    window.localStorage.setItem(this.key, JSON.stringify(authResult));
  }

  // Clear the cache
  async clear() {
    window.localStorage.removeItem(this.key);
  }
}

// RedirectHandler: catches Phantom deep-link callback
function RedirectHandler() {
  const { connect } = useWallet();

  useEffect(() => {
    const qs = new URLSearchParams(window.location.search);
    if (
      qs.has("data") &&
      qs.has("nonce") &&
      qs.has("phantom_encryption_public_key")
    ) {
      const payload = decryptPhantomPayload(
        qs.get("data")!,
        qs.get("nonce")!,
        qs.get("phantom_encryption_public_key")!
      );
      if (payload?.publicKey) {
        connect().catch(() => {});
      }
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [connect]);

  return null;
}

export default function MyApp({ Component, pageProps }: AppProps) {
  // Ensure Phantom DApp keypair for deep-link encryption
  useEffect(() => {
    ensureDappKeypair();
  }, []);

  // Choose network
  let network = WalletAdapterNetwork.Devnet;
  if (
    process.env.NEXT_PUBLIC_ENVIRONMENT === "mainnet-beta" ||
    process.env.NEXT_PUBLIC_ENVIRONMENT === "mainnet"
  ) {
    network = WalletAdapterNetwork.Mainnet;
  }

  // RPC endpoint
  const endpoint = process.env.NEXT_PUBLIC_RPC ?? "https://api.devnet.solana.com";

  // Detect Android + Chrome for Mobile Wallet Adapter
  const isAndroidChrome =
    typeof navigator !== "undefined" &&
    /Android/.test(navigator.userAgent) &&
    /Chrome/.test(navigator.userAgent);

  // Build wallet adapters array
  const wallets = useMemo<WalletAdapter[]>(() => {
    const adapters: WalletAdapter[] = [new PhantomWalletAdapter()];

    if (isAndroidChrome) {
      const cluster =
        network === WalletAdapterNetwork.Mainnet ? "mainnet-beta" : "devnet";

      adapters.push(
        new SolanaMobileWalletAdapter({
          addressSelector: createDefaultAddressSelector(),
          appIdentity: {
            name: "Let’s Flamingo",
            icon: "https://letsflamingo.gg/favicon.png",
          },
          authorizationResultCache: new LocalStorageCache(),
          onWalletNotFound: async () => {
            window.open("https://phantom.app/", "_blank");
          },
          // cluster is a string here
          cluster,
        })
      );
    }

    return adapters;
  }, [isAndroidChrome, network]);

  // Support per-page layouts
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
              <RedirectHandler />
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