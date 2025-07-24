
import 'dotenv/config';
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
      // Add all necessary native dependencies here.
      config.externals.push('@tensorflow/tfjs', '@tensorflow-models/face-landmarks-detection', '@mediapipe/tasks-vision');
    }
    return config;
  },
};

export default nextConfig;
