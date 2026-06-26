/**
 * PV 智枢 API Server
 * 药物警戒项目管理系统后端
 */
import express, { type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import authRoutes from './routes/auth.js';
import tasksRoutes from './routes/tasks.js';
import projectsRoutes from './routes/projects.js';
import auditRoutes from './routes/audit.js';
import aiRoutes from './routes/ai.js';
import usersRoutes from './routes/users.js';
import templatesRoutes from './routes/templates.js';
import dashboardRoutes from './routes/dashboard.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app: express.Application = express();
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

// 请求日志（简单记录）
app.use((req: Request, _res: Response, next: NextFunction) => {
  const time = new Date().toISOString();
  console.log(`[${time}] ${req.method} ${req.path}`);
  next();
});

// === API Routes ===
app.use('/api/auth', authRoutes);
app.use('/api/tasks', tasksRoutes);
app.use('/api/projects', projectsRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/templates', templatesRoutes);
app.use('/api/dashboard', dashboardRoutes);

// === 健康检查 ===
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ success: true, message: 'ok', timestamp: new Date().toISOString() });
});

// === 错误处理 ===
// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({ success: false, error: 'API not found', code: 'NOT_FOUND' });
});

// 全局错误处理
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(`[ERROR] ${err.message}`);
  res.status(500).json({ success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' });
});

export function startServer(app: express.Application, port: number | string) {
  return app.listen(port, () => {
    console.log(`[PV智枢 API] Server running on http://localhost:${port}`);
    console.log(`[PV智枢 API] Health check: http://localhost:${port}/api/health`);
  });
}

export default app;
