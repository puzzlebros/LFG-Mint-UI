// components/buttons/CustomWalletButton.tsx
import React, { useEffect, useMemo, useRef } from "react";
import dynamic from "next/dynamic";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletReadyState } from "@solana/wallet-adapter-base";
import type { ComponentProps } from "react";

const WalletMultiButtonDynamic = dynamic(
  () =>
    import("@solana/wallet-adapter-react-ui").then(
      (mod) => mod.WalletMultiButton
    ),
  { ssr: false }
);

type Props = ComponentProps<typeof WalletMultiButtonDynamic>;

function cleanupDuplicateMetaMaskEntries() {
  const modal = document.querySelector(".wallet-adapter-modal");
  if (!modal) return;

  const listItems = Array.from(
    modal.querySelectorAll<HTMLLIElement>(".wallet-adapter-modal-list li")
  );

  if (!listItems.length) return;

  const metaMaskItems = listItems.filter((li) => {
    const text = li.textContent?.trim().toLowerCase() ?? "";
    return text.includes("metamask");
  });

  // Keep only one MetaMask entry.
  // In your current setup, the Solana MetaMask one is typically the last one rendered.
  if (metaMaskItems.length > 1) {
    metaMaskItems.slice(0, -1).forEach((li) => {
      li.style.display = "none";
    });
  }
}

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

  // If the user selected a wallet that is NotDetected, clear the selection.
  useEffect(() => {
    if (!wallet?.adapter?.name) return;

    if (selectedReadyState === WalletReadyState.NotDetected) {
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

  // Preserve stock wallet-adapter modal and styling, but hide duplicate MetaMask entries.
  useEffect(() => {
    if (typeof window === "undefined") return;

    const observer = new MutationObserver(() => {
      cleanupDuplicateMetaMaskEntries();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    // Run once in case the modal already exists.
    cleanupDuplicateMetaMaskEntries();

    return () => observer.disconnect();
  }, []);

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