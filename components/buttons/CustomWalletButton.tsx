// components/buttons/CustomWalletButton.tsx
import React, { useEffect, useMemo, useRef } from "react";
import dynamic from "next/dynamic";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletReadyState } from "@solana/wallet-adapter-base";
import type { ComponentProps } from "react";

const WalletMultiButtonDynamic = dynamic(
  () => import("@solana/wallet-adapter-react-ui").then((mod) => mod.WalletMultiButton),
  { ssr: false }
);

type Props = ComponentProps<typeof WalletMultiButtonDynamic>;

export function CustomWalletButton(props: Props) {
  const { connected, wallet, wallets, select } = useWallet();

  const rootRef = useRef<HTMLDivElement | null>(null);

  // If caller added className="isFullWidth", force full width on the actual button.
  const wantsFullWidth = useMemo(() => {
    return (props.className ?? "").split(" ").includes("isFullWidth");
  }, [props.className]);

  // Find the currently selected wallet's readyState from the wallets list.
  const selectedReadyState = useMemo(() => {
    if (!wallet?.adapter?.name) return undefined;
    const entry = wallets.find((w) => w.adapter.name === wallet.adapter.name);
    return entry?.readyState;
  }, [wallet?.adapter?.name, wallets]);

  // ✅ BREAK THE LOOP:
  // If the user selected a wallet that is NotDetected, clear the selection.
  // Then next click will open the modal with the list again instead of re-triggering install.
  useEffect(() => {
    if (!wallet?.adapter?.name) return;

    if (selectedReadyState === WalletReadyState.NotDetected) {
      // Clear selection and disconnect defensively.
      // select(null) works in wallet-adapter; TS sometimes wants `null as any`.
      try {
        select(null as any);
      } catch {
        // ignore if types differ
      }
    }
  }, [wallet?.adapter?.name, selectedReadyState, select]);

  // Keep your full width behavior (applied to the real button)
  useEffect(() => {
    if (!wantsFullWidth) return;
    const root = rootRef.current;
    if (!root) return;

    const btn = root.querySelector<HTMLButtonElement>(".wallet-adapter-button");
    if (!btn) return;

    btn.style.width = "100%";
    btn.style.justifyContent = "center";
  }, [wantsFullWidth, connected]);

  return (
    <div ref={rootRef} className="lfg-wallet">
      <WalletMultiButtonDynamic
        {...props}
        className={[
          "wallet-adapter-button-trigger-secondary",
          props.className,
        ]
          .filter(Boolean)
          .join(" ")}
        style={{
          justifyContent: "center",
          paddingLeft: 0,
          paddingRight: 0,
          ...(props.style || {}),
        }}
      >
        {!connected ? "LOG IN" : undefined}
      </WalletMultiButtonDynamic>
    </div>
  );
}
