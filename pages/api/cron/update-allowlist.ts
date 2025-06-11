// pages/api/cron/update-allowlist.ts

import type { NextApiRequest, NextApiResponse } from "next";
import { updateAllowlistGuard } from "@/utils/leaderboard/updateAllowlist";

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

  // Accept either your Bearer secret (for local testing)...
  const authHeader = req.headers["authorization"] || "";
  const expected   = `Bearer ${process.env.ADMIN_PASSWORD}`;

  // ...or Vercel's built-in cron header (set to "true")
  const isVercelCron = req.headers["x-vercel-cron"] === "true";

  if (authHeader !== expected && !isVercelCron) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    console.log("🔔 [cron] Running updateAllowlistGuard…");
    await updateAllowlistGuard();
    console.log("✅ [cron] updateAllowlistGuard succeeded");
    return res.status(200).json({ success: true });
  } catch (err: any) {
    console.error("❌ [cron] updateAllowlistGuard failed:", err);
    return res.status(500).json({ error: err.message || "Internal Server Error" });
  }
}
