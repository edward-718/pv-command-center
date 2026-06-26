/**
 * 审计 API
 * - GET  /api/audit/logs    日志列表
 * - POST /api/audit/export  导出审计包（HTML）
 */
import { Router, type Request, type Response } from 'express';

const router = Router();
const g = globalThis as unknown as { __pvStore?: { auditLogs: unknown[] } };
if (!g.__pvStore) g.__pvStore = { auditLogs: [] };
const store = g.__pvStore;

router.get('/logs', (req: Request, res: Response) => {
  const { objectType, actorId, q } = req.query as Record<string, string | undefined>;
  let list = [...(store.auditLogs as Array<Record<string, unknown>>)];
  if (objectType) list = list.filter((l) => l.objectType === objectType);
  if (actorId) list = list.filter((l) => l.actorId === actorId);
  if (q) list = list.filter((l) => String(l.action).toLowerCase().includes(q.toLowerCase()));
  res.json({ code: 0, data: list });
});

router.post('/export', (req: Request, res: Response) => {
  const { projectId } = req.body as { projectId?: string };
  if (!projectId) return res.status(400).json({ code: 400, message: 'projectId required' });
  // 占位：生产中应流式返回 HTML 或 PDF
  const html = `<!doctype html><html><head><meta charset="UTF-8"><title>审计包 · ${projectId}</title></head><body><h1>审计包导出</h1><p>项目: ${projectId}</p><p>生成时间: ${new Date().toISOString()}</p></body></html>`;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="audit-${projectId}.html"`);
  res.send(html);
});

export default router;
