# ── Build (monorepo) ──────────────────────────────────────────────
FROM node:24-alpine AS build
WORKDIR /repo
RUN apk add --no-cache libc6-compat
COPY package.json package-lock.json turbo.json tsconfig.base.json ./
COPY packages ./packages
COPY apps ./apps
RUN npm ci

RUN npx turbo run build --filter=@dowze/dev

# ── Runtime ───────────────────────────────────────────────────────
FROM node:24-alpine AS runtime
WORKDIR /repo
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000
RUN apk add --no-cache libc6-compat

COPY --from=build --chown=node:node /repo/apps/dev/.next/standalone ./
COPY --from=build --chown=node:node /repo/apps/dev/.next/static ./apps/dev/.next/static
COPY --from=build /repo/apps/dev/public ./apps/dev/public

# Volume pour l'état « fait/à faire » (todo.json).
RUN mkdir -p /data
VOLUME ["/data"]

USER node
EXPOSE 3000
CMD ["node", "apps/dev/server.js"]
