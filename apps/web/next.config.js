/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // any experimental features can go here
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  }
};

module.exports = nextConfig;
