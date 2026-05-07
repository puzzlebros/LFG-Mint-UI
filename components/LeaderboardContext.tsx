// context/LeaderboardContext.tsx
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import axios from 'axios';
import type { LeaderboardEntry } from '@/types/leaderboard';
import { generateFakeEntries } from '@/utils/leaderboard/fakeEntries';

interface LeaderboardContextType {
  topWallets: string[];          // real entries only — used for allowlist / minting
  leaderboardEntries: LeaderboardEntry[]; // real + fake — used for display
  loading: boolean;
  error: string | null;
}

const LeaderboardContext = createContext<LeaderboardContextType | undefined>(undefined);

export const useLeaderboard = () => {
  const context = useContext(LeaderboardContext);
  if (!context) {
    throw new Error('useLeaderboard must be used within a LeaderboardProvider');
  }
  return context;
};

export const LeaderboardProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [topWallets, setTopWallets] = useState<string[]>([]);
  const [leaderboardEntries, setLeaderboardEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        const { data } = await axios.get<LeaderboardEntry[]>('/api/leaderboard');

        // Real wallets are used for allowlist — no fakes included
        setTopWallets(data.map((entry) => entry.wallet_address));

        // Pad display list with deterministic fake entries (front-end only)
        const fakes = generateFakeEntries(data);
        setLeaderboardEntries([...data, ...fakes]);
      } catch (err) {
        setError('Failed to load leaderboard');
      } finally {
        setLoading(false);
      }
    };

    fetchLeaderboard();
  }, []);

  return (
    <LeaderboardContext.Provider value={{ topWallets, leaderboardEntries, loading, error }}>
      {children}
    </LeaderboardContext.Provider>
  );
};
