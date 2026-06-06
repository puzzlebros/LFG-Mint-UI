// utils/metaplex/UmiProvider.tsx
import { ReactNode, useEffect, useMemo } from "react";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { walletAdapterIdentity } from "@metaplex-foundation/umi-signer-wallet-adapters";
import { mplTokenMetadata } from "@metaplex-foundation/mpl-token-metadata";
import { mplCandyMachine } from "@metaplex-foundation/mpl-core-candy-machine";
import { dasApi } from "@metaplex-foundation/digital-asset-standard-api";
import { createNoopSigner, publicKey, signerIdentity, UmiPlugin } from "@metaplex-foundation/umi";
import { useWallet } from "@solana/wallet-adapter-react";
import type { WalletAdapter } from "@solana/wallet-adapter-base";
import { UmiContext } from "./useUmi";

// The SDK's hardcoded mplCoreCandyGuard ID (CMAGAKJ67...) differs from the
// actual deployed program (L2TExMFK...). Without this override all PDA
// derivations use the wrong program seed, so the proof PDA the client derives
// and the one the on-chain program checks end up at different addresses.
const actualCandyGuardId = "L2TExMFKdjpN9kozasaurPirfHy9P8sbXoAN1qA3S95";
const overrideCandyGuardProgram: UmiPlugin = {
  install(umi) {
    const existing = umi.programs.get("mplCoreCandyGuard");
    umi.programs.add({ ...existing, publicKey: publicKey(actualCandyGuardId) }, true);
  },
};

export const UmiProvider = ({
  endpoint,
  children,
}: {
  endpoint: string;
  children: ReactNode;
}) => {
  const wallet = useWallet();

  // Create the Umi instance ONCE per endpoint change (stable across renders).
  const umi = useMemo(() => {
    return createUmi(endpoint)
      .use(mplTokenMetadata())
      .use(mplCandyMachine())
      .use(overrideCandyGuardProgram)
      .use(dasApi());
  }, [endpoint]);

  // Update identity whenever wallet changes (connect/disconnect/switch wallet).
  useEffect(() => {
    if (!wallet.publicKey) {
      const noopSigner = createNoopSigner(publicKey("11111111111111111111111111111111"));
      umi.use(signerIdentity(noopSigner));
      return;
    }

    // Use the currently selected wallet adapter identity (Phantom/Solflare/etc).
    // The adapter lives on wallet.wallet.adapter.
    const adapter = wallet.wallet?.adapter as unknown as WalletAdapter | undefined;

    if (adapter) {
      umi.use(walletAdapterIdentity(adapter));
    } else {
      // Fallback: if for some reason wallet is "connected" but adapter missing, keep noop.
      const noopSigner = createNoopSigner(publicKey("11111111111111111111111111111111"));
      umi.use(signerIdentity(noopSigner));
    }
  }, [
    umi,
    wallet.publicKey?.toBase58(), // re-run when pubkey changes
    wallet.wallet?.adapter,       // re-run when user switches adapter
  ]);

  return <UmiContext.Provider value={{ umi }}>{children}</UmiContext.Provider>;
};
