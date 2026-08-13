/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  // Paquets internes transpilés depuis leur SOURCE TS (session partagée, SDK, design system).
  transpilePackages: ['@dowze/auth', '@dowze/ui', '@dowze/api-client'],
};

export default nextConfig;
