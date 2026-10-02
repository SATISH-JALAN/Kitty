# Kitty backend: API + indexer + Butler (one process by default; ROLE=api|indexer|butler runs one).
# Build from the repo root, because the backend links the shared packages in ../frontend/packages:
#   docker build -f backend/Dockerfile -t kitty-backend .
FROM node:22-slim
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH CI=true
RUN corepack enable
WORKDIR /app

# The shared raw-TS packages (@kitty/sdk, chain, zk, diary) and their dependencies. Every workspace
# manifest is copied so the frozen lockfile matches; scripts are skipped (no font fetch here).
COPY frontend/package.json frontend/pnpm-lock.yaml frontend/pnpm-workspace.yaml frontend/
COPY frontend/apps/web/package.json frontend/apps/web/
COPY frontend/packages/ui/package.json frontend/packages/ui/
COPY frontend/packages/sdk frontend/packages/sdk
COPY frontend/packages/chain frontend/packages/chain
COPY frontend/packages/zk frontend/packages/zk
COPY frontend/packages/diary frontend/packages/diary
RUN cd frontend && pnpm install --frozen-lockfile --ignore-scripts \
      --filter @kitty/sdk --filter @kitty/chain --filter @kitty/zk --filter @kitty/diary

# The backend itself.
COPY backend/package.json backend/pnpm-lock.yaml backend/
RUN cd backend && pnpm install --frozen-lockfile --ignore-scripts
COPY backend/src backend/src
COPY backend/drizzle backend/drizzle
COPY backend/scripts backend/scripts
# The action circuit's verifying key and artifact manifest (served by GET /v1/config).
COPY circuits/keys/kitty_action_vk.json circuits/keys/manifest.json circuits/keys/

WORKDIR /app/backend
ENV NODE_ENV=production PORT=8787
EXPOSE 8787
CMD ["sh", "-c", "if [ -n \"$ROLE\" ]; then exec node --import tsx src/$ROLE/main.ts; else exec node --import tsx src/all.ts; fi"]
