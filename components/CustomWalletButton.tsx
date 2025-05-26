// components/CustomWalletButton.tsx
// …other imports…
import React, { useMemo } from "react";
import { Button, ButtonProps, Tooltip, Text } from "@chakra-ui/react";
import { useWallet } from "@solana/wallet-adapter-react";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-wallets";
import { getDappPublicKey } from "@/utils/leaderboard/phantom";
import bs58 from "bs58";

export function CustomWalletButton(props: ButtonProps) {
  const { select, connected, connect, disconnect, publicKey } = useWallet();
  const phantomName = useMemo(() => new PhantomWalletAdapter().name, []);

  const ua = typeof navigator === "undefined" ? "" : navigator.userAgent;
  const isMobile        = /Mobi|Android|iPhone|iPad|iPod/.test(ua);
  const isAndroidChrome = isMobile && /Android/.test(ua) && /Chrome/.test(ua);
  const isDeepLinkDevice = isMobile && !isAndroidChrome;

  const buildPhantomLink = (useScheme: boolean) => {
    const dappP    = bs58.encode(getDappPublicKey());
    const redirect = encodeURIComponent(window.location.href);
    const qs       = new URLSearchParams({
      dapp_encryption_public_key: dappP,
      redirect_link:              redirect,
      cluster:                    "mainnet-beta",
      app_url:                    window.location.origin,
    }).toString();

    return useScheme
      ? `phantom://1/connect?${qs}`
      : `https://phantom.app/ul/1/connect?${qs}`;
  };

  const openLink = (url: string) => {
    const a = document.createElement("a");
    a.setAttribute("href", url);
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleDeepLink = () => {
    // 1️⃣ Try the custom-scheme first (works in Chrome/Firefox on iOS)
    openLink(buildPhantomLink(true));
    // 2️⃣ Fallback to universal link shortly after (covers Safari & others)
    setTimeout(() => openLink(buildPhantomLink(false)), 500);
  };

  const handleLogin = async () => {
    try {
      await select(phantomName);
      await connect();
    } catch (err) {
      console.error("Connect error", err);
    }
  };

  // — Not connected? LOG IN —
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
    return (
      <Button
        {...props}
        className="wallet-adapter-button-trigger"
        style={{ display: "flex", justifyContent: "center", alignItems: "center" }}
        onClick={handleLogin}
      >
        LOG IN
      </Button>
    );
  }

  // — Connected? Show address + log out —
  const logoutBtn = (
    <Button
      {...props}
      className="wallet-adapter-button-trigger-secondary"
      style={{ display: "flex", justifyContent: "center", alignItems: "center" }}
      onClick={() => disconnect()}
    >
      {publicKey?.toBase58().slice(0, 4)}…{publicKey?.toBase58().slice(-4)}
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
  return <Tooltip label="Click to log out">{logoutBtn}</Tooltip>;
}
