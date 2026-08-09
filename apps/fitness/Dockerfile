# ── Build (monorepo) ──────────────────────────────────────────────
FROM node:24-alpine AS build
WORKDIR /repo
RUN apk add --no-cache libc6-compat
COPY package.json package-lock.json turbo.json tsconfig.base.json ./
COPY packages ./packages
COPY apps ./apps
RUN npm ci

# NEXT_PUBLIC_* figées AU BUILD (inlinées dans le bundle navigateur).
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY \
    NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_TELEMETRY_DISABLED=1

RUN npx turbo run build --filter=@dowze/fitness

# ── Runtime ───────────────────────────────────────────────────────
FROM node:24-alpine AS runtime
WORKDIR /repo
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000
RUN apk add --no-cache libc6-compat

COPY --from=build --chown=node:node /repo/apps/fitness/.next/standalone ./
COPY --from=build --chown=node:node /repo/apps/fitness/.next/static ./apps/fitness/.next/static
COPY --from=build /repo/apps/fitness/public ./apps/fitness/public

USER node
EXPOSE 3000
CMD ["node", "apps/fitness/server.js"]
