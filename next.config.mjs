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
  generateBuildId: async () => buildId,
  reactStrictMode: true,

  async rewrites() {
    return [
      {
        source:      '/UnityBuild/:path*',
        destination: `/UnityBuild/${buildId}/:path*`,
      },
    ];
  },

  async headers() {
    const base = `/UnityBuild/${buildId}`;

    return [
      // ─────────────────────────────────────────────────────────────
      // COOP/COEP (IMPORTANT: apply to the HTML too, not just assets)
      // ─────────────────────────────────────────────────────────────
      // If you are NOT using WebGL threads / SharedArrayBuffer, you can remove this block.
      {
        source: `${base}/:path*`,
        headers: [
          { key: 'Cross-Origin-Opener-Policy',   value: 'same-origin' },
          { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp' },
        ],
      },

      // ─────────────────────────────────────────────────────────────
      // Precompressed BROTLI assets (Unity WebGL)
      // Must set BOTH Content-Encoding and correct Content-Type.
      // ─────────────────────────────────────────────────────────────

      // WASM.BR
      {
        source: `${base}/Build/:path*\\.wasm\\.br`,
        headers: [
          { key: 'Content-Type', value: 'application/wasm' },
          { key: 'Content-Encoding', value: 'br' },
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },

      // DATA.BR
      {
        source: `${base}/Build/:path*\\.data\\.br`,
        headers: [
          { key: 'Content-Type', value: 'application/octet-stream' },
          { key: 'Content-Encoding', value: 'br' },
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },

      // JS.BR (framework)
      {
        source: `${base}/Build/:path*\\.js\\.br`,
        headers: [
          { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
          { key: 'Content-Encoding', value: 'br' },
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },

      // Loader JS (not brotli)
      {
        source: `${base}/Build/:path*\\.loader\\.js`,
        headers: [
          { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
          // keep loader less sticky than the big blobs if you want easy rollbacks
          { key: 'Cache-Control', value: 'public, max-age=3600' },
        ],
      },

      // Optional: everything else under Build (fallback cache policy)
      {
        source: `${base}/Build/:path*`,
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
    ];
  },
};

export default nextConfig;