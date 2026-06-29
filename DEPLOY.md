# PV 智枢 - 部署指南

## 🚀 快速部署

### 方式一：本地开发模式

```bash
# 1. 安装依赖
npm install

# 2. 启动开发服务器（前端 + 后端）
npm run dev
```

访问：
- 前端：http://localhost:5173
- API：http://localhost:3001/api

---

### 方式二：生产模式（本地）

```bash
# 1. 构建前端
npm run build

# 2. 构建后端
npm run server:build

# 3. 启动生产服务器
npm run start
```

访问：http://localhost:3001

---

### 方式三：Docker 部署

```bash
# 1. 构建镜像
npm run docker:build
# 或
docker build -t pv-command-center .

# 2. 运行容器
npm run docker:run
# 或
docker run -p 3001:3001 -v ./data:/app/data pv-command-center

# 3. 使用 docker-compose
npm run docker:up
# 或
docker-compose up -d

# 停止
npm run docker:down
```

---

### 方式四：Vercel 部署（Serverless）

1. 安装 Vercel CLI：
```bash
npm i -g vercel
```

2. 登录并部署：
```bash
vercel login
vercel --prod
```

配置文件：[vercel.json](file:///c:/Trae/PV项目管理/vercel.json)

---

## 📁 项目结构

```
├── api/                    # 后端 API
│   ├── routes/            # 路由模块
│   ├── middleware/        # 中间件
│   ├── services/          # 服务层
│   ├── server.ts          # 本地入口
│   ├── index.ts           # Vercel 入口
│   └── tsconfig.json      # 后端 TS 配置
│
├── src/                   # 前端 React
│   ├── components/        # 组件
│   ├── pages/             # 页面
│   ├── lib/               # 工具库
│   └── store/             # Zustand 状态
│
├── data/                  # JSON 数据存储
├── dist/                  # 前端构建输出
├── Dockerfile             # Docker 配置
├── docker-compose.yml     # Docker Compose
└── vercel.json            # Vercel 配置
```

---

## ⚙️ 环境变量

复制 `.env.example` 为 `.env`：

```bash
cp .env.example .env
```

主要变量：
| 变量 | 说明 | 默认值 |
|---|---|---|
| PORT | 服务端口 | 3001 |
| CORS_ORIGIN | CORS 来源 | * |
| VITE_API_BASE | 前端 API 地址 | http://localhost:3001/api |

---

## 🔌 API 端点

| 模块 | 端点 | 说明 |
|---|---|---|
| **认证** | POST /api/auth/login | 登录 |
| | POST /api/auth/logout | 登出 |
| | GET /api/auth/me | 当前用户 |
| **项目** | GET /api/projects | 项目列表 |
| | POST /api/projects | 创建项目 |
| | PUT /api/projects/:id | 更新项目 |
| | DELETE /api/projects/:id | 归档项目 |
| **任务** | GET /api/tasks | 任务列表 |
| | POST /api/tasks | 创建任务 |
| | PATCH /api/tasks/:id/status | 状态流转 |
| | PATCH /api/tasks/:id/assign | 分配任务 |
| **驾驶舱** | GET /api/dashboard | 统计数据 |
| | GET /api/dashboard/kpis | KPI 指标 |
| **审计** | GET /api/audit/logs | 审计日志 |
| | POST /api/audit/export | 导出审计包 |
| **模板** | GET /api/templates | 模板列表 |
| | POST /api/templates | 创建模板 |
| **AI** | GET /api/ai/drafts | 草稿列表 |
| | POST /api/ai/draft | 生成草稿 |
| **通知** | GET /api/users/notifications | 通知列表 |

---

## 🧪 测试账号

| 用户 | 邮箱 | 角色 |
|---|---|---|
| 林婉清 | lin.wq@pharma.com | PM |
| 赵思源 | zhao.sy@pharma.com | PROCESSOR |
| Dr. Chen | chen.med@pharma.com | PHYSICIAN |
| 何婧仪 | he.jy@pharma.com | QA |
| CRO-王启航 | wang.qh@cro-partner.com | VENDOR |
| 吴启明 | wu.qm@pharma.com | ADMIN |

---

## 🛠️ 常用命令

```bash
# 开发
npm run dev              # 前端 + 后端
npm run client:dev       # 仅前端
npm run server:dev       # 仅后端（热重载）

# 构建
npm run build            # 前端构建
npm run server:build     # 后端构建

# 生产
npm run start            # 启动生产服务器

# Docker
npm run docker:build     # 构建镜像
npm run docker:up        # 启动容器
npm run docker:down      # 停止容器

# 其他
npm run lint             # ESLint 检查
npm run check            # TS 类型检查
npm run reset-data       # 重置数据
```

---

## 📊 数据持久化

数据存储在 `data/` 目录：

```
data/
├── users.json       # 用户
├── projects.json    # 项目
├── tasks.json       # 任务
├── comments.json    # 评论
├── attachments.json # 附件
├── reviews.json     # 复核
├── auditLogs.json   # 审计日志
├── notifications.json # 通知
├── templates.json   # 模板
└── aiDrafts.json    # AI 草稿
```

---

## 🔐 权限矩阵

| 权限 | PM | PROCESSOR | PHYSICIAN | QA | VENDOR | ADMIN |
|---|---|---|---|---|---|---|
| 创建项目 | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ |
| 复核任务 | ✅ | ❌ | ✅ | ✅ | ❌ | ✅ |
| 上传附件 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 查看审计日志 | ✅ | ❌ | ❌ | ✅ | ❌ | ✅ |
| 导出审计包 | ✅ | ❌ | ❌ | ✅ | ❌ | ✅ |
| 创建模板 | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ |

---

## ❗ 常见问题

### PowerShell 脚本执行受限

如果遇到 PowerShell 执行策略限制，执行以下命令：

```powershell
# 临时允许（推荐）
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass

# 或者使用 cmd.exe 代替 PowerShell
cmd /c "npm run dev"
```

### 数据丢失

数据文件位于 `data/` 目录，请确保：
1. 目录存在且有写入权限
2. Docker 挂载正确（`-v ./data:/app/data`）

### API 请求失败

检查：
1. 后端服务是否启动（`http://localhost:3001/api/health`）
2. CORS 配置是否正确
3. Token 是否有效

---

## 📝 更新日志

- **v1.0.0** - 2026-06-26
  - 完成 MVP 全部功能
  - 实现数据持久化
  - 添加 RBAC 权限控制
  - 完善审计系统
  - 支持 Docker/Vercel 部署