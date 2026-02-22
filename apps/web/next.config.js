/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",

  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://localhost:3001/api/:path*",
      },
    ];
  },

  // CENTAUR has no Convex backend — alias convex/react to a safe mock
  // so legacy hook calls return undefined instead of throwing during SSR/build.
  turbopack: {
    resolveAlias: {
      "convex/react": "./src/lib/convex-mock.ts",
    },
  },
};

export default nextConfig;
