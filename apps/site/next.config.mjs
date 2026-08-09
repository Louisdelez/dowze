/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  transpilePackages: ['@dowze/auth'],
  eslint: { ignoreDuringBuilds: true },
};
export default nextConfig;
