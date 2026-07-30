import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: { formats: ["image/avif", "image/webp"] },
  async rewrites() {
    const bookingApiUrl = process.env.BOOKING_API_URL || "http://127.0.0.1:4000";

    return [
      {
        source: "/api/:path*",
        destination: `${bookingApiUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
