/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // On consomme les packages internes (déjà compilés en CJS) ; transpile par sûreté.
  transpilePackages: ['@dowze/schemas', '@dowze/core'],
  // Le lint est exécuté séparément (turbo run lint) avec la config flat du monorepo.
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
