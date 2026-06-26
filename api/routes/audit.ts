/**
 * 审计 API
 * - GET  /api/audit/logs      日志列表（支持分页、筛选）
 * - POST /api/audit/export   导出审计包（HTML）
 */
import { Router, type Request, type Response } from 'express';

const router = Router();

type AuditLog = {
  id: string;
  actorId: string;
  objectType: string;
  objectId: string;
  action: string;
  before?: unknown;
  after?: unknown;
  createdAt: string;
};

const g = globalThis as unknown as { __pvStore?: { auditLogs: AuditLog[]; projects: unknown[]; tasks: Map<string, unknown> } };
if (!g.__pvStore) g.__pvStore = { auditLogs: [], projects: [], tasks: new Map() };
const store = g.__pvStore;

// 日志列表（支持分页）
router.get('/logs', (req: Request, res: Response) => {
  const { objectType, actorId, q, projectId, page = '1', pageSize = '20' } = req.query as Record<string, string | undefined>;
  let list = [...(store.auditLogs as AuditLog[])];

  if (objectType) list = list.filter((l) => l.objectType === objectType);
  if (actorId) list = list.filter((l) => l.actorId === actorId);
  if (projectId) list = list.filter((l) => l.objectId === projectId || (l.objectType === 'TASK' && (store.tasks.get(l.objectId as string) as { projectId?: string })?.projectId === projectId));
  if (q) list = list.filter((l) => String(l.action).toLowerCase().includes(q.toLowerCase()));

  // 按时间倒序
  list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  // 分页
  const total = list.length;
  const p = parseInt(page, 10);
  const ps = parseInt(pageSize, 10);
  const start = (p - 1) * ps;
  const paginatedList = list.slice(start, start + ps);

  res.json({
    code: 0,
    data: {
      items: paginatedList,
      total,
      page: p,
      pageSize: ps,
      totalPages: Math.ceil(total / ps),
    },
  });
});

// 导出审计包（HTML）
router.post('/export', (req: Request, res: Response) => {
  const { projectId } = req.body as { projectId?: string };
  if (!projectId) return res.status(400).json({ code: 400, message: 'projectId required' });

  const project = (store.projects as Array<Record<string, unknown>>).find((p) => p.id === projectId);
  if (!project) return res.status(404).json({ code: 404, message: 'project not found' });

  // 获取该项目相关的所有审计日志
  const projectLogs = store.auditLogs.filter((log) => {
    if (log.objectType === 'PROJECT' && log.objectId === projectId) return true;
    if (log.objectType === 'TASK') {
      const task = store.tasks.get(log.objectId) as { projectId?: string } | undefined;
      return task?.projectId === projectId;
    }
    return false;
  }).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  // 生成 HTML
  const generateTime = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
  const logsHtml = projectLogs.map((log) => `
    <tr>
      <td>${new Date(log.createdAt).toLocaleString('zh-CN')}</td>
      <td>${log.objectType}</td>
      <td>${log.action}</td>
      <td>${log.actorId}</td>
      <td>${log.before ? JSON.stringify(log.before, null, 2) : '-'}</td>
      <td>${log.after ? JSON.stringify(log.after, null, 2) : '-'}</td>
    </tr>
  `).join('');

  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>审计包导出 · ${projectId}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; color: #1a1a2e; background: #f8f9fa; padding: 40px; }
    .container { max-width: 1200px; margin: 0 auto; background: #fff; border-radius: 12px; box-shadow: 0 4px 24px rgba(0,0,0,0.08); overflow: hidden; }
    .header { background: linear-gradient(135deg, #1e3a5f 0%, #2d5a87 100%); color: #fff; padding: 32px 40px; }
    .header h1 { font-size: 24px; font-weight: 600; margin-bottom: 8px; }
    .header p { opacity: 0.85; font-size: 14px; }
    .meta { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; padding: 24px 40px; background: #f8f9fa; border-bottom: 1px solid #e5e7eb; }
    .meta-item label { display: block; font-size: 12px; color: #6b7280; margin-bottom: 4px; }
    .meta-item span { font-size: 14px; font-weight: 500; color: #1f2937; }
    table { width: 100%; border-collapse: collapse; }
    th { background: #f3f4f6; padding: 12px 16px; text-align: left; font-size: 12px; font-weight: 600; color: #374151; text-transform: uppercase; letter-spacing: 0.05em; }
    td { padding: 12px 16px; border-bottom: 1px solid #e5e7eb; font-size: 14px; vertical-align: top; }
    tr:hover { background: #f9fafb; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 500; }
    .badge-TASK { background: #dbeafe; color: #1e40af; }
    .badge-PROJECT { background: #d1fae5; color: #065f46; }
    .badge-REVIEW { background: #fef3c7; color: #92400e; }
    .badge-ATTACHMENT { background: #ede9fe; color: #5b21b6; }
    .badge-TEMPLATE { background: #fce7f3; color: #9d174d; }
    .badge-EXPORT { background: #e0e7ff; color: #3730a3; }
    pre { white-space: pre-wrap; word-break: break-all; font-size: 12px; color: #6b7280; max-width: 300px; }
    .footer { padding: 16px 40px; background: #f8f9fa; border-top: 1px solid #e5e7eb; font-size: 12px; color: #6b7280; text-align: center; }
    .summary { padding: 20px 40px; background: #fff; border-bottom: 1px solid #e5e7eb; }
    .summary h2 { font-size: 16px; margin-bottom: 12px; color: #1f2937; }
    .summary-grid { display: flex; gap: 24px; flex-wrap: wrap; }
    .summary-item { background: #f3f4f6; padding: 12px 20px; border-radius: 8px; }
    .summary-item .num { font-size: 24px; font-weight: 700; color: #1e3a5f; }
    .summary-item .label { font-size: 12px; color: #6b7280; margin-top: 4px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📋 审计包导出</h1>
      <p>PV 智枢 · 药物警戒项目管理系统</p>
    </div>
    <div class="meta">
      <div class="meta-item"><label>项目编号</label><span>${(project as { code?: string }).code || projectId}</span></div>
      <div class="meta-item"><label>项目名称</label><span>${(project as { name?: string }).name || '-'}</span></div>
      <div class="meta-item"><label>产品</label><span>${(project as { product?: string }).product || '-'}</span></div>
      <div class="meta-item"><label>生成时间</label><span>${generateTime}</span></div>
    </div>
    <div class="summary">
      <h2>📊 审计摘要</h2>
      <div class="summary-grid">
        <div class="summary-item"><div class="num">${projectLogs.length}</div><div class="label">审计记录总数</div></div>
        <div class="summary-item"><div class="num">${projectLogs.filter(l => l.objectType === 'TASK').length}</div><div class="label">任务操作</div></div>
        <div class="summary-item"><div class="num">${projectLogs.filter(l => l.objectType === 'PROJECT').length}</div><div class="label">项目操作</div></div>
        <div class="summary-item"><div class="num">${projectLogs.filter(l => l.objectType === 'ATTACHMENT').length}</div><div class="label">附件上传</div></div>
      </div>
    </div>
    <table>
      <thead>
        <tr>
          <th>时间</th>
          <th>类型</th>
          <th>操作</th>
          <th>操作者</th>
          <th>变更前</th>
          <th>变更后</th>
        </tr>
      </thead>
      <tbody>
        ${logsHtml || '<tr><td colspan="6" style="text-align:center;color:#6b7280;">暂无审计记录</td></tr>'}
      </tbody>
    </table>
    <div class="footer">
      本报告由 PV 智枢自动生成 · 包含完整的操作审计轨迹 · 仅供内部使用
    </div>
  </div>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="audit-${projectId}-${Date.now()}.html"`);
  res.send(html);
});

export default router;
