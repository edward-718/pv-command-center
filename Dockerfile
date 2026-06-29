# PV 智枢 - Docker 部署配置
# 构建阶段
FROM node:20-alpine AS builder

WORKDIR /app

# 复制依赖文件
COPY package.json package-lock.json* ./
COPY api/package.json api/package-lock.json* ./api/

# 安装依赖
RUN npm install --legacy-peer-deps
RUN cd api && npm install --legacy-peer-deps

# 复制源代码
COPY . .

# 构建前端
RUN npm run build

# 构建后端
RUN cd api && npm run build

# 生产阶段
FROM node:20-alpine AS production

WORKDIR /app

# 复制构建产物
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/api/dist ./api/dist
COPY --from=builder /app/api/node_modules ./api/node_modules
COPY --from=builder /app/api/package.json ./api/package.json

# 创建数据目录
RUN mkdir -p /app/data

# 环境变量
ENV NODE_ENV=production
ENV PORT=3001

# 暴露端口
EXPOSE 3001

# 启动命令
CMD ["node", "api/dist/server.js"]