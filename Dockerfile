# syntax=docker/dockerfile:1

# ==========================================================================
# 1. 构建阶段：安装依赖 → nuxt build → scripts/release.mjs 产出 dist/
# ==========================================================================
FROM node:22-alpine AS builder

# 通过 corepack 固定 pnpm 版本，与 pnpm-lock.yaml（lockfileVersion 9.0）匹配
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

WORKDIR /app

# 先只拷贝依赖清单，命中层缓存后源码改动不会触发重装
COPY package.json pnpm-lock.yaml .npmrc ./
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --store-dir=/pnpm/store

# 再拷贝源码并构建（nuxt build + 打包出自包含的 dist/）
COPY . .
RUN pnpm build

# ==========================================================================
# 2. 运行阶段：只保留自包含的 dist/，无需 node_modules 与构建工具链
# ==========================================================================
FROM node:22-alpine AS runner

ENV NODE_ENV=production
WORKDIR /app

# dist/ 内含 .output（服务端产物 + 运行时依赖）、start.mjs、config.json、package.json
COPY --from=builder /app/dist ./

# 文件根目录，与 config.json 中的 dest（./disk）对应
RUN mkdir -p /app/disk && chown -R node:node /app

USER node

# 与 config.json 的 port 保持一致
EXPOSE 9527

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q -O /dev/null "http://127.0.0.1:${PORT:-9527}/" || exit 1

# start.mjs 以自身所在目录为基准读取 config.json
CMD ["node", "start.mjs"]
