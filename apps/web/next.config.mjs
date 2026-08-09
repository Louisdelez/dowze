import withSerwistInit from '@serwist/next';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');

// Build « application de bureau » (Tauri) : on exporte le frontend en STATIQUE pour l'embarquer
// dans l'app (auto-suffisante, démarrage local). Activé par la variable d'env DESKTOP_BUILD=1.
// Sans ce flag, le build web reste STRICTEMENT identique (SSR/serveur classique).
const DESKTOP = process.env.DESKTOP_BUILD === '1';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  ...(DESKTOP
    ? {
        output: 'export',
        // L'export statique ne peut pas optimiser les images à la volée.
        images: { unoptimized: true },
        // Repli SPA : toute route non pré-générée (ex. /messages/<id>) sert quand même une page.
        trailingSlash: true,
      }
    : { output: 'standalone' }),
  outputFileTracingRoot: repoRoot,
  // Les paquets internes sont transpilés par Next à partir de leur SOURCE TS.
  transpilePackages: ['@dowze/schemas', '@dowze/core', '@dowze/auth', '@dowze/ui'],
  eslint: { ignoreDuringBuilds: true },
  webpack: (config) => {
    // On résout @dowze/core et @dowze/schemas vers leur source `src/index.ts`
    // (et non le `dist/` CommonJS pré-compilé). Sinon, en dev, le Fast Refresh
    // de Next injecte `import.meta.webpackHot` dans ces fichiers CJS →
    // « Cannot use 'import.meta' outside a module ». La source TS est traitée
    // comme un module et se transpile proprement.
    config.resolve.alias = {
      ...config.resolve.alias,
      '@dowze/core': path.join(repoRoot, 'packages/core/src/index.ts'),
      '@dowze/schemas': path.join(repoRoot, 'packages/schemas/src/index.ts'),
    };
    return config;
  },
};

// PWA : génère le service worker à partir de src/app/sw.ts.
const withSerwist = withSerwistInit({
  swSrc: 'src/app/sw.ts',
  swDest: 'public/sw.js',
  // Pas de service worker dans l'app de bureau (inutile hors navigateur) ni en dev.
  disable: process.env.NODE_ENV === 'development' || DESKTOP,
});

export default withSerwist(nextConfig);
