// next.config.mjs
// ✅ Goal: remove fragile header matching + remove build-time public/ folder copying/deleting.
// ✅ Let Vercel handle Brotli headers via vercel.json.
// ✅ Keep a single rewrite so /UnityBuild/* maps to the current version folder.

const buildId = process.env.UNITY_BUILD_ID || "dev";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Optional: keep Next build id aligned with your Unity build id
  generateBuildId: async () => buildId,

  // Route all /UnityBuild/* requests to /UnityBuild/<buildId>/*
  async rewrites() {
    return [
      {
        source: "/UnityBuild/:path*",
        destination: `/UnityBuild/${buildId}/:path*`,
      },
    ];
  },
};

export default nextConfig;
