// pages/api/leaderboard.ts
import type { NextApiRequest, NextApiResponse } from "next";
import type { LeaderboardEntry } from "@/types/leaderboard";
import { LEADERBOARD_ENABLED } from "@/settings";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<LeaderboardEntry[] | { error: string }>
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  // Leaderboard off → always empty, and the Supabase client is never even
  // imported (its module throws when the env vars are absent).
  if (!LEADERBOARD_ENABLED) {
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json([]);
  }

  // cache on edge for 60s, allow stale for 5m
  res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300");

  const { supabase } = await import("@/utils/leaderboard/supabaseClient");

  const { data, error } = await supabase
    .from<"leaderboard", LeaderboardEntry>("leaderboard")
    .select("*")
    .order("score", { ascending: false })
    .limit(10);

  if (error) {
    console.error("Error fetching leaderboard:", error.message);
    return res.status(500).json({ error: "Database query error" });
  }

  return res.status(200).json(data!);
}
