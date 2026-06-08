# ── Build (monorepo) ──────────────────────────────────────────────
FROM node:22-alpine AS build
WORKDIR /repo

# Manifest racine + lockfile pour une installation reproductible.
COPY package.json package-lock.json turbo.json tsconfig.base.json ./
COPY packages ./packages
COPY apps ./apps

RUN npm ci
# Build @dowze/api et ses dépendances internes (schemas, core) uniquement.
RUN npx turbo run build --filter=@dowze/api
# Ne garder que les dépendances de production.
RUN npm prune --omit=dev

# ── Runtime ───────────────────────────────────────────────────────
FROM node:22-alpine AS runtime
WORKDIR /repo
ENV NODE_ENV=production

COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/packages ./packages
COPY --from=build /repo/apps/api/dist ./apps/api/dist
COPY --from=build /repo/apps/api/package.json ./apps/api/package.json

EXPOSE 3001
# L'API par défaut ; le worker surcharge la commande (voir docker-compose).
CMD ["node", "apps/api/dist/main.js"]
