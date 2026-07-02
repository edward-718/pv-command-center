/**
 * PV 智枢 API Server
 * 药物警戒项目管理系统后端
 */
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import authRoutes from './routes/auth.js';
import tasksRoutes from './routes/tasks.js';
import projectsRoutes from './routes/projects.js';
import auditRoutes from './routes/audit.js';
import aiRoutes from './routes/ai.js';
import usersRoutes from './routes/users.js';
import notificationsRoutes from './routes/notifications.js';
import templatesRoutes from './routes/templates.js';
import dashboardRoutes from './routes/dashboard.js';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config();
const app = express();
const PORT = process.env.PORT || 3001;
// === 安全中间件 ===
// CORS 配置
app.use(cors({
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));
// 请求体大小限制
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
// 请求 ID 追踪
app.use((req, res, next) => {
    req.requestId = crypto.randomUUID();
    res.setHeader('X-Request-Id', req.requestId);
    next();
});
// 请求日志（简单记录）
app.use((req, _res, next) => {
    const time = new Date().toISOString();
    console.log(`[${time}] [${req.requestId}] ${req.method} ${req.path}`);
    next();
});
// === API Routes ===
app.use('/api/auth', authRoutes);
app.use('/api/tasks', tasksRoutes);
app.use('/api/projects', projectsRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/templates', templatesRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/notifications', notificationsRoutes);
// === 健康检查 ===
app.get('/api/health', (_req, res) => {
    res.json({ success: true, message: 'ok', timestamp: new Date().toISOString() });
});
// === 错误处理 ===
// 404 handler
app.use((_req, res) => {
    res.status(404).json({ code: 404, message: 'API not found' });
});
// 全局错误处理
app.use((err, req, res, _next) => {
    console.error(`[ERROR] [${req.requestId}] ${err.message}`);
    console.error(err.stack);
    res.status(500).json({ code: 500, message: 'Internal server error' });
});
export function startServer(app, port) {
    return app.listen(port, () => {
        console.log(`[PV智枢 API] Server running on http://localhost:${port}`);
        console.log(`[PV智枢 API] Health check: http://localhost:${port}/api/health`);
    });
}
export default app;
