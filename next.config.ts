
import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com',
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
      config.externals.push('@tensorflow/tfjs', '@tensorflow-models/face-landmarks-detection');
    }
    return config;
  },
  devIndicators: {
    onLog: (log) => {
      // This is a known, non-critical warning from the MediaPipe library.
      // We can safely ignore it to prevent the Next.js error overlay from appearing.
      if (log.message.includes('Created TensorFlow Lite XNNPACK delegate for CPU')) {
        return false;
      }
      return true;
    },
  }
};

export default nextConfig;

    