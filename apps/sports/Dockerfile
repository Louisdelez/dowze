# ── Build (monorepo) ──────────────────────────────────────────────
FROM node:24-alpine AS build
WORKDIR /repo
RUN apk add --no-cache libc6-compat
COPY package.json package-lock.json turbo.json tsconfig.base.json ./
COPY packages ./packages
COPY apps ./apps
RUN npm ci

ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY \
    NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_TELEMETRY_DISABLED=1

RUN npx turbo run build --filter=@dowze/sports

# ── Runtime ───────────────────────────────────────────────────────
FROM node:24-alpine AS runtime
WORKDIR /repo
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
RUN apk add --no-cache libc6-compat

COPY --from=build --chown=node:node /repo/apps/sports/.next/standalone ./
COPY --from=build --chown=node:node /repo/apps/sports/.next/static ./apps/sports/.next/static
COPY --from=build /repo/apps/sports/public ./apps/sports/public

USER node
EXPOSE 3000
CMD ["node", "apps/sports/server.js"]
