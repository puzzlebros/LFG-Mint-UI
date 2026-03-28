// components/buttons/CustomWalletButton.tsx
import React, { useEffect, useMemo, useRef } from "react";
import dynamic from "next/dynamic";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletReadyState } from "@solana/wallet-adapter-base";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import {
  Box,
  Button,
  VStack,
  Image,
  useDisclosure,
  useOutsideClick,
} from "@chakra-ui/react";
import type { ComponentProps } from "react";

const WalletMultiButtonDynamic = dynamic(
  () =>
    import("@solana/wallet-adapter-react-ui").then((mod) => mod.WalletMultiButton),
  { ssr: false }
);

type Props = ComponentProps<typeof WalletMultiButtonDynamic>;

export function CustomWalletButton({ className, style, ...rest }: Props) {
  const { connected, wallet, wallets, select } = useWallet();
  const { visible, setVisible } = useWalletModal();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside the wrapper
  useOutsideClick({ ref: wrapperRef, handler: () => { if (isOpen) onClose(); } });

  // Intercept "Switch Wallet" — WalletMultiButton sets visible=true via context
  useEffect(() => {
    if (!visible) return;
    setVisible(false);
    onOpen();
  }, [visible, setVisible, onOpen]);

  const selectedReadyState = useMemo(() => {
    if (!wallet?.adapter?.name) return undefined;
    return wallets.find((w) => w.adapter.name === wallet.adapter.name)?.readyState;
  }, [wallet?.adapter?.name, wallets]);

  useEffect(() => {
    if (!wallet?.adapter?.name) return;
    if (selectedReadyState === WalletReadyState.NotDetected) {
      try { select(null as any); } catch {}
    }
  }, [wallet?.adapter?.name, selectedReadyState, select]);

  const filteredWallets = useMemo(() => {
    const withoutPhantom = wallets.filter(
      (w) => !w.adapter.name.toLowerCase().includes("phantom")
    );
    const metaMaskEntries = withoutPhantom.filter((w) =>
      w.adapter.name.toLowerCase().includes("metamask")
    );
    return withoutPhantom.filter((w) => {
      if (!w.adapter.name.toLowerCase().includes("metamask")) return true;
      return w === metaMaskEntries[metaMaskEntries.length - 1];
    });
  }, [wallets]);

  const btnClass = ["wallet-adapter-button-trigger-secondary", className]
    .filter(Boolean)
    .join(" ");

  return (
    <div ref={wrapperRef} className="lfg-wallet-wrapper" style={{ position: "relative" }}>
      {connected ? (
        <WalletMultiButtonDynamic
          className={btnClass}
          style={{ width: "100%", ...style }}
          {...rest}
        />
      ) : (
        <button
          className={`wallet-adapter-button ${btnClass}`}
          style={{ width: "100%", ...style }}
          onClick={onOpen}
        >
          LOG IN
        </button>
      )}

      {isOpen && (
        <Box
          position="absolute"
          top="calc(100% + 4px)"
          left={0}
          right={0}
          bg="white"
          boxShadow="xl"
          zIndex={1400}
          borderRadius={0}
          p={2}
        >
          <VStack spacing={1} align="stretch">
            {filteredWallets.map((w) => (
              <Button
                key={w.adapter.name}
                variant="ghost"
                justifyContent="center"
                textStyle="narrow"
                letterSpacing="2.5px"
                textTransform="uppercase"
                leftIcon={
                  w.adapter.icon ? (
                    <Image src={w.adapter.icon} w={5} h={5} alt={w.adapter.name} />
                  ) : undefined
                }
                onClick={() => { select(w.adapter.name); onClose(); }}
                size="sm"
              >
                {w.adapter.name}
              </Button>
            ))}
          </VStack>
        </Box>
      )}
    </div>
  );
}
