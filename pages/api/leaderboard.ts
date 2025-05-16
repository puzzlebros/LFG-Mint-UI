// pages/api/leaderboard.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/utils/leaderboard/supabaseClient";
import type { LeaderboardEntry } from "@/types/leaderboard";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<LeaderboardEntry[] | { error: string }>
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  // cache on edge for 60s, allow stale for 5m
  res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300");

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
