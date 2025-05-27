// components/CustomWalletButton.tsx
import React from "react";
import dynamic from "next/dynamic";
import { useWallet } from "@solana/wallet-adapter-react";
import type { ComponentProps } from "react";

// Dynamically load the standard multi‐wallet button component
const WalletMultiButtonDynamic = dynamic(
  () =>
    import("@solana/wallet-adapter-react-ui").then(
      (mod) => mod.WalletMultiButton
    ),
  { ssr: false }
);

export function CustomWalletButton(
  props: ComponentProps<typeof WalletMultiButtonDynamic>
) {
  const { connected } = useWallet();

  return (
    <WalletMultiButtonDynamic
      {...props}
      className="wallet-adapter-button-trigger-secondary"
      style={{
        justifyContent: "center",
        paddingLeft: 0,
        paddingRight: 0,
      }}
    >
      {/* only override the label when NOT connected */}
      {!connected ? "LOG IN" : undefined}
    </WalletMultiButtonDynamic>
  );
}
