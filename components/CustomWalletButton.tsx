// components/CustomWalletButton.tsx
import React, { useMemo } from "react";
import dynamic from "next/dynamic";
import { Button, ButtonProps, Tooltip, Text } from "@chakra-ui/react";
import { useWallet } from "@solana/wallet-adapter-react";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-wallets";
import { getDappPublicKey } from "@/utils/leaderboard/phantom";
import bs58 from "bs58";
import {
  SolanaMobileWalletAdapter,
  createDefaultAddressSelector,
  type AuthorizationResultCache
} from "@solana-mobile/wallet-adapter-mobile";

// localStorage cache for mobile adapter
class LocalStorageCache implements AuthorizationResultCache {
  private readonly key = "solanaMobileAuth";
  async get() { const json = localStorage.getItem(this.key); return json ? JSON.parse(json) : undefined; }
  async set(auth: any) { localStorage.setItem(this.key, JSON.stringify(auth)); }
  async clear() { localStorage.removeItem(this.key); }
}

export function CustomWalletButton(props: ButtonProps) {
  const { select, connected, connect, disconnect, publicKey } = useWallet();

  // Adapter names
  const phantomName = useMemo(() => new PhantomWalletAdapter().name, []);
  const mobileAdapterName = useMemo(
    () => new SolanaMobileWalletAdapter({
      addressSelector: createDefaultAddressSelector(),
      appIdentity: { name: 'DApp', icon: '' },
      authorizationResultCache: new LocalStorageCache(),
      onWalletNotFound: async (adapter) => {
        window.open('https://phantom.app/', '_blank');
      },
      cluster: 'mainnet-beta',
    }).name,
    []
  );

  const ua = typeof navigator === 'undefined' ? '' : navigator.userAgent;
  const isMobile = /Mobi|Android|iPhone|iPad|iPod/.test(ua);
  const isAndroidChrome = isMobile && /Android/.test(ua) && /Chrome/.test(ua);

  // Deep-link for mobile non-Chrome
  const handleDeepLink = () => {
    const dappP = bs58.encode(getDappPublicKey());
    const redirect = encodeURIComponent(window.location.href);
    const qs = new URLSearchParams({
      dapp_encryption_public_key: dappP,
      redirect_link:              redirect,
      cluster:                    'mainnet-beta',
      app_url:                    window.location.origin,
    });
    window.location.href = `https://phantom.app/ul/v1/connect?${qs}`;
  };

  // Unified connect handler
  const handleLogin = async () => {
    try {
      // Ensure any previous session is cleared
      await disconnect();
      // Trigger adapter connect (Phantom or Mobile)
      await connect();
    } catch (err) {
      console.error('Connect error', err);
    }
  };

  if (!connected) {
    if (isMobile && !isAndroidChrome) {
      return (
        <Button {...props} className="wallet-adapter-button-trigger" onClick={handleDeepLink}>
          LOG IN
        </Button>
      );
    }
    return (
      <Button {...props} className="wallet-adapter-button-trigger" onClick={handleLogin}>
        LOG IN
      </Button>
    );
  }

  const logoutBtn = (
    <Button
      {...props}
      className="wallet-adapter-button-trigger-secondary"
      onClick={() => disconnect()}
    >
      {publicKey?.toBase58().slice(0,4)}…{publicKey?.toBase58().slice(-4)}
    </Button>
  );

  if (isMobile) {
    return (
      <>
        {logoutBtn}
        <Text fontSize="xs" color="gray.500" mt={1} textAlign="center">
          Tap to log out
        </Text>
      </>
    );
  }

  return (
    <Tooltip label="Click to log out" shouldWrapChildren>
      {logoutBtn}
    </Tooltip>
  );
}
