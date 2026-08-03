import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/@:username',
        destination: '/user/:username',
      },
    ];
  },
  // async redirects() {
  //   return [
  //     {
  //       source: '/dashboard/:path*',
  //       destination: '/studio/:path*',
  //       permanent: true,
  //     },
  //     {
  //       source: '/dashboard',
  //       destination: '/studio',
  //       permanent: true,
  //     },
  //   ];
  // },
};

export default nextConfig;
