// pages/api/cron/clear-allowlist.ts

import type { NextApiRequest, NextApiResponse } from "next";
import { clearAllowlistGuard } from "@/utils/leaderboard/clearAllowlist";

type Data = { success: true } | { error: string };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Data>
) {
  // Only GET
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  // Local Bearer secret
  const authHeader   = req.headers["authorization"] || "";
  const expected     = `Bearer ${process.env.ADMIN_PASSWORD}`;

  // Treat any presence of the x-vercel-cron header as trusted
  const isVercelCron = typeof req.headers["x-vercel-cron"] !== "undefined";

  if (authHeader !== expected && !isVercelCron) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    console.log("🔔 [cron] Running clearAllowlistGuard…");
    await clearAllowlistGuard();
    console.log("✅ [cron] clearAllowlistGuard succeeded");
    return res.status(200).json({ success: true });
  } catch (err: any) {
    console.error("❌ [cron] clearAllowlistGuard failed:", err);
    return res.status(500).json({ error: err.message || "Internal Server Error" });
  }
}
