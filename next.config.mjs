/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // We add a headers() function that returns an array of routing objects
  async headers() {
    return [
      {
        // This rule applies to all requests that match /UnityBuild/<anything>.br
        // For example: /UnityBuild/build.framework.js.br
        source: "/UnityBuild/(.*)\\.br",

        headers: [
          {
            key: "Content-Encoding",
            value: "br", 
          },
          {
            // Possibly adjust this if your .br file is a .wasm or .data
            // For .js or .framework.js, "application/javascript" is common
            key: "Content-Type",
            value: "application/javascript",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
