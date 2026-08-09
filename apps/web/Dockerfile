# ── Build (monorepo) ──────────────────────────────────────────────
FROM node:24-alpine AS build
WORKDIR /repo
RUN apk add --no-cache libc6-compat
# Manifest racine + lockfile pour une installation reproductible.
COPY package.json package-lock.json turbo.json tsconfig.base.json ./
COPY packages ./packages
COPY apps ./apps
RUN npm ci

# Les NEXT_PUBLIC_* sont figées AU BUILD (inlinées dans le bundle navigateur).
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY \
    NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_TELEMETRY_DISABLED=1

# Build @dowze/web et ses dépendances internes (schemas, core).
RUN npx turbo run build --filter=@dowze/web

# ── Runtime ───────────────────────────────────────────────────────
FROM node:24-alpine AS runtime
WORKDIR /repo
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
RUN apk add --no-cache libc6-compat

COPY --from=build --chown=node:node /repo/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /repo/apps/web/public ./apps/web/public

USER node
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
