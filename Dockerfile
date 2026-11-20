# Build from the repository root: docker build -t wearroom-api .
FROM node:22-bookworm-slim AS base
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates libgomp1 \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app

FROM base AS build
RUN corepack enable && corepack prepare pnpm@10.20.0 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/package.json
COPY packages/types/package.json ./packages/types/package.json
RUN pnpm --filter @closet/api... install --frozen-lockfile
COPY tsconfig.base.json ./
COPY packages/types ./packages/types
COPY apps/api/tsconfig.json ./apps/api/tsconfig.json
COPY apps/api/prisma ./apps/api/prisma
COPY apps/api/src ./apps/api/src
# Generates the Linux Prisma engine without connecting to the database.
RUN pnpm --filter @closet/api build

FROM base AS runtime
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV HF_CACHE_DIR=/app/.cache/huggingface
# Preserve pnpm's workspace links and the generated Prisma client.
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/packages/types ./packages/types
COPY --from=build --chown=node:node /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=build --chown=node:node /app/apps/api/package.json ./apps/api/package.json
COPY --from=build --chown=node:node /app/apps/api/dist ./apps/api/dist
RUN mkdir -p /app/.cache/huggingface && chown -R node:node /app/.cache
USER node
WORKDIR /app/apps/api
EXPOSE 8080
CMD ["node", "dist/index.js"]
