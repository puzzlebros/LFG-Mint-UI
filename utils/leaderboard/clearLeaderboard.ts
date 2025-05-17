//utils/leaderboard/clearLeaderboard.ts
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL         = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!;
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("❌ Missing Supabase env vars in .env");
  process.exit(1);
}

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

/**
 * Deletes *all* rows from `leaderboard`.
 * @returns number of rows deleted
 */
export async function clearLeaderboard(): Promise<number> {
  console.log("🗑 Clearing entire leaderboard…");
  const { data, error } = await supabaseAdmin
    .from("leaderboard")
    .delete()
    .neq("wallet_address", "")
    .select("*");

  if (error) throw error;
  const count = data?.length ?? 0;
  console.log(`✅ Deleted ${count} rows.`);
  return count;
}
