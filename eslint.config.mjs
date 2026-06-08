import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

/**
 * Configuration ESLint « flat » partagée par tout le monorepo.
 * Les apps (web/api) peuvent étendre/compléter via leur propre eslint.config.mjs.
 */
export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/.next/**',
      '**/node_modules/**',
      '**/.turbo/**',
      '**/coverage/**',
      '**/*.config.js',
      '**/next-env.d.ts',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      // Fichiers courts (cf. doc backend/frontend) — averti, pas bloquant en dev local.
      'max-lines': ['warn', { max: 300, skipBlankLines: true, skipComments: true }],
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  prettier,
);
