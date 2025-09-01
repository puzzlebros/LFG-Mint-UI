// context/LeaderboardContext.tsx
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import axios from 'axios';
import type { LeaderboardEntry } from '@/types/leaderboard';

interface LeaderboardContextType {
  top10Wallets: string[];
  leaderboardEntries: LeaderboardEntry[];
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

// Define children prop type as ReactNode
export const LeaderboardProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [top10Wallets, setTop10Wallets] = useState<string[]>([]);
  const [leaderboardEntries, setLeaderboardEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch leaderboard data on page load and only re-fetch if necessary
  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        const { data } = await axios.get<LeaderboardEntry[]>('/api/leaderboard');
        setLeaderboardEntries(data);
        setTop10Wallets(data.map((entry) => entry.wallet_address));
      } catch (err) {
        setError('Failed to load leaderboard');
      } finally {
        setLoading(false);
      }
    };

    fetchLeaderboard();
  }, []);

  return (
    <LeaderboardContext.Provider value={{ top10Wallets, leaderboardEntries, loading, error }}>
      {children}
    </LeaderboardContext.Provider>
  );
};
