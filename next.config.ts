
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
      // bcrypt is a native dependency, keep it here.
      // Remove sqlite3, as it's no longer used.
      // TensorFlow dependencies are for client-side, but might need externals if they cause issues.
      config.externals.push('bcrypt', '@tensorflow/tfjs', '@tensorflow-models/face-landmarks-detection');
    }
    return config;
  },
};

export default nextConfig;
