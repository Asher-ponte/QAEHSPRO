
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
      config.externals.push('bcrypt', '@tensorflow/tfjs-core', '@tensorflow/tfjs-backend-webgl', '@tensorflow-models/face-landmarks-detection', '@mediapipe/tasks-vision');
    }
    return config;
  },
   env: {
    DB_HOST: process.env.DB_HOST,
    DB_USER: process.env.DB_USER,
    DB_PASSWORD: process.env.DB_PASSWORD,
    DB_NAME: process.env.DB_NAME,
    DB_PORT: process.env.DB_PORT,
    DB_SOCKET_PATH: process.env.DB_SOCKET_PATH,
  },
};

export default nextConfig;
