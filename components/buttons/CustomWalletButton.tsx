// components/CustomWalletButton.tsx
import React, { useMemo } from "react";
import dynamic from "next/dynamic";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletReadyState } from "@solana/wallet-adapter-base";
import type { ComponentProps } from "react";

// Dynamically load the standard multi‐wallet button component
const WalletMultiButtonDynamic = dynamic(
  () =>
    import("@solana/wallet-adapter-react-ui").then((mod) => mod.WalletMultiButton),
  { ssr: false }
);

type Props = ComponentProps<typeof WalletMultiButtonDynamic>;

export function CustomWalletButton(props: Props) {
  const { connected, wallets } = useWallet();

  // Detect whether the user has at least one wallet available in this environment.
  // Installed: browser extension detected
  // Loadable: available but may need user interaction / environment support
  const hasAnyAvailableWallet = useMemo(() => {
    if (!wallets || wallets.length === 0) return false;
    return wallets.some(
      (w) =>
        w.readyState === WalletReadyState.Installed ||
        w.readyState === WalletReadyState.Loadable
    );
  }, [wallets]);

  // Preserve your existing behavior:
  // - When connected: let WalletMultiButton render its normal children (address)
  // - When NOT connected: override label
  const labelWhenDisconnected = hasAnyAvailableWallet ? "LOG IN" : "GET A WALLET";

  return (
    <WalletMultiButtonDynamic
      {...props}
      className={
        [
          "wallet-adapter-button-trigger-secondary",
          props.className, // preserve any caller-supplied className
        ]
          .filter(Boolean)
          .join(" ")
      }
      style={{
        justifyContent: "center",
        paddingLeft: 0,
        paddingRight: 0,
        ...(props.style || {}), // preserve any caller-supplied style overrides
      }}
    >
      {!connected ? labelWhenDisconnected : undefined}
    </WalletMultiButtonDynamic>
  );
}
