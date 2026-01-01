/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typedRoutes: true,
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "https://rag-playground-api-908840126213.us-west1.run.app/api/:path*",
      },
    ];
  },
};

module.exports = nextConfig;
