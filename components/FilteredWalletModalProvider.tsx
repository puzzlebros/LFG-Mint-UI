// components/FilteredWalletModalProvider.tsx
// Provides WalletModalContext so WalletMultiButton can call setVisible.
// The actual wallet-selection UI (both LOG IN and Switch Wallet) lives
// as a controlled Popover inside CustomWalletButton.
import { useState, ReactNode } from "react";
import { WalletModalContext } from "@solana/wallet-adapter-react-ui";

export function FilteredWalletModalProvider({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(false);
  return (
    <WalletModalContext.Provider value={{ visible, setVisible }}>
      {children}
    </WalletModalContext.Provider>
  );
}
