# syntax=docker/dockerfile:1.7
FROM node:22-bookworm-slim AS deps
WORKDIR /app

RUN corepack enable && corepack prepare yarn@1.22.22 --activate
COPY package.json yarn.lock .yarnrc ./
# Cache mount de BuildKit: los tarballs ya descargados persisten entre builds,
# asi que la descarga serial lenta (network-concurrency 1) solo ocurre la 1a vez.
RUN --mount=type=cache,target=/root/.yarn-cache \
    yarn install --frozen-lockfile --production=false --network-concurrency 1 \
    --network-timeout 600000 --cache-folder /root/.yarn-cache

FROM node:22-bookworm-slim AS builder
WORKDIR /app

RUN corepack enable && corepack prepare yarn@1.22.22 --activate
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN yarn build

FROM node:22-bookworm-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3003

RUN corepack enable && corepack prepare yarn@1.22.22 --activate

COPY package.json yarn.lock ./
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY src/database/migrations ./src/database/migrations
COPY src/database/seeders ./src/database/seeders
COPY src/database/sequelize-cli.config.cjs ./src/database/sequelize-cli.config.cjs
COPY scripts/deploy-db.mjs ./scripts/deploy-db.mjs
# El contrato versionado alimenta la referencia interactiva de `/docs`. Sin él,
# la app la genera en caliente y pierde las respuestas de error compartidas.
COPY openapi/openapi.json ./openapi/openapi.json
COPY .sequelizerc ./

RUN mkdir -p storage/uploads storage/tmp

EXPOSE 3003
# Corre migraciones (db:deploy) y luego arranca la app — paridad con el start de Nixpacks.
CMD ["sh", "-c", "node scripts/deploy-db.mjs && node dist/main.js"]
