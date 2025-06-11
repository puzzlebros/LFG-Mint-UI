import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<string[] | { error: string }>
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const { data, error } = await supabase
      .from("leaderboard")
      .select("wallet_address")
      .order("score", { ascending: false })
      .limit(10);

    if (error) throw error;
    return res.status(200).json(data!.map((r) => r.wallet_address));
  } catch (err: any) {
    console.error("❌ allowlist API error:", err);
    return res.status(500).json({ error: err.message });
  }
}
