// components/CustomWalletButton.tsx
import React from "react";
import dynamic from "next/dynamic";
import { Button, ButtonProps, Tooltip, Text } from "@chakra-ui/react";
import { useWallet } from "@solana/wallet-adapter-react";
import { getDappPublicKey } from "@/utils/leaderboard/phantom";
import bs58 from "bs58";

// Dynamically load the standard multi-wallet button for desktop and Android Chrome
const WalletMultiButtonDynamic = dynamic(
  () => import("@solana/wallet-adapter-react-ui").then((mod) => mod.WalletMultiButton),
  { ssr: false }
);

export function CustomWalletButton(props: ButtonProps) {
  const { connected, connect, disconnect, publicKey } = useWallet();

  const ua = typeof navigator === "undefined" ? "" : navigator.userAgent;
  const isMobile = /Mobi|Android|iPhone|iPad|iPod/.test(ua);
  const isAndroidChrome = isMobile && /Android/.test(ua) && /Chrome/.test(ua);
  const isDeepLinkDevice = isMobile && !isAndroidChrome;

  // Deep-link into Phantom on mobile non-Chrome
  const handleDeepLink = () => {
    const dappP = bs58.encode(getDappPublicKey());
    const redirect = encodeURIComponent(window.location.href);
    const qs = new URLSearchParams({
      dapp_encryption_public_key: dappP,
      redirect_link:              redirect,
      cluster:                    "mainnet-beta",
      app_url:                    window.location.origin,
    }).toString();
    // Use universal link for most, custom scheme for iOS Chrome
    const isIOS = /iPhone|iPad|iPod/.test(ua);
    const isSafari = /Safari/.test(ua) && !/CriOS/.test(ua);
    const deepLinkUrl = isIOS && !isSafari
      ? `phantom://ul/v1/connect?${qs}`
      : `https://phantom.app/ul/v1/connect?${qs}`;
    window.location.href = deepLinkUrl;
  };

  // Not connected: show login UI
  if (!connected) {
    if (isDeepLinkDevice) {
      return (
        <Button
          {...props}
          className="wallet-adapter-button-trigger"
          style={{ display: "flex", justifyContent: "center", alignItems: "center" }}
          onClick={handleDeepLink}
        >
          LOG IN
        </Button>
      );
    }
    // Desktop & Android Chrome: use built-in multi-wallet button
    return (
      <WalletMultiButtonDynamic
        {...props}
        className="wallet-adapter-button-trigger"
        style={{ display: "flex", justifyContent: "center", alignItems: "center" }}
      >
        LOG IN
      </WalletMultiButtonDynamic>
    );
  }

  // Connected: truncate address and show logout
  const logoutButton = (
    <Button
      {...props}
      className="wallet-adapter-button-trigger-secondary"
      onClick={() => disconnect()}
    >
      {publicKey?.toBase58().slice(0, 4)}…{publicKey?.toBase58().slice(-4)}
    </Button>
  );

  if (isMobile) {
    return (
      <>
        {logoutButton}
        <Text fontSize="xs" color="gray.500" mt={1} textAlign="center">
          Tap to log out
        </Text>
      </>
    );
  }

  return (
    <Tooltip label="Click to log out" shouldWrapChildren>
      {logoutButton}
    </Tooltip>
  );
}
