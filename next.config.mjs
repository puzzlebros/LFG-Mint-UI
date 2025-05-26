/** @type {import('next').NextConfig} */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Recreate __dirname in ESM scope
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Generate a unique build ID (timestamp) for each Next.js build
const buildId = process.env.UNITY_BUILD_ID || Date.now().toString();

// Define paths for Unity build
const unityRoot   = path.join(__dirname, 'public', 'UnityBuild');
const versionedDir = path.join(unityRoot, buildId);

// Clean up only old version folders (numeric names) — leave “Build” & “TemplateData” intact
for (const entry of fs.readdirSync(unityRoot)) {
  const entryPath = path.join(unityRoot, entry);
  if (/^\d+$/.test(entry) && entry !== buildId && fs.lstatSync(entryPath).isDirectory()) {
    fs.rmSync(entryPath, { recursive: true, force: true });
  }
}

// Copy UnityBuild assets into the new versioned folder (if it doesn’t exist yet)
if (!fs.existsSync(versionedDir)) {
  fs.mkdirSync(versionedDir, { recursive: true });
  for (const entry of fs.readdirSync(unityRoot)) {
    if (entry === buildId) continue;
    const src  = path.join(unityRoot, entry);
    const dest = path.join(versionedDir, entry);
    fs.cpSync(src, dest, { recursive: true, errorOnExist: false });
  }
}

const nextConfig = {
  // Use custom buildId for versioned routing
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

  // Apply headers to Unity WebGL assets
  async headers() {
    const base = `/UnityBuild/${buildId}/Build`;
    return [
      // Unversioned preflight: ensure correct encoding for .br
      { source: '/UnityBuild/Build/:file*.wasm.br', headers: [
          { key: 'Content-Type',     value: 'application/wasm'   },
          { key: 'Content-Encoding', value: 'br'                 },
        ]
      },
      { source: '/UnityBuild/Build/:file*.data.br', headers: [
          { key: 'Content-Encoding', value: 'br'                 },
        ]
      },
      { source: '/UnityBuild/Build/:file*.js.br', headers: [
          { key: 'Content-Encoding', value: 'br'                 },
        ]
      },
      { source: '/UnityBuild/Build/:file*.symbols.json.br', headers: [
          { key: 'Content-Encoding', value: 'br'                 },
        ]
      },

      // Versioned assets with full headers
      { source: `${base}/:file*.wasm.br`, headers: [
          { key: 'Content-Type',                value: 'application/wasm'                   },
          { key: 'Content-Encoding',            value: 'br'                                  },
          { key: 'Cache-Control',               value: 'public, max-age=31536000, immutable' },
          { key: 'Cross-Origin-Opener-Policy',   value: 'same-origin'                         },
          { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp'                        },
        ]
      },
      { source: `${base}/:file*.wasm`, headers: [
          { key: 'Content-Type',                value: 'application/wasm'                   },
          { key: 'Cache-Control',               value: 'public, max-age=31536000, immutable' },
          { key: 'Cross-Origin-Opener-Policy',   value: 'same-origin'                         },
          { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp'                        },
        ]
      },
      { source: `${base}/:file*.js.br`, headers: [
          { key: 'Content-Type',                value: 'application/javascript'             },
          { key: 'Content-Encoding',            value: 'br'                                  },
          { key: 'Cache-Control',               value: 'public, max-age=31536000, immutable' },
          { key: 'Cross-Origin-Opener-Policy',   value: 'same-origin'                         },
          { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp'                        },
        ]
      },
      { source: `${base}/:file*.js`, headers: [
          { key: 'Content-Type',                value: 'application/javascript'             },
          { key: 'Cache-Control',               value: 'public, max-age=31536000, immutable' },
          { key: 'Cross-Origin-Opener-Policy',   value: 'same-origin'                         },
          { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp'                        },
        ]
      },
      { source: `${base}/:file*.data.br`, headers: [
          { key: 'Content-Type',                value: 'application/octet-stream'           },
          { key: 'Content-Encoding',            value: 'br'                                  },
          { key: 'Cache-Control',               value: 'public, max-age=31536000, immutable' },
          { key: 'Cross-Origin-Opener-Policy',   value: 'same-origin'                         },
          { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp'                        },
        ]
      },
      { source: `${base}/:file*.data`, headers: [
          { key: 'Content-Type',                value: 'application/octet-stream'           },
          { key: 'Cache-Control',               value: 'public, max-age=31536000, immutable' },
          { key: 'Cross-Origin-Opener-Policy',   value: 'same-origin'                         },
          { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp'                        },
        ]
      },
      { source: `${base}/:file*.symbols.json.br`, headers: [
          { key: 'Content-Type',                value: 'application/json'                   },
          { key: 'Content-Encoding',            value: 'br'                                  },
          { key: 'Cache-Control',               value: 'public, max-age=31536000, immutable' },
          { key: 'Cross-Origin-Opener-Policy',   value: 'same-origin'                         },
          { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp'                        },
        ]
      },
      { source: `${base}/:file*.symbols.json`, headers: [
          { key: 'Content-Type',                value: 'application/json'                   },
          { key: 'Cache-Control',               value: 'public, max-age=31536000, immutable' },
          { key: 'Cross-Origin-Opener-Policy',   value: 'same-origin'                         },
          { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp'                        },
        ]
      },
    ];
  },
};

export default nextConfig;
