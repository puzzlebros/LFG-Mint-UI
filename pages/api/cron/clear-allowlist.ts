// pages/api/cron/clear-allowlist.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { clearAllowlistGuard } from "@/utils/leaderboard/clearAllowlist";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<{ success: true } | { error: string }>
) {
  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    console.log("🔔 [cron] Running clearAllowlistGuard…");
    await clearAllowlistGuard();
    console.log("✅ [cron] clearAllowlistGuard succeeded");
    return res.status(200).json({ success: true });
  } catch (err: any) {
    console.error("❌ [cron] clearAllowlistGuard failed:", err);
    return res.status(500).json({ error: err.message || "Unknown error" });
  }
}
