//utils/leaderboard/removeEntry.ts
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL         = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!;
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("❌ Missing Supabase env vars in .env");
  process.exit(1);
}

// admin client bypasses RLS
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

/**
 * Deletes one leaderboard row by wallet_address.
 * @returns number of rows removed
 */
export async function removeEntry(address: string): Promise<number> {
  console.log(`🗑 Removing leaderboard entry for wallet: ${address}`);
  const { data, error } = await supabaseAdmin
    .from("leaderboard")
    .delete()
    .eq("wallet_address", address)
    .select("*");

  if (error) throw error;
  const removed = data?.length ?? 0;
  return removed;
}
