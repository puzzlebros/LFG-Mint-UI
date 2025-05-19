/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  async headers() {
    return [
      // Brotli-compressed WebAssembly
      {
        source: "/UnityBuild/Build/:file*.wasm.br",
        headers: [
          { key:   "Content-Type",     value: "application/wasm" },
          { key:   "Content-Encoding", value: "br"            },
        ],
      },
      // Uncompressed WebAssembly
      {
        source: "/UnityBuild/Build/:file*.wasm",
        headers: [
          { key: "Content-Type", value: "application/wasm" },
        ],
      },

      // Brotli-compressed JavaScript (framework, loader, etc.)
      {
        source: "/UnityBuild/Build/:file*.js.br",
        headers: [
          { key:   "Content-Type",     value: "application/javascript" },
          { key:   "Content-Encoding", value: "br"                     },
        ],
      },
      // Uncompressed JavaScript
      {
        source: "/UnityBuild/Build/:file*.js",
        headers: [
          { key: "Content-Type", value: "application/javascript" },
        ],
      },

      // Brotli-compressed data blob
      {
        source: "/UnityBuild/Build/:file*.data.br",
        headers: [
          { key:   "Content-Type",     value: "application/octet-stream" },
          { key:   "Content-Encoding", value: "br"                        },
        ],
      },
      // Uncompressed data blob
      {
        source: "/UnityBuild/Build/:file*.data",
        headers: [
          { key: "Content-Type", value: "application/octet-stream" },
        ],
      },

      // Brotli-compressed symbols JSON
      {
        source: "/UnityBuild/Build/:file*.symbols.json.br",
        headers: [
          { key:   "Content-Type",     value: "application/json" },
          { key:   "Content-Encoding", value: "br"               },
        ],
      },
      // Uncompressed symbols JSON
      {
        source: "/UnityBuild/Build/:file*.symbols.json",
        headers: [
          { key: "Content-Type", value: "application/json" },
        ],
      },
    ];
  },
};

export default nextConfig;
