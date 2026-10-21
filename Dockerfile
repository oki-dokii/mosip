FROM node:22-bookworm-slim AS build

WORKDIR /workspace
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates openssl \
    && rm -rf /var/lib/apt/lists/* \
    && corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/bff/package.json apps/bff/package.json
COPY apps/web/package.json apps/web/package.json
COPY apps/mock-issuer/package.json apps/mock-issuer/package.json
COPY apps/mock-verifier/package.json apps/mock-verifier/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY apps/bff/prisma apps/bff/prisma
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

FROM node:22-bookworm-slim AS runtime
WORKDIR /workspace
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates openssl \
    && rm -rf /var/lib/apt/lists/* \
    && corepack enable
COPY --from=build /workspace /workspace
ENV NODE_ENV=production

FROM runtime AS bff
EXPOSE 4000
CMD ["sh", "-c", "pnpm db:deploy && node apps/bff/dist/server.js"]

FROM runtime AS mock-issuer
EXPOSE 4101
CMD ["node", "apps/mock-issuer/dist/server.js"]

FROM runtime AS mock-verifier
EXPOSE 4102
CMD ["node", "apps/mock-verifier/dist/server.js"]

FROM nginx:1.27-alpine AS web
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /workspace/apps/web/dist /usr/share/nginx/html
EXPOSE 80
