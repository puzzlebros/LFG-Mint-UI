// next.config.mjs
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

/** Recreate __dirname in ESM scope */
const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Unique build ID (timestamp) for each Unity build */
const buildId = process.env.UNITY_BUILD_ID || Date.now().toString();

/** Paths */
const unityRoot    = path.join(__dirname, 'public', 'UnityBuild');
const versionedDir = path.join(unityRoot, buildId);

/** ── Cleanup old numeric folders ── */
for (const entry of fs.readdirSync(unityRoot)) {
  const entryPath = path.join(unityRoot, entry);
  // if folder name is all digits (old build) and not the current build
  if (/^\d+$/.test(entry) && entry !== buildId && fs.lstatSync(entryPath).isDirectory()) {
    fs.rmSync(entryPath, { recursive: true, force: true });
  }
}

/** ── Copy everything into the new versioned folder ── */
if (!fs.existsSync(versionedDir)) {
  fs.mkdirSync(versionedDir, { recursive: true });
  for (const entry of fs.readdirSync(unityRoot)) {
    if (entry === buildId) continue;
    const src  = path.join(unityRoot, entry);
    const dst  = path.join(versionedDir, entry);
    fs.cpSync(src, dst, { recursive: true, errorOnExist: false });
  }
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  /** Use our timestamped buildId */
  generateBuildId: async () => buildId,

  reactStrictMode: true,

  /** Rewrite all UnityBuild requests to /UnityBuild/{buildId}/... */
  async rewrites() {
    return [
      {
        source:      '/UnityBuild/:path*',
        destination: `/UnityBuild/${buildId}/:path*`,
      },
    ];
  },

  /** Single header rule for the raw WebGL assets */
  async headers() {
    return [
      {
        source: `/UnityBuild/${buildId}/Build/:path*`,
        headers: [
          // Required for SharedArrayBuffer, workers, etc.
          { key: 'Cross-Origin-Opener-Policy',   value: 'same-origin' },
          { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp' },

          // Cache busting via buildId in URL, long immutable cache
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },

          // Let Vercel negotiate gzip/Brotli compression
          { key: 'Vary', value: 'Accept-Encoding' },
        ],
      },
    ];
  },
};

export default nextConfig;
