/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@dowze/auth'],
  eslint: { ignoreDuringBuilds: true },
};
export default nextConfig;
