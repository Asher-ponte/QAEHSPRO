
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
      // TensorFlow and MediaPipe dependencies can be externalized on the server
      // to prevent bundling issues that can lead to console errors.
      config.externals.push('@tensorflow/tfjs', '@tensorflow-models/face-landmarks-detection', '@mediapipe/tasks-vision');
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
