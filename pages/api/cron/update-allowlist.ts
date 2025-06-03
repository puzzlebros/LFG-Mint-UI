// pages/api/cron/update-allowlist.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { updateAllowlistGuard } from "@/utils/leaderboard/updateAllowlist";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<{ success: true } | { error: string }> 
) {
  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    console.log("🔔 [cron] Running updateAllowlistGuard…");
    await updateAllowlistGuard();
    console.log("✅ [cron] updateAllowlistGuard succeeded");
    return res.status(200).json({ success: true });
  } catch (err: any) {
    console.error("❌ [cron] updateAllowlistGuard failed:", err);
    return res.status(500).json({ error: err.message || "Unknown error" });
  }
}
