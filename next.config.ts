
import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  serverExternalPackages: ['sqlite3', '@mapbox/node-pre-gyp', 'bcrypt'],
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
