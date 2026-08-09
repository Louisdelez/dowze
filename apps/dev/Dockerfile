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
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
RUN apk add --no-cache libc6-compat

COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/apps/dev/.next ./apps/dev/.next
COPY --from=build /repo/apps/dev/public ./apps/dev/public
COPY --from=build /repo/apps/dev/package.json ./apps/dev/package.json
COPY --from=build /repo/apps/dev/next.config.mjs ./apps/dev/next.config.mjs

# Volume pour l'état « fait/à faire » (todo.json).
RUN mkdir -p /data
VOLUME ["/data"]

WORKDIR /repo/apps/dev
EXPOSE 3000
CMD ["/repo/node_modules/.bin/next", "start", "-p", "3000"]
