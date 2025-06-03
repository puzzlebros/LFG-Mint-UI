// File: pages/api/cron/clear-allowlist.ts

import type { NextApiRequest, NextApiResponse } from "next";
import { clearAllowlistGuard } from "@/utils/leaderboard/clearAllowlist";

type Data = { success: true } | { error: string };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Data>
) {
  // 1️⃣ Only allow GET or POST
  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  // 2️⃣ Check Authorization header against ADMIN_PASSWORD
  const authHeader = req.headers["authorization"];
  const expected   = `Bearer ${process.env.ADMIN_PASSWORD}`;
  if (authHeader !== expected) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  // 3️⃣ Call the actual clearAllowlistGuard function
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
