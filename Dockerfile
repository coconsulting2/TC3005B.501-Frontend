# syntax=docker/dockerfile:1.7
#
# Multi-target Dockerfile.
#
#   target=deps         used by docker-compose.dev.yml — source is bind-mounted
#                       in, this image just provides bun + node_modules so the
#                       host's source can run via `astro dev` with hot-reload.
#
#   target=production   used by docker-compose.yml and the GHCR publish workflow
#                       — fully self-contained Astro SSR build, no host mounts.

# ============================================================
# Base — bun + curl/ca-certs
# ============================================================
FROM oven/bun:1 AS base
WORKDIR /app

# ============================================================
# deps — install dependencies (skip cypress binary, ~150MB)
# ============================================================
FROM base AS deps
COPY package.json bun.lock ./
RUN CYPRESS_INSTALL_BINARY=0 bun install --frozen-lockfile

# ============================================================
# build — astro build with PUBLIC_API_BASE_URL inlined into the bundle
# ============================================================
FROM base AS build
ARG PUBLIC_API_BASE_URL=https://localhost:3000/api
ARG PUBLIC_IS_DEV=false
ENV PUBLIC_API_BASE_URL=$PUBLIC_API_BASE_URL
ENV PUBLIC_IS_DEV=$PUBLIC_IS_DEV
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN bun run build

# ============================================================
# production — slim runtime serving the standalone Astro Node server
# ============================================================
FROM oven/bun:1-slim AS production
WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=4321

COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules

EXPOSE 4321

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD curl -f http://localhost:4321/ || exit 1

CMD ["node", "./dist/server/entry.mjs"]
