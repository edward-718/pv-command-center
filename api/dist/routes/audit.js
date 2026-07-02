/**
 * 审计 API
 * - GET  /api/audit/logs      日志列表（支持分页、筛选）
 * - GET  /api/audit/logs/:objectType/:objectId  特定对象的审计日志
 * - POST /api/audit/export   导出审计包（HTML）
 * - GET  /api/audit/export/:projectId  下载项目审计包
 */
import { Router } from 'express';
import pvStore from '../store.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { error } from '../errors.js';
const router = Router();
// 日志列表（支持分页、筛选）
router.get('/logs', authenticate, requirePermission('audit:read'), (req, res) => {
    const { objectType, actorId, q, projectId, startDate, endDate, page = '1', pageSize = '20' } = req.query;
    let list = [...pvStore.auditLogs];
    if (objectType)
        list = list.filter((l) => l.objectType === objectType);
    if (actorId)
        list = list.filter((l) => l.actorId === actorId);
    if (q)
        list = list.filter((l) => String(l.action).toLowerCase().includes(q.toLowerCase()));
    if (startDate)
        list = list.filter((l) => new Date(l.createdAt) >= new Date(startDate));
    if (endDate)
        list = list.filter((l) => new Date(l.createdAt) <= new Date(endDate));
    if (projectId) {
        list = list.filter((l) => {
            if (l.objectType === 'PROJECT' && l.objectId === projectId)
                return true;
            if (l.objectType === 'TASK') {
                const task = pvStore.tasks.get(l.objectId);
                return task?.projectId === projectId;
            }
            return false;
        });
    }
    list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const total = list.length;
    const p = parseInt(page, 10);
    const ps = parseInt(pageSize, 10);
    if (isNaN(p) || p < 1) {
        return res.status(400).json(error(400, 'page must be >= 1'));
    }
    if (isNaN(ps) || ps < 1 || ps > 100) {
        return res.status(400).json(error(400, 'pageSize must be between 1 and 100'));
    }
    const start = (p - 1) * ps;
    res.json({
        code: 0,
        data: {
            items: list.slice(start, start + ps),
            total,
            page: p,
            pageSize: ps,
            totalPages: Math.ceil(total / ps),
        },
    });
});
// 特定对象的审计日志
router.get('/logs/:objectType/:objectId', authenticate, requirePermission('audit:read'), (req, res) => {
    const { objectType, objectId } = req.params;
    const list = pvStore.auditLogs
        .filter((l) => l.objectType === objectType && l.objectId === objectId)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    res.json({ code: 0, data: list });
});
// 生成并下载审计包
router.post('/export', authenticate, requirePermission('audit:export'), (req, res) => {
    const { projectId } = req.body;
    if (!projectId)
        return res.status(400).json({ code: 400, message: 'projectId required' });
    const project = pvStore.projects.find((p) => p.id === projectId);
    if (!project)
        return res.status(404).json({ code: 404, message: 'project not found' });
    const html = generateAuditHtml(projectId, project);
    const filename = `audit-${projectId}-${Date.now()}.html`;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(html);
});
// 直接下载项目审计包
router.get('/export/:projectId', authenticate, requirePermission('audit:export'), (req, res) => {
    const { projectId } = req.params;
    const project = pvStore.projects.find((p) => p.id === projectId);
    if (!project)
        return res.status(404).json({ code: 404, message: 'project not found' });
    const html = generateAuditHtml(projectId, project);
    const filename = `audit-${projectId}-${Date.now()}.html`;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(html);
});
function generateAuditHtml(projectId, project) {
    const projectLogs = pvStore.auditLogs.filter((log) => {
        if (log.objectType === 'PROJECT' && log.objectId === projectId)
            return true;
        if (log.objectType === 'TASK') {
            const task = pvStore.tasks.get(log.objectId);
            return task?.projectId === projectId;
        }
        if (log.objectType === 'REVIEW' || log.objectType === 'ATTACHMENT') {
            const taskId = log.taskId;
            if (taskId) {
                const task = pvStore.tasks.get(taskId);
                return task?.projectId === projectId;
            }
        }
        return false;
    }).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    const generateTime = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
    const statusCounts = { TASK: 0, PROJECT: 0, REVIEW: 0, ATTACHMENT: 0, EXPORT: 0 };
    projectLogs.forEach((l) => {
        const objType = l.objectType;
        if (objType in statusCounts)
            statusCounts[objType]++;
    });
    const logsHtml = projectLogs.map((log) => {
        const typeLabel = { TASK: '任务', PROJECT: '项目', REVIEW: '复核', ATTACHMENT: '附件', EXPORT: '导出' }[log.objectType] || log.objectType;
        return `<tr>
      <td>${new Date(log.createdAt).toLocaleString('zh-CN')}</td>
      <td><span class="badge badge-${log.objectType}">${typeLabel}</span></td>
      <td>${log.action}</td>
      <td>${log.actorId}</td>
      <td>${log.before ? `<pre class="json">${JSON.stringify(log.before, null, 2)}</pre>` : '-'}</td>
      <td>${log.after ? `<pre class="json">${JSON.stringify(log.after, null, 2)}</pre>` : '-'}</td>
    </tr>`;
    }).join('');
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>审计包 · ${project.code || projectId}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1a1a2e;background:#f8f9fa;padding:40px}
.container{max-width:1200px;margin:0 auto;background:#fff;border-radius:12px;box-shadow:0 4px 24px rgba(0,0,0,0.08);overflow:hidden}
.header{background:linear-gradient(135deg,#1e3a5f,#2d5a87);color:#fff;padding:32px 40px}
.header h1{font-size:24px;font-weight:600;margin-bottom:8px}
.header p{opacity:0.85;font-size:14px}
.meta{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:20px;padding:24px 40px;background:#f8f9fa;border-bottom:1px solid #e5e7eb}
.meta-item label{display:block;font-size:12px;color:#6b7280;margin-bottom:4px}
.meta-item span{font-size:14px;font-weight:500;color:#1f2937}
.summary{padding:20px 40px;background:#fff;border-bottom:1px solid #e5e7eb}
.summary h2{font-size:16px;margin-bottom:12px;color:#1f2937}
.summary-grid{display:flex;gap:24px;flex-wrap:wrap}
.summary-item{background:#f3f4f6;padding:12px 20px;border-radius:8px}
.summary-item .num{font-size:24px;font-weight:700;color:#1e3a5f}
.summary-item .label{font-size:12px;color:#6b7280;margin-top:4px}
table{width:100%;border-collapse:collapse}
th{background:#f3f4f6;padding:12px 16px;text-align:left;font-size:12px;font-weight:600;color:#374151;text-transform:uppercase}
td{padding:12px 16px;border-bottom:1px solid #e5e7eb;font-size:14px;vertical-align:top}
tr:hover{background:#f9fafb}
.badge{display:inline-block;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:500}
.badge-TASK{background:#dbeafe;color:#1e40af}.badge-PROJECT{background:#d1fae5;color:#065f46}
.badge-REVIEW{background:#fef3c7;color:#92400e}.badge-ATTACHMENT{background:#ede9fe;color:#5b21b6}
.badge-EXPORT{background:#e0e7ff;color:#3730a3}
pre.json{white-space:pre-wrap;word-break:break-all;font-size:11px;color:#6b7280;max-width:250px;background:#f9fafb;padding:4px;border-radius:4px}
.footer{padding:16px 40px;background:#f8f9fa;border-top:1px solid #e5e7eb;font-size:12px;color:#6b7280;text-align:center}
</style>
</head>
<body>
<div class="container">
<div class="header">
<h1>审计包导出</h1>
<p>PV 智枢 · 药物警戒项目管理系统</p>
</div>
<div class="meta">
<div class="meta-item"><label>项目编号</label><span>${project.code || '-'}</span></div>
<div class="meta-item"><label>项目名称</label><span>${project.name || '-'}</span></div>
<div class="meta-item"><label>产品</label><span>${project.product || '-'}</span></div>
<div class="meta-item"><label>生成时间</label><span>${generateTime}</span></div>
</div>
<div class="summary">
<h2>审计摘要</h2>
<div class="summary-grid">
<div class="summary-item"><div class="num">${projectLogs.length}</div><div class="label">审计记录</div></div>
<div class="summary-item"><div class="num">${statusCounts.TASK}</div><div class="label">任务操作</div></div>
<div class="summary-item"><div class="num">${statusCounts.REVIEW}</div><div class="label">复核记录</div></div>
<div class="summary-item"><div class="num">${statusCounts.ATTACHMENT}</div><div class="label">附件上传</div></div>
</div>
</div>
<table>
<thead><tr><th>时间</th><th>类型</th><th>操作</th><th>操作者</th><th>变更前</th><th>变更后</th></tr></thead>
<tbody>
${logsHtml || '<tr><td colspan="6" style="text-align:center;color:#6b7280;padding:40px">暂无审计记录</td></tr>'}
</tbody>
</table>
<div class="footer">本报告由 PV 智枢自动生成 · 包含完整操作审计轨迹 · 仅供内部使用</div>
</div>
</body>
</html>`;
}
export default router;
