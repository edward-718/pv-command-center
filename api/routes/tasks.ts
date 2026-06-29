/**
 * 任务管理 API
 * - GET /api/tasks 任务列表（支持多维度筛选）
 * - GET /api/tasks/:id 任务详情（含聚合数据）
 * - POST /api/tasks 创建任务
 * - PATCH /api/tasks/:id/status 状态流转（带状态机校验+必填字段）
 * - PATCH /api/tasks/:id/assign 分配任务
 * - POST /api/tasks/:id/comments 评论
 * - POST /api/tasks/:id/attachments 上传附件
 * - POST /api/tasks/:id/review 复核任务
 */
import { Router, type Request, type Response } from 'express';
import pvStore from '../store.js';
import { authenticate, requirePermission, type AuthUser } from '../middleware/auth.js';
import { notifyReviewResult } from '../services/notification.js';

const router = Router();

type TaskRecord = Record<string, unknown>;

/**
 * 任务状态机
 * 状态: NOT_STARTED → IN_PROGRESS → IN_REVIEW → DONE
 *                         ↓              ↓
 *                      NEEDS_INFO ←←←←←←←
 */
const ALLOWED_TRANSITIONS: Record<string, { to: string[]; requiredFields?: string[]; permission?: string }> = {
  NOT_STARTED: { to: ['IN_PROGRESS'] },
  IN_PROGRESS: { to: ['IN_REVIEW', 'NEEDS_INFO', 'NOT_STARTED', 'DONE'], requiredFields: ['submitNote'] },
  IN_REVIEW: { to: ['DONE', 'NEEDS_INFO'], requiredFields: ['reviewNote'] },
  NEEDS_INFO: { to: ['IN_PROGRESS', 'IN_REVIEW'], requiredFields: ['supplementNote'] },
  DONE: { to: [] },
};

type TransitionContext = {
  status: string;
  submitNote?: string;
  reviewNote?: string;
  supplementNote?: string;
  reason?: string;
};

// 任务列表
router.get('/', authenticate, (req: Request, res: Response) => {
  const {
    projectId, assigneeId, reviewerId, status, priority, riskLevel,
    startDate, endDate, search, page = '1', pageSize = '20'
  } = req.query as Record<string, string | undefined>;

  const user = req.user as AuthUser;

  let list = Array.from(pvStore.tasks.values()) as Array<Record<string, unknown>>;

  // 供应商只能看到自己负责的任务
  if (user.role === 'VENDOR') {
    list = list.filter((t) => t.assigneeId === user.id);
  }

  if (projectId) list = list.filter((t) => t.projectId === projectId);
  if (assigneeId) list = list.filter((t) => t.assigneeId === assigneeId);
  if (reviewerId) list = list.filter((t) => t.reviewerId === reviewerId);
  if (status) list = list.filter((t) => t.status === status);
  if (priority) list = list.filter((t) => t.priority === priority);
  if (riskLevel) list = list.filter((t) => t.riskLevel === riskLevel);
  if (startDate) list = list.filter((t) => new Date(t.createdAt as string) >= new Date(startDate));
  if (endDate) list = list.filter((t) => new Date(t.createdAt as string) <= new Date(endDate));
  if (search) {
    const q = search.toLowerCase();
    list = list.filter((t) =>
      (t.title as string).toLowerCase().includes(q) ||
      (t.description as string)?.toLowerCase().includes(q) ||
      (t.caseId as string)?.toLowerCase().includes(q)
    );
  }

  list.sort((a, b) => new Date(b.updatedAt as string).getTime() - new Date(a.updatedAt as string).getTime());

  const total = list.length;
  const p = parseInt(page, 10);
  const ps = parseInt(pageSize, 10);
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

// 任务详情 - 添加证据状态
router.get('/:id', authenticate, (req: Request, res: Response) => {
  const task = pvStore.tasks.get(req.params.id) as TaskRecord | undefined;
  if (!task) return res.status(404).json({ code: 404, message: 'task not found' });

  const taskId = req.params.id;
  const comments = (pvStore.comments as Array<Record<string, unknown>>).filter((c) => c.taskId === taskId);
  const attachments = (pvStore.attachments as Array<Record<string, unknown>>).filter((a) => a.taskId === taskId && !(a as Record<string, unknown>).isDeleted);
  const reviews = (pvStore.reviews as Array<Record<string, unknown>>).filter((r) => r.taskId === taskId);
  const auditLogs = (pvStore.auditLogs as Array<Record<string, unknown>>)
    .filter((l) => l.objectType === 'TASK' && l.objectId === taskId)
    .slice(0, 20);

  // 计算证据完整度
  const requiredEvidence = (task.requiredEvidence as string[]) || [];
  const evidenceUploaded = (task.evidenceUploaded as string[]) || [];
  const evidenceStatus = requiredEvidence.map((e) => ({
    key: e,
    uploaded: evidenceUploaded.includes(e),
    file: attachments.find((a) => (a as Record<string, unknown>).evidenceKey === e),
  }));

  res.json({
    code: 0,
    data: {
      ...task,
      comments,
      attachments,
      reviews,
      recentAuditLogs: auditLogs,
      evidenceStatus,
      evidenceCompleteness: requiredEvidence.length > 0
        ? Math.round((evidenceUploaded.length / requiredEvidence.length) * 100)
        : 100,
    },
  });
});

// 创建任务
router.post('/', authenticate, requirePermission('task:update'), (req: Request, res: Response) => {
  const { projectId, title, description, assigneeId, reviewerId, priority, riskLevel, dueAt, type, caseId, requiredEvidence } = req.body as Record<string, unknown>;

  if (!projectId || !title || !dueAt) {
    return res.status(400).json({ code: 400, message: 'projectId, title, dueAt required' });
  }

  const user = req.user as AuthUser;
  const task = {
    id: `t-${Date.now()}`,
    projectId,
    title,
    description: description || '',
    type: type || 'DEFAULT',
    status: 'NOT_STARTED',
    priority: priority || 'P2',
    riskLevel: riskLevel || 'MEDIUM',
    assigneeId: assigneeId || null,
    reviewerId: reviewerId || null,
    dueAt,
    caseId: caseId || null,
    requiredEvidence: requiredEvidence || [],
    evidenceUploaded: [],
    severity: null,
    seriousness: null,
    dayZero: null,
    medicalOpinion: null,
    followUpStatus: 'NONE',
    submitNote: null,
    version: 1, // 乐观锁版本号
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  pvStore.tasks.set(task.id, task);
  pvStore.addAuditLog({
    id: `l-${Date.now()}`,
    actorId: user.id,
    objectType: 'TASK',
    objectId: task.id,
    action: `创建任务`,
    before: null,
    after: task,
    createdAt: new Date().toISOString(),
  });
  pvStore.save();
  res.json({ code: 0, data: task });
});

/**
 * 证据完整度校验
 * 提交复核前检查必填证据是否已上传
 */
function validateEvidence(task: Record<string, unknown>): { valid: boolean; missing: string[] } {
  const requiredEvidence = (task.requiredEvidence as string[]) || [];
  const evidenceUploaded = (task.evidenceUploaded as string[]) || [];

  if (requiredEvidence.length === 0) {
    return { valid: true, missing: [] };
  }

  const missing = requiredEvidence.filter((e) => !evidenceUploaded.includes(e));
  return { valid: missing.length === 0, missing };
}

// 状态流转 - 添加证据校验和乐观锁
router.patch('/:id/status', authenticate, (req: Request, res: Response) => {
  const task = pvStore.tasks.get(req.params.id) as Record<string, unknown> | undefined;
  if (!task) return res.status(404).json({ code: 404, message: 'task not found' });

  const user = req.user as AuthUser;
  const { status: newStatus, submitNote, reviewNote, supplementNote, reason, expectedVersion } = req.body as TransitionContext & { expectedVersion?: number };

  // 乐观锁检查
  if (expectedVersion !== undefined && task.version !== expectedVersion) {
    return res.status(409).json({
      code: 409,
      message: 'conflict: task has been modified by another user',
      currentVersion: task.version,
    });
  }

  const currentStatus = task.status as string;
  const transition = ALLOWED_TRANSITIONS[currentStatus];

  if (!transition || !transition.to.includes(newStatus)) {
    return res.status(400).json({
      code: 400,
      message: `invalid status transition from ${currentStatus} to ${newStatus}`,
      allowed: transition?.to || [],
    });
  }

  // 检查必填字段
  if (transition.requiredFields) {
    for (const field of transition.requiredFields) {
      if (field === 'submitNote' && !submitNote) {
        return res.status(400).json({ code: 400, message: 'submitNote is required when submitting for review' });
      }
      if (field === 'reviewNote' && !reviewNote && newStatus === 'NEEDS_INFO') {
        return res.status(400).json({ code: 400, message: 'reviewNote (return reason) is required when returning task' });
      }
      if (field === 'supplementNote' && !supplementNote) {
        return res.status(400).json({ code: 400, message: 'supplementNote is required when re-submitting' });
      }
    }
  }

  // 证据校验：提交复核前必须上传所有必填证据
  if (currentStatus === 'IN_PROGRESS' && newStatus === 'IN_REVIEW') {
    const evidenceCheck = validateEvidence(task);
    if (!evidenceCheck.valid) {
      return res.status(400).json({
        code: 400,
        message: 'evidence incomplete, missing required evidence',
        missingEvidence: evidenceCheck.missing,
      });
    }
  }

  const before = { ...task };

  // 特殊处理：复核退回需要审查权限
  if (newStatus === 'NEEDS_INFO' && currentStatus === 'IN_REVIEW') {
    if (!['PM', 'PHYSICIAN', 'QA', 'ADMIN'].includes(user.role)) {
      return res.status(403).json({ code: 403, message: 'only reviewers can return tasks' });
    }
  }

  // 紧急通道：PM/QA 可以直接将 IN_PROGRESS 改为 DONE
  if (currentStatus === 'IN_PROGRESS' && newStatus === 'DONE') {
    if (!['PM', 'QA', 'ADMIN'].includes(user.role)) {
      return res.status(403).json({ code: 403, message: 'only PM/QA can complete task directly' });
    }
    if (!reason) {
      return res.status(400).json({ code: 400, message: 'reason is required for direct completion' });
    }
  }

  task.status = newStatus;
  task.version = (task.version as number || 1) + 1; // 乐观锁版本递增
  task.updatedAt = new Date().toISOString();

  // 记录说明
  if (submitNote) task.submitNote = submitNote;
  if (reviewNote) task.reviewNote = reviewNote;
  if (supplementNote) task.supplementNote = supplementNote;
  if (reason) task.completionReason = reason;

  // 复核退回时发送通知
  if (newStatus === 'NEEDS_INFO') {
    notifyReviewResult(req.params.id, task.title as string, 'RETURNED', reviewNote || reason);
  } else if (newStatus === 'DONE' && currentStatus === 'IN_REVIEW') {
    notifyReviewResult(req.params.id, task.title as string, 'APPROVED');
  }

  pvStore.addAuditLog({
    id: `l-${Date.now()}`,
    actorId: user.id,
    objectType: 'TASK',
    objectId: task.id,
    action: `状态变更 ${currentStatus} → ${newStatus}${reason ? `（${reason}）` : ''}`,
    before,
    after: task,
    createdAt: new Date().toISOString(),
  });
  pvStore.save();
  res.json({ code: 0, data: task });
});

// 分配任务
router.patch('/:id/assign', authenticate, requirePermission('task:assign'), (req: Request, res: Response) => {
  const task = pvStore.tasks.get(req.params.id) as Record<string, unknown> | undefined;
  if (!task) return res.status(404).json({ code: 404, message: 'task not found' });

  const user = req.user as AuthUser;
  const { assigneeId, reviewerId } = req.body as { assigneeId?: string; reviewerId?: string };
  if (!assigneeId && !reviewerId) {
    return res.status(400).json({ code: 400, message: 'assigneeId or reviewerId required' });
  }

  const before = { assigneeId: task.assigneeId, reviewerId: task.reviewerId };
  if (assigneeId !== undefined) task.assigneeId = assigneeId;
  if (reviewerId !== undefined) task.reviewerId = reviewerId;
  task.updatedAt = new Date().toISOString();

  pvStore.addAuditLog({
    id: `l-${Date.now()}`,
    actorId: user.id,
    objectType: 'TASK',
    objectId: task.id,
    action: `任务分配变更 ${JSON.stringify(before)} → ${JSON.stringify({ assigneeId: task.assigneeId, reviewerId: task.reviewerId })}`,
    before,
    after: { assigneeId: task.assigneeId, reviewerId: task.reviewerId },
    createdAt: new Date().toISOString(),
  });
  pvStore.save();
  res.json({ code: 0, data: task });
});

// 添加评论
router.post('/:id/comments', authenticate, (req: Request, res: Response) => {
  const { content, mentions = [] } = req.body as { content?: string; mentions?: string[] };
  if (!content) return res.status(400).json({ code: 400, message: 'content required' });

  const user = req.user as AuthUser;
  const c = {
    id: `c-${Date.now()}`,
    taskId: req.params.id,
    authorId: user.id,
    content,
    mentions,
    createdAt: new Date().toISOString(),
  };
  (pvStore.comments as unknown[]).unshift(c);
  pvStore.save();
  res.json({ code: 0, data: c });
});

// 上传附件
router.post('/:id/attachments', authenticate, requirePermission('task:upload'), (req: Request, res: Response) => {
  const { fileName, size, type, evidenceKey } = req.body as Record<string, unknown>;
  if (!fileName) return res.status(400).json({ code: 400, message: 'fileName required' });

  const user = req.user as AuthUser;
  const a = {
    id: `a-${Date.now()}`,
    taskId: req.params.id,
    fileName,
    size: size ?? 0,
    type: type ?? 'application/octet-stream',
    version: 1,
    uploaderId: user.id,
    evidenceKey: evidenceKey ?? null,
    isDeleted: false,
    createdAt: new Date().toISOString(),
  };
  (pvStore.attachments as unknown[]).unshift(a);

  // 如果上传了证据，更新任务的 evidenceUploaded
  if (evidenceKey) {
    const task = pvStore.tasks.get(req.params.id) as Record<string, unknown>;
    if (task) {
      const uploaded = (task.evidenceUploaded as string[]) || [];
      if (!uploaded.includes(evidenceKey as string)) {
        task.evidenceUploaded = [...uploaded, evidenceKey];
      }
    }
  }

  pvStore.addAuditLog({
    id: `l-${Date.now()}`,
    actorId: user.id,
    objectType: 'ATTACHMENT',
    objectId: a.id,
    taskId: req.params.id,
    action: `上传附件 ${fileName}`,
    before: null,
    after: a,
    createdAt: new Date().toISOString(),
  });
  pvStore.save();
  res.json({ code: 0, data: a });
});

// 复核任务
router.post('/:id/review', authenticate, requirePermission('task:review'), (req: Request, res: Response) => {
  const task = pvStore.tasks.get(req.params.id) as Record<string, unknown> | undefined;
  if (!task) return res.status(404).json({ code: 404, message: 'task not found' });

  const user = req.user as AuthUser;
  const { decision, reason } = req.body as { decision?: 'APPROVED' | 'RETURNED'; reason?: string };

  if (!decision) return res.status(400).json({ code: 400, message: 'decision required' });

  if (decision === 'RETURNED' && !reason) {
    return res.status(400).json({ code: 400, message: 'reason required when returning task' });
  }

  const r = {
    id: `r-${Date.now()}`,
    taskId: req.params.id,
    reviewerId: user.id,
    decision,
    reason: reason ?? null,
    createdAt: new Date().toISOString(),
  };
  (pvStore.reviews as unknown[]).unshift(r);

  notifyReviewResult(req.params.id, task.title as string, decision, reason);

  pvStore.addAuditLog({
    id: `l-${Date.now()}`,
    actorId: user.id,
    objectType: 'REVIEW',
    objectId: r.id,
    taskId: req.params.id,
    action: `复核任务: ${decision}${reason ? `（${reason}）` : ''}`,
    before: null,
    after: r,
    createdAt: new Date().toISOString(),
  });
  pvStore.save();
  res.json({ code: 0, data: r });
});

export default router;
