/** @type {import('next').NextConfig} */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Recreate __dirname in ESM:
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Automatically generate a unique build ID (timestamp) for each Next.js build
const buildId = process.env.UNITY_BUILD_ID || Date.now().toString();

// Paths on disk for versioned Unity build
const unityRoot = path.join(__dirname, 'public', 'UnityBuild');
const versionedDir = path.join(unityRoot, buildId);

// Copy UnityBuild output into versioned folder if not already present
if (!fs.existsSync(versionedDir)) {
  fs.mkdirSync(versionedDir, { recursive: true });
  fs.cpSync(unityRoot, versionedDir, { recursive: true, errorOnExist: false });
}

const nextConfig = {
  // Use our custom buildId so each deploy uses a new folder
  generateBuildId: async () => buildId,

  reactStrictMode: true,

  // Rewrite all UnityBuild requests to the versioned folder
  async rewrites() {
    return [
      {
        source: '/UnityBuild/:path*',
        destination: `/UnityBuild/${buildId}/:path*`,
      },
    ];
  },

  // Apply headers to each asset type under the versioned Build folder
  async headers() {
    const versionedBase = `/UnityBuild/${buildId}/Build`;
    return [
      // Unversioned .wasm.br: ensure correct MIME + encoding
      {
        source: '/UnityBuild/Build/:file*.wasm.br',
        headers: [
          { key: 'Content-Type',     value: 'application/wasm'                   },
          { key: 'Content-Encoding', value: 'br'                                 },
          { key: 'Cache-Control',    value: 'public, max-age=31536000, immutable' },
          { key: 'Cross-Origin-Opener-Policy',   value: 'same-origin'   },
          { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp'  },
        ],
      },
      // Versioned Brotli WebAssembly
      {
        source: `${versionedBase}/:file*.wasm.br`,
        headers: [
          { key: 'Content-Type',     value: 'application/wasm'                   },
          { key: 'Content-Encoding', value: 'br'                                 },
          { key: 'Cache-Control',    value: 'public, max-age=31536000, immutable' },
          { key: 'Cross-Origin-Opener-Policy',   value: 'same-origin'   },
          { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp'  },
        ],
      },
      // Versioned uncompressed WebAssembly
      {
        source: `${versionedBase}/:file*.wasm`,
        headers: [
          { key: 'Content-Type',  value: 'application/wasm'                   },
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
          { key: 'Cross-Origin-Opener-Policy',   value: 'same-origin'   },
          { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp'  },
        ],
      },
      // Versioned Brotli JS
      {
        source: `${versionedBase}/:file*.js.br`,
        headers: [
          { key: 'Content-Type',     value: 'application/javascript'             },
          { key: 'Content-Encoding', value: 'br'                                 },
          { key: 'Cache-Control',    value: 'public, max-age=31536000, immutable' },
          { key: 'Cross-Origin-Opener-Policy',   value: 'same-origin'   },
          { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp'  },
        ],
      },
      // Versioned uncompressed JS
      {
        source: `${versionedBase}/:file*.js`,
        headers: [
          { key: 'Content-Type',  value: 'application/javascript'             },
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
          { key: 'Cross-Origin-Opener-Policy',   value: 'same-origin'   },
          { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp'  },
        ],
      },
      // Versioned Brotli data blob
      {
        source: `${versionedBase}/:file*.data.br`,
        headers: [
          { key: 'Content-Type',     value: 'application/octet-stream'           },
          { key: 'Content-Encoding', value: 'br'                                 },
          { key: 'Cache-Control',    value: 'public, max-age=31536000, immutable' },
          { key: 'Cross-Origin-Opener-Policy',   value: 'same-origin'   },
          { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp'  },
        ],
      },
      // Versioned uncompressed data blob
      {
        source: `${versionedBase}/:file*.data`,
        headers: [
          { key: 'Content-Type',  value: 'application/octet-stream'           },
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
          { key: 'Cross-Origin-Opener-Policy',   value: 'same-origin'   },
          { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp'  },
        ],
      },
      // Versioned Brotli symbols JSON
      {
        source: `${versionedBase}/:file*.symbols.json.br`,
        headers: [
          { key: 'Content-Type',     value: 'application/json'                   },
          { key: 'Content-Encoding', value: 'br'                                 },
          { key: 'Cache-Control',    value: 'public, max-age=31536000, immutable' },
          { key: 'Cross-Origin-Opener-Policy',   value: 'same-origin'   },
          { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp'  },
        ],
      },
      // Versioned uncompressed symbols JSON
      {
        source: `${versionedBase}/:file*.symbols.json`,
        headers: [
          { key: 'Content-Type',  value: 'application/json'                   },
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
          { key: 'Cross-Origin-Opener-Policy',   value: 'same-origin'   },
          { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp'  },
        ],
      },
    ];
  },
};

export default nextConfig;
