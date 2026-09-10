FROM node:22-bookworm-slim AS deps
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/node-api/package.json apps/node-api/
COPY apps/worker/package.json apps/worker/
COPY packages/core/package.json packages/core/
COPY packages/domain/package.json packages/domain/
COPY packages/lifecycle/package.json packages/lifecycle/
COPY packages/provider/package.json packages/provider/
COPY packages/provider-api-football/package.json packages/provider-api-football/
COPY packages/storage/package.json packages/storage/
RUN pnpm install --frozen-lockfile

FROM deps AS runtime
WORKDIR /app
COPY tsconfig.base.json ./
COPY apps ./apps
COPY packages ./packages
ENV NODE_ENV=production
ENV HOST=127.0.0.1
ENV PORT=8787
ENV OBJECTS_DIR=/var/lib/football-api/objects
EXPOSE 8787
CMD ["pnpm", "--filter", "@football-api/node-api", "start"]
