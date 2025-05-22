/** @type {import('next').NextConfig} */

// Automatically generate a build ID (timestamp) for each Next.js build
const buildId = process.env.UNITY_BUILD_ID || Date.now().toString();

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
    const base = `/UnityBuild/${buildId}/Build`;
    return [
      // Ensure any .wasm.br (versioned or not) has the correct MIME + encoding
      {
        source: '/UnityBuild/:path*/Build/:file*.wasm.br',
        headers: [
          { key: 'Content-Type',     value: 'application/wasm' },
          { key: 'Content-Encoding', value: 'br'               },
          { key: 'Cache-Control',    value: 'public, max-age=31536000, immutable' },
          { key: 'Cross-Origin-Opener-Policy',   value: 'same-origin'   },
          { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp'  },
        ],
      },

      // Ensure original .br path sends encoding for initial fetch
      {
        source: '/UnityBuild/Build/:file*.br',
        headers: [
          { key: 'Content-Encoding', value: 'br' },
        ],
      },

      // Versioned Brotli-compressed WebAssembly
      {
        source: `${base}/:file*.wasm.br`,
        headers: [
          { key: 'Content-Type',                value: 'application/wasm'                   },
          { key: 'Content-Encoding',            value: 'br'                                  },
          { key: 'Cache-Control',               value: 'public, max-age=31536000, immutable' },
          { key: 'Cross-Origin-Opener-Policy',   value: 'same-origin'                         },
          { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp'                        },
        ],
      },
      // Versioned uncompressed WebAssembly
      {
        source: `${base}/:file*.wasm`,
        headers: [
          { key: 'Content-Type',                value: 'application/wasm'                   },
          { key: 'Cache-Control',               value: 'public, max-age=31536000, immutable' },
          { key: 'Cross-Origin-Opener-Policy',   value: 'same-origin'                         },
          { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp'                        },
        ],
      },

      // Versioned Brotli-compressed JS
      {
        source: `${base}/:file*.js.br`,
        headers: [
          { key: 'Content-Type',                value: 'application/javascript'             },
          { key: 'Content-Encoding',            value: 'br'                                  },
          { key: 'Cache-Control',               value: 'public, max-age=31536000, immutable' },
          { key: 'Cross-Origin-Opener-Policy',   value: 'same-origin'                         },
          { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp'                        },
        ],
      },
      // Versioned uncompressed JS
      {
        source: `${base}/:file*.js`,
        headers: [
          { key: 'Content-Type',                value: 'application/javascript'             },
          { key: 'Cache-Control',               value: 'public, max-age=31536000, immutable' },
          { key: 'Cross-Origin-Opener-Policy',   value: 'same-origin'                         },
          { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp'                        },
        ],
      },

      // Versioned Brotli-compressed data blob
      {
        source: `${base}/:file*.data.br`,
        headers: [
          { key: 'Content-Type',                value: 'application/octet-stream'           },
          { key: 'Content-Encoding',            value: 'br'                                  },
          { key: 'Cache-Control',               value: 'public, max-age=31536000, immutable' },
          { key: 'Cross-Origin-Opener-Policy',   value: 'same-origin'                         },
          { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp'                        },
        ],
      },
      // Versioned uncompressed data blob
      {
        source: `${base}/:file*.data`,
        headers: [
          { key: 'Content-Type',                value: 'application/octet-stream'           },
          { key: 'Cache-Control',               value: 'public, max-age=31536000, immutable' },
          { key: 'Cross-Origin-Opener-Policy',   value: 'same-origin'                         },
          { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp'                        },
        ],
      },

      // Versioned Brotli-compressed symbols JSON
      {
        source: `${base}/:file*.symbols.json.br`,
        headers: [
          { key: 'Content-Type',                value: 'application/json'                   },
          { key: 'Content-Encoding',            value: 'br'                                  },
          { key: 'Cache-Control',               value: 'public, max-age=31536000, immutable' },
          { key: 'Cross-Origin-Opener-Policy',   value: 'same-origin'                         },
          { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp'                        },
        ],
      },
      // Versioned uncompressed symbols JSON
      {
        source: `${base}/:file*.symbols.json`,
        headers: [
          { key: 'Content-Type',                value: 'application/json'                   },
          { key: 'Cache-Control',               value: 'public, max-age=31536000, immutable' },
          { key: 'Cross-Origin-Opener-Policy',   value: 'same-origin'                         },
          { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp'                        },
        ],
      },
    ];
  },
};

export default nextConfig;
