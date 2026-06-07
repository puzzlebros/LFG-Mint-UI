// utils/leaderboard/clearAllowlist.ts
import { clearLeaderboard } from "./clearLeaderboard";

export async function clearAllowlistGuard(): Promise<void> {
  const deletedCount = await clearLeaderboard();
  console.log(`[clear] ${deletedCount} leaderboard rows deleted`);
}
