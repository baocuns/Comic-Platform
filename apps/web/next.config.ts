import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    '192.168.1.7',
    '192.168.1.*',
    '*.local',
    'localhost:3000',
    '*.trycloudflare.com',
    '*.loca.lt',
    '*.ngrok-free.app',
    '*.ngrok.io',
  ],
  async rewrites() {
    return [
      {
        source: '/v1/:path*',
        destination: 'http://127.0.0.1:4000/v1/:path*',
      },
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
