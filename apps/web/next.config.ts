import type { NextConfig } from 'next';

const apiOrigin = (process.env.API_URL || 'http://127.0.0.1:4000').replace(/\/$/, '');

const nextConfig: NextConfig = {
  transpilePackages: ['shared'],
  images: {
    unoptimized: true,
  },
  allowedDevOrigins: [
    '192.168.1.*',
    '*.local',
    'localhost:3000',
    '*.trycloudflare.com',
    '*.loca.lt',
    '*.ngrok-free.app',
    '*.ngrok.io',
  ],
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: '/v1/:path*',
        destination: `${apiOrigin}/v1/:path*`,
      },
      {
        source: '/uploads/:path*',
        destination: `${apiOrigin}/uploads/:path*`,
      },
      {
        source: '/@:username',
        destination: '/user/:username',
      },
    ];
  },
};

export default nextConfig;
