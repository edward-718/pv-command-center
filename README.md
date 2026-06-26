<div align="center">

# PV智枢 · 药物警戒项目管理中心

> 面向制药 / CRO / MAH 团队的轻量级项目管理工具，覆盖 ICSR · 监管问询 · CAPA 主流程。

![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-6-646CFF?logo=vite&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3-38B2AC?logo=tailwind-css&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-green)

</div>

---

## ✨ 产品亮点

| 能力 | 说明 |
| --- | --- |
| **项目驾驶舱** | 逾期风险、待复核、证据缺失、活跃项目一屏掌握 |
| **模板驱动** | ICSR / 监管问询 / CAPA 三类预置模板，从模板一键创建项目，自动生成任务节点 |
| **任务状态机** | 未开始 → 处理中 → 待复核 → 已完成，退回时必须填写原因 |
| **证据追踪** | 每个任务节点标明「必填证据」，自动检查是否已上传 |
| **审计日志** | 登录、状态变更、评论、复核、导出——全部写入审计记录，可筛选/导出 |
| **角色权限** | PM / Processor / Safety Physician / QA / CRO Vendor / Admin 六种角色 |
| **AI 草稿** | 周报 / 会议纪要 / CAPA 初稿 / 风险摘要 4 类输出，默认仅作草稿，必须人工确认 |
| **供应商协作** | CRO 供应商受限视图，仅能看到分配给自己的任务 |

## 🚀 本地启动

**需要**：Node.js ≥ 18

```bash
# 安装依赖
npm install

# 启动（前后端同时起）
npm run dev

# 浏览器打开 http://localhost:5173
```

## 🧪 演示账号（预置）

打开登录页后，可直接选择任一角色进入工作台，无需注册：

| 角色 | 典型权限 |
| --- | --- |
| **PV 项目经理** | 创建项目、配置模板、分配任务、查看全部项目数据 |
| **Case Processor** | 处理被分配任务、上传附件、提交复核 |
| **Safety Physician** | 填写医学意见、标记升级事项 |
| **QA / 质量** | 查看审计记录、发起质量复核、导出审计包 |
| **CRO 供应商** | 仅能访问被分配的任务，受限视图 |
| **系统管理员** | 管理组织、角色、模板、提醒规则 |

## 📦 GitHub Pages 部署

```bash
# 先构建静态产物到 dist 目录
npm install
npm run build
# 然后：仓库 → Settings → Pages → Source: GitHub Actions → 保存
```

或者使用 Vercel / Netlify 直接导入仓库即可。

## 🛠 技术栈

| 层 | 选型 |
| --- | --- |
| 前端框架 | React 18 + TypeScript |
| 构建工具 | Vite 6 |
| 样式 | Tailwind CSS 3 |
| 图标 | Lucide React |
| 状态管理 | Zustand 5（带 persist → localStorage） |
| 路由 | React Router DOM |
| 后端 | Express 4 + TypeScript |
| 数据 | 前端种子数据 + localStorage 持久化（MVP 阶段） |
| 字体 | Sora（展示）+ Manrope（正文）+ JetBrains Mono（编号/代码） |

## 📂 项目结构

```
PV项目管理/
├─ src/                       # 前端 React + Vite
│  ├─ pages/                 # 页面（登录、驾驶舱、项目、任务、审计等）
│  ├─ components/             # Layout / Sidebar / TopBar / Avatar / Badge
│  ├─ store/                   # Zustand（带 persist，写入 localStorage
│  ├─ data/seed.ts             # 6 角色 + 3 模板 + 4 项目 + 15 任务 + 审计日志
│  ├─ types/index.ts           # TypeScript 类型定义
│  └─ lib/utils.ts             # cn()、日期工具、dueUrgency 等
├─ api/                         # Express 后端（API 路由）
│  ├─ routes/                   # auth / tasks / projects / audit / ai / users
│  ├─ app.ts                    # 应用装配
│  └─ server.ts                 # 监听 3001
├─ index.html                   # HTML 入口（含字体预连接）
├─ tailwind.config.js          # 主题色 + 动画
├─ vercel.json               # SPA 路由回退（Vercel 部署用）
├─ public/_redirects           # SPA 路由回退（Netlify / Surge 部署用）
└─ package.json
```

## 🔒 合规与安全说明

- **AI 输出均为草稿**：AI 生成的周报/纪要/CAPA 不直接改变任务状态，不自动外发，不替代医学判断；必须由有权限角色手动「确认」。
- **审计日志不可擦除**：所有关键操作（登录、状态变更、评论、复核、导出）均写入审计日志，且对 QA/Admin 以外的角色只读。
- **数据隔离**：当前为单租户演示。升级到多租户时，后端应以 `org_id` 作为数据边界，并在前端使用真实 JWT。
- **附件**：MVP 阶段仅保留元数据，不传输文件本身。上线前请评估上传文件的类型、大小、病毒扫描策略。

## 📌 已知限制与后续计划

- 所有数据保存在**本地浏览器 localStorage**，因此「A 的操作不会同步到 B 的浏览器」。如果需要真正的多用户同步，请启动后端 + 接入数据库（Express 路由已准备好 `api/routes/*`，可直接对接 Postgres/SQLite）。
- AI 草稿为「基于规则 + 模板拼接」的本地模拟，如需接入真实 LLM，请在 `api/routes/ai.ts` 接入外部 API，并把前端 `AIPage.tsx` 的生成逻辑改为真实请求。
- 项目模板节点的「截止时间」是相对天数（Day 0 + N 天），暂未内置监管法规的绝对截止日（如 E2B(R3) 收到后 7 天），建议在上游数据源或后续版本补充。
- **Signal / 信号监测** 与 **文献追踪** 已在产品路线图中，暂未纳入 MVP。

## ❓ 常见问题

**Q：我把链接发给同事，他的页面是空的？**
不会空——因为 `seed.ts` 内置了预置数据，每位用户首次打开都会在自己的浏览器里生成一份相同的演示数据。

**Q：如何「重置」演示数据？**
右上角用户菜单 → 「重置演示数据」（会清空 localStorage 并重新从种子数据初始化）。

**Q：部署后能改数据吗？能被别人看到吗？**
能改——每位用户的数据都在他自己的浏览器里；别人看不到你的数据，也看不到你对数据的修改。如果要做团队共享，请切换到后端持久化存储。

**Q：后端必须部署吗？**
MVP 阶段不需要。所有业务逻辑都在前端 Zustand store；`/api/*` 路由在静态部署环境会被返回 404，不影响用户体验。若要做「审计包真导出」「真登录」「团队数据同步」，再把后端部署即可。

## 📜 License

MIT — 可自由修改与商用。
