/**
 * 任务管理 API
 * - GET /api/tasks 任务列表（按角色/项目过滤）
 * - GET /api/tasks/:id 任务详情
 * - PATCH /api/tasks/:id/status 状态流转（带状态机校验）
 * - POST /api/tasks/:id/comments 评论
 * - POST /api/tasks/:id/attachments 上传附件（元数据）
 * - POST /api/tasks/:id/review 提交复核
 */
import { Router, type Request, type Response } from 'express';

const router = Router();

// MVP：内存存储（生产环境应替换为持久化数据库）
type Store = {
  tasks: Map<string, unknown>;
  comments: unknown[];
  attachments: unknown[];
  reviews: unknown[];
  auditLogs: unknown[];
};
const g = globalThis as unknown as { __pvStore?: Store };
if (!g.__pvStore) {
  g.__pvStore = { tasks: new Map(), comments: [], attachments: [], reviews: [], auditLogs: [] };
}
const store = g.__pvStore;

// 状态机
const ALLOWED: Record<string, string[]> = {
  NOT_STARTED: ['IN_PROGRESS'],
  IN_PROGRESS: ['IN_REVIEW', 'NEEDS_INFO', 'NOT_STARTED'],
  IN_REVIEW: ['DONE', 'NEEDS_INFO'],
  NEEDS_INFO: ['IN_PROGRESS', 'IN_REVIEW'],
  DONE: [],
};

router.get('/', (req: Request, res: Response) => {
  const { projectId, assigneeId, status } = req.query as Record<string, string | undefined>;
  let list = Array.from(store.tasks.values()) as Array<Record<string, unknown>>;
  if (projectId) list = list.filter((t) => t.projectId === projectId);
  if (assigneeId) list = list.filter((t) => t.assigneeId === assigneeId);
  if (status) list = list.filter((t) => t.status === status);
  res.json({ code: 0, data: list });
});

router.get('/:id', (req: Request, res: Response) => {
  const task = store.tasks.get(req.params.id);
  if (!task) return res.status(404).json({ code: 404, message: 'task not found' });
  res.json({ code: 0, data: task });
});

router.patch('/:id/status', (req: Request, res: Response) => {
  const task = store.tasks.get(req.params.id) as Record<string, unknown> | undefined;
  if (!task) return res.status(404).json({ code: 404, message: 'task not found' });
  const { status, reason } = req.body as { status?: string; reason?: string };
  if (!status || !ALLOWED[task.status as string]?.includes(status)) {
    return res.status(400).json({ code: 400, message: 'invalid status transition' });
  }
  const before = { ...task };
  task.status = status;
  task.updatedAt = new Date().toISOString();
  store.auditLogs.unshift({
    id: `l-${Date.now()}`,
    actorId: 'system',
    objectType: 'TASK',
    objectId: task.id,
    action: `状态变更 ${before.status} → ${status}${reason ? `（${reason}）` : ''}`,
    before,
    after: task,
    createdAt: new Date().toISOString(),
  });
  res.json({ code: 0, data: task });
});

router.post('/:id/comments', (req: Request, res: Response) => {
  const { content, mentions = [] } = req.body as { content?: string; mentions?: string[] };
  if (!content) return res.status(400).json({ code: 400, message: 'content required' });
  const c = {
    id: `c-${Date.now()}`,
    taskId: req.params.id,
    authorId: 'u-001',
    content,
    mentions,
    createdAt: new Date().toISOString(),
  };
  store.comments.unshift(c);
  res.json({ code: 0, data: c });
});

router.post('/:id/attachments', (req: Request, res: Response) => {
  const { fileName, size, type, evidenceKey } = req.body as Record<string, unknown>;
  if (!fileName) return res.status(400).json({ code: 400, message: 'fileName required' });
  const a = {
    id: `a-${Date.now()}`,
    taskId: req.params.id,
    fileName,
    size: size ?? 0,
    type: type ?? 'application/octet-stream',
    version: 1,
    uploaderId: 'u-001',
    evidenceKey,
    createdAt: new Date().toISOString(),
  };
  store.attachments.unshift(a);
  res.json({ code: 0, data: a });
});

router.post('/:id/review', (req: Request, res: Response) => {
  const { decision, reason } = req.body as { decision?: 'APPROVED' | 'RETURNED'; reason?: string };
  if (!decision) return res.status(400).json({ code: 400, message: 'decision required' });
  if (decision === 'RETURNED' && !reason) {
    return res.status(400).json({ code: 400, message: 'reason required for RETURNED' });
  }
  const r = {
    id: `r-${Date.now()}`,
    taskId: req.params.id,
    reviewerId: 'u-001',
    decision,
    reason,
    createdAt: new Date().toISOString(),
  };
  store.reviews.unshift(r);
  res.json({ code: 0, data: r });
});

export default router;
