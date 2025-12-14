# 构建阶段
FROM node:20-alpine AS builder

# 安装 pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# 设置工作目录
WORKDIR /app

# 复制包管理文件
COPY package.json pnpm-lock.yaml ./

# 安装依赖
RUN pnpm install --frozen-lockfile

# 复制源代码
COPY . .

# 构建应用
RUN pnpm build

# 生产阶段
FROM node:20-alpine AS production

# 安装运行时依赖（sharp 需要的库）
RUN apk add --no-cache \
    libc6-compat \
    && rm -rf /var/cache/apk/*

# 创建非 root 用户
RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nuxtjs

# 设置工作目录
WORKDIR /app

# 从构建阶段复制构建产物
COPY --from=builder --chown=nuxtjs:nodejs /app/.output ./.output

# 创建数据目录
RUN mkdir -p /app/data && chown -R nuxtjs:nodejs /app/data

# 切换到非 root 用户
USER nuxtjs

# 暴露端口
EXPOSE 3000

# 设置环境变量
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

# 启动应用
CMD ["node", ".output/server/index.mjs"]