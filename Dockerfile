# Everfolk as one container: the production build served by workerd (wrangler dev --local),
# with the D1 database kept on a volume. Secrets are passed at run time, never baked in.
FROM node:24-bookworm-slim AS build
WORKDIR /app
RUN corepack enable && apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/*
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
# The type check and bundling hold several multi-megabyte world packs in memory.
ENV NODE_OPTIONS=--max-old-space-size=6144
RUN pnpm build

FROM node:24-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/*
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/drizzle ./drizzle
COPY --from=build /app/scripts ./scripts
COPY docker/entrypoint.sh /usr/local/bin/everfolk-entrypoint
RUN chmod +x /usr/local/bin/everfolk-entrypoint && mkdir -p /data
VOLUME ["/data"]
EXPOSE 8787
ENTRYPOINT ["everfolk-entrypoint"]
