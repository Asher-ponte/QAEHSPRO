
import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        pathname: '/**',
      },
    ],
  },
  webpack: (config, { isServer }) => {
    // This is required for packages with native Node.js dependencies.
    if (isServer) {
      config.externals.push('sqlite3', 'bcrypt', '@tensorflow/tfjs', '@tensorflow-models/face-landmarks-detection');
    }
    return config;
  },
};

export default nextConfig;
