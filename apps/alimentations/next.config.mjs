/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  transpilePackages: ['@dowze/auth', '@dowze/ui', '@dowze/api-client'],
};

export default nextConfig;
