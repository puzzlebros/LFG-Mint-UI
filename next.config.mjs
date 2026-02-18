const buildId = process.env.UNITY_BUILD_ID || "dev";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  generateBuildId: async () => buildId,
};

export default nextConfig;
