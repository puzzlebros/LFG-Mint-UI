// components/CustomWalletButton.tsx
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
  const isMobile = /Mobi|Android|iPhone|iPad|iPod/.test(ua);
  const isAndroidChrome = isMobile && /Android/.test(ua) && /Chrome/.test(ua);
  const isDeepLinkDevice = isMobile && !isAndroidChrome;

  // Build both scheme and universal URLs, log them
  const buildLink = (useScheme: boolean) => {
    const dappP = bs58.encode(getDappPublicKey());
    const redirect = encodeURIComponent(window.location.href);
    const qs = new URLSearchParams({
      dapp_encryption_public_key: dappP,
      redirect_link:              redirect,
      cluster:                    "mainnet-beta",
      app_url:                    window.location.origin,
    }).toString();
    const schemeURL = `phantom://1/connect?${qs}`;
    const universalURL = `https://phantom.app/ul/1/connect?${qs}`;
    console.log("[DL] buildLink: schemeURL, universalURL", { schemeURL, universalURL });
    return useScheme ? schemeURL : universalURL;
  };

  // Anchor click hack to force navigation in WKWebView
  const openViaAnchor = (url: string) => {
    console.log("[DL] openViaAnchor", url);
    const a = document.createElement("a");
    a.href = url;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Deep-link flow for mobile non-Chrome
  const handleDeepLink = () => {
    console.log("[DL] handleDeepLink start");
    const dappP = bs58.encode(getDappPublicKey());
    const redirect = encodeURIComponent(window.location.href);
    const qs = new URLSearchParams({
      dapp_encryption_public_key: dappP,
      redirect_link:              redirect,
      cluster:                    "mainnet-beta",
      app_url:                    window.location.origin,
    }).toString();

    const schemeURL = `phantom://1/connect?${qs}`;
    const universalURL = `https://phantom.app/ul/1/connect?${qs}`;
    console.log("[DL] schemeURL, universalURL", { schemeURL, universalURL });

    // On iOS Safari, use universal link
    const isIOS = /iPhone|iPad|iPod/.test(ua);
    const isSafari = isIOS && /Safari/.test(ua) && !/CriOS/.test(ua);
    if (isSafari) {
      console.log("[DL] opening universal link");
      openViaAnchor(universalURL);
    } else {
      console.log("[DL] opening custom scheme");
      openViaAnchor(schemeURL);
    }
  };

  // Standard desktop/Android-Chrome login
  const handleLogin = async () => {
    console.log("[DL] handleLogin start");
    try {
      await select(phantomName);
      console.log("[DL] select done", phantomName);
      await connect();
      console.log("[DL] connect success");
    } catch (err) {
      console.error("[DL] connect error", err);
    }
  };

  // Not connected: show LOG IN
  if (!connected) {
    console.log("[DL] rendering login, isDeepLinkDevice=", isDeepLinkDevice);
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

  // Connected: truncate address + logout
  console.log("[DL] user connected", publicKey?.toBase58());
  const logoutBtn = (
    <Button
      {...props}
      className="wallet-adapter-button-trigger-secondary"
      style={{ display: "flex", justifyContent: "center", alignItems: "center" }}
      onClick={() => { console.log("[DL] disconnect"); disconnect(); }}
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
