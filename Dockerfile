# syntax=docker/dockerfile:1
# Multi-stage Dockerfile for the Inji Interoperability Playground.
# Targets: bff | mock-issuer | mock-verifier | web
#
# Build args (all optional):
#   GIT_REVISION   – git commit SHA to embed in OCI labels
#   BUILD_DATE     – ISO-8601 timestamp for the created label
#
# All runtime stages run as the non-root user "node" (uid 1000).
# Base images are pinned to explicit versions; update them deliberately.
# Node 22 LTS (bookworm-slim) is required: pnpm 11.25.0 depends on node:sqlite introduced in Node 22.13+.
ARG NODE_IMAGE=node:22.14.0-bookworm-slim@sha256:1c18d9ab3af4585870b92e4dbc5cac5a0dc77dd13df1a5905cea89fc720eb05b
ARG NGINX_IMAGE=nginx:1.27.5-alpine@sha256:65645c7bb6a0661892a8b03b89d0743208a18dd2f3f17a54ef4b76fb8e2f2a10

# ─── stage 1: dependency install ────────────────────────────────────────────
FROM ${NODE_IMAGE} AS deps

ARG GIT_REVISION=unknown
ARG BUILD_DATE=unknown

WORKDIR /workspace

# Install system packages needed for native modules (openssl for Prisma).
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates openssl \
    && rm -rf /var/lib/apt/lists/*

# Install pinned pnpm version (npm install -g avoids Node 20.19.x Corepack VM dynamic import bug).
RUN npm install -g pnpm@11.25.0

# Copy manifests first so Docker caches the install layer.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/bff/package.json          apps/bff/package.json
COPY apps/web/package.json          apps/web/package.json
COPY apps/mock-issuer/package.json  apps/mock-issuer/package.json
COPY apps/mock-verifier/package.json apps/mock-verifier/package.json
COPY packages/shared/package.json   packages/shared/package.json

# Copy Prisma schema so the postinstall hook (db:generate) succeeds.
COPY apps/bff/prisma apps/bff/prisma

# Install all dependencies (frozen – no lockfile mutations in CI).
RUN pnpm install --frozen-lockfile

# ─── stage 2: build ─────────────────────────────────────────────────────────
FROM deps AS build

# Copy full source (dockerignore excludes secrets, dist, node_modules, .git).
COPY . .

# Build every workspace package.
RUN pnpm build

# ─── stage 3: shared runtime base ───────────────────────────────────────────
FROM ${NODE_IMAGE} AS runtime-base

ARG GIT_REVISION=unknown
ARG BUILD_DATE=unknown

LABEL org.opencontainers.image.source="https://github.com/oki-dokii/mosip" \
      org.opencontainers.image.revision="${GIT_REVISION}" \
      org.opencontainers.image.created="${BUILD_DATE}" \
      org.opencontainers.image.licenses="MPL-2.0"

WORKDIR /workspace

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates openssl \
    && rm -rf /var/lib/apt/lists/* \
    && npm install -g pnpm@11.25.0

# Copy the entire built workspace from the build stage.
# node_modules, dist/, and generated Prisma client are all included.
COPY --from=build /workspace /workspace

ENV NODE_ENV=production

# Drop to the built-in non-root "node" user (uid 1000) for all runtime stages.
USER node

# ─── stage 4a: BFF ──────────────────────────────────────────────────────────
FROM runtime-base AS bff

EXPOSE 4000

# Migrations run via the separate "migrate" one-shot service in Compose.
# The BFF itself only starts the HTTP server.
CMD ["node", "apps/bff/dist/server.js"]

# ─── stage 4b: BFF migration one-shot ───────────────────────────────────────
FROM runtime-base AS migrate

# Runs prisma migrate deploy then exits 0.
# Safe to run more than once (idempotent by design).
CMD ["pnpm", "db:deploy"]

# ─── stage 4c: mock-issuer ──────────────────────────────────────────────────
FROM runtime-base AS mock-issuer

EXPOSE 4101
CMD ["node", "apps/mock-issuer/dist/server.js"]

# ─── stage 4d: mock-verifier ────────────────────────────────────────────────
FROM runtime-base AS mock-verifier

EXPOSE 4102
CMD ["node", "apps/mock-verifier/dist/server.js"]

# ─── stage 4e: web (nginx) ──────────────────────────────────────────────────
FROM ${NGINX_IMAGE} AS web

ARG GIT_REVISION=unknown
ARG BUILD_DATE=unknown

LABEL org.opencontainers.image.source="https://github.com/oki-dokii/mosip" \
      org.opencontainers.image.revision="${GIT_REVISION}" \
      org.opencontainers.image.created="${BUILD_DATE}" \
      org.opencontainers.image.licenses="MPL-2.0"

# nginx alpine already runs as root to bind port 80; it drops to nginx user
# for worker processes by default. No further change needed here because
# the image is only the static React bundle behind a loopback-only host port.
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /workspace/apps/web/dist /usr/share/nginx/html

EXPOSE 80
