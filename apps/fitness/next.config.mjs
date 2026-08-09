/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Paquets internes transpilés depuis leur SOURCE TS (session partagée, SDK, design system).
  transpilePackages: ['@dowze/auth', '@dowze/ui', '@dowze/api-client'],
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
