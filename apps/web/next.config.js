/** @type {import('next').NextConfig} */
const nextConfig = {
  ...(process.env.NEXT_OUTPUT_MODE === "standalone"
    ? { output: "standalone" }
    : {}),
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `http://localhost:${process.env.API_PORT || "3001"}/api/:path*`
      }
    ];
  }
};

module.exports = nextConfig;
