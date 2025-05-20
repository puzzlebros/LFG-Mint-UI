/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  async headers() {
    return [
      {
        // Apply to every file under UnityBuild/Build (Brotli or not)
        source: '/UnityBuild/Build/:path*',
        headers: [
          // Let the browser know .br files are brotli-compressed
          { key: 'Content-Encoding',  value: 'br' },
          // Cache immutably for 1 year
          { key: 'Cache-Control',     value: 'public, max-age=31536000, immutable' },
          // Required for full Wasm streaming & SharedArrayBuffer
          { key: 'Cross-Origin-Opener-Policy',   value: 'same-origin' },
          { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp' },
        ],
      },
    ];
n  },
};

export default nextConfig;
