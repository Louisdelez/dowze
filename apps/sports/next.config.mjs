/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  transpilePackages: ['@dowze/auth', '@dowze/ui', '@dowze/api-client'],
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
