// pages/_app.tsx
import Head from "next/head";
import type { AppProps } from "next/app";
import { image, headerText } from "@/settings";
import { ChakraProvider } from "@chakra-ui/react";
import { ParallaxProvider } from "react-scroll-parallax";
import Layout from "../components/Layout";
import "@solana/wallet-adapter-react-ui/styles.css";
import theme from "@/styles/theme";

import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-wallets";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { useMemo } from "react";

import { UmiProvider } from "../utils/metaplex/UmiProvider";
import { SolanaTimeProvider } from "@/utils/metaplex/SolanaTimeContext";

function MyApp({ Component, pageProps }: AppProps) {
  // Set the network based on an environment variable.
  let network = WalletAdapterNetwork.Devnet;
  if (
    process.env.NEXT_PUBLIC_ENVIRONMENT === "mainnet-beta" ||
    process.env.NEXT_PUBLIC_ENVIRONMENT === "mainnet"
  ) {
    network = WalletAdapterNetwork.Mainnet;
  }

  // Use the provided RPC endpoint or default to devnet.
  let endpoint = "https://api.devnet.solana.com";
  if (process.env.NEXT_PUBLIC_RPC) {
    endpoint = process.env.NEXT_PUBLIC_RPC;
  }

  // Configure the Phantom wallet and enable autoConnect.
  const wallets = useMemo(() => [new PhantomWalletAdapter()], [network]);

  // Use a custom layout if the page provides one; otherwise, wrap in the default Layout.
  const getLayout = (Component as any).getLayout || ((page: React.ReactNode) => <Layout>{page}</Layout>);

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
                {/* Pass endpoint to the UmiProvider */}
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
    </>
  );
}

export default MyApp;
