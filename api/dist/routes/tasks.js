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
import { Router } from 'express';
import pvStore from '../store.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { notifyReviewResult } from '../services/notification.js';
const router = Router();
/**
 * 任务状态机
 * 状态: NOT_STARTED → IN_PROGRESS → IN_REVIEW → DONE
 *                         ↓              ↓
 *                      NEEDS_INFO ←←←←←←←
 */
const ALLOWED_TRANSITIONS = {
    NOT_STARTED: { to: ['IN_PROGRESS'] },
    IN_PROGRESS: { to: ['IN_REVIEW', 'NEEDS_INFO', 'NOT_STARTED', 'DONE'], requiredFields: ['submitNote'] },
    IN_REVIEW: { to: ['DONE', 'NEEDS_INFO'], requiredFields: ['reviewNote'] },
    NEEDS_INFO: { to: ['IN_PROGRESS', 'IN_REVIEW'], requiredFields: ['supplementNote'] },
    DONE: { to: [] },
};
// 任务列表
router.get('/', authenticate, async (req, res, next) => {
    try {
        const { projectId, assigneeId, reviewerId, status, priority, riskLevel, startDate, endDate, search, page = '1', pageSize = '20' } = req.query;
        const user = req.user;
        let list = Array.from(pvStore.tasks.values());
        // 供应商只能看到自己负责的任务
        if (user.role === 'VENDOR') {
            list = list.filter((t) => t.assigneeId === user.id);
        }
        else if (user.role !== 'ADMIN' && user.role !== 'QA') {
            // 非 ADMIN/QA 角色的用户，只能看到自己参与项目的任务
            const projects = pvStore.projects;
            const visibleProjectIds = new Set();
            projects.forEach((p) => {
                if (p.ownerId === user.id || p.memberIds?.includes(user.id)) {
                    visibleProjectIds.add(p.id);
                }
            });
            list = list.filter((t) => {
                if (t.assigneeId === user.id)
                    return true;
                if (visibleProjectIds.has(t.projectId))
                    return true;
                return false;
            });
        }
        if (projectId)
            list = list.filter((t) => t.projectId === projectId);
        if (assigneeId)
            list = list.filter((t) => t.assigneeId === assigneeId);
        if (reviewerId)
            list = list.filter((t) => t.reviewerId === reviewerId);
        if (status)
            list = list.filter((t) => t.status === status);
        if (priority)
            list = list.filter((t) => t.priority === priority);
        if (riskLevel)
            list = list.filter((t) => t.riskLevel === riskLevel);
        if (startDate)
            list = list.filter((t) => new Date(t.createdAt) >= new Date(startDate));
        if (endDate)
            list = list.filter((t) => new Date(t.createdAt) <= new Date(endDate));
        if (search) {
            const q = search.toLowerCase();
            list = list.filter((t) => t.title.toLowerCase().includes(q) ||
                t.description?.toLowerCase().includes(q) ||
                t.caseId?.toLowerCase().includes(q));
        }
        list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
        const total = list.length;
        const p = parseInt(page, 10);
        const ps = parseInt(pageSize, 10);
        // 分页参数校验
        if (isNaN(p) || p < 1) {
            return res.status(400).json({ code: 400, message: 'page must be a positive integer' });
        }
        if (isNaN(ps) || ps < 1 || ps > 100) {
            return res.status(400).json({ code: 400, message: 'pageSize must be between 1 and 100' });
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
    }
    catch (err) {
        next(err);
    }
});
// 任务详情 - 添加证据状态
router.get('/:id', authenticate, async (req, res, next) => {
    try {
        const task = pvStore.tasks.get(req.params.id);
        if (!task)
            return res.status(404).json({ code: 404, message: 'task not found' });
        const taskId = req.params.id;
        const comments = pvStore.comments.filter((c) => c.taskId === taskId);
        const attachments = pvStore.attachments.filter((a) => a.taskId === taskId && !a.isDeleted);
        const reviews = pvStore.reviews.filter((r) => r.taskId === taskId);
        const auditLogs = pvStore.auditLogs
            .filter((l) => l.objectType === 'TASK' && l.objectId === taskId)
            .slice(0, 20);
        // 计算证据完整度
        const requiredEvidence = task.requiredEvidence || [];
        const evidenceUploaded = task.evidenceUploaded || [];
        const evidenceStatus = requiredEvidence.map((e) => ({
            key: e,
            uploaded: evidenceUploaded.includes(e),
            file: attachments.find((a) => a.evidenceKey === e),
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
                    ? Math.round((requiredEvidence.filter((e) => evidenceUploaded.includes(e)).length / requiredEvidence.length) * 100)
                    : 100,
            },
        });
    }
    catch (err) {
        next(err);
    }
});
// 创建任务
router.post('/', authenticate, requirePermission('task:update'), async (req, res, next) => {
    try {
        const { projectId, title, description, assigneeId, reviewerId, priority, riskLevel, dueAt, type, caseId, requiredEvidence } = req.body;
        if (!projectId) {
            return res.status(400).json({ code: 400, message: 'projectId is required' });
        }
        if (!title || typeof title !== 'string') {
            return res.status(400).json({ code: 400, message: 'title is required' });
        }
        if (title.length > 120) {
            return res.status(400).json({ code: 400, message: 'title must be 120 characters or less' });
        }
        if (description !== undefined && description !== null && typeof description === 'string' && description.length > 2000) {
            return res.status(400).json({ code: 400, message: 'description must be 2000 characters or less' });
        }
        if (!dueAt) {
            return res.status(400).json({ code: 400, message: 'dueAt is required' });
        }
        const dueAtDate = new Date(dueAt);
        if (isNaN(dueAtDate.getTime())) {
            return res.status(400).json({ code: 400, message: 'dueAt must be a valid date' });
        }
        const user = req.user;
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
            dueAt: dueAtDate.toISOString(),
            caseId: caseId || null,
            requiredEvidence: requiredEvidence || [],
            evidenceUploaded: [],
            severity: null,
            seriousness: null,
            dayZero: null,
            medicalOpinion: null,
            followUpStatus: 'NONE',
            submitNote: null,
            version: 1,
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
    }
    catch (err) {
        next(err);
    }
});
/**
 * 证据完整度校验
 * 提交复核前检查必填证据是否已上传
 */
function validateEvidence(task) {
    const requiredEvidence = task.requiredEvidence || [];
    const evidenceUploaded = task.evidenceUploaded || [];
    if (requiredEvidence.length === 0) {
        return { valid: true, missing: [] };
    }
    const missing = requiredEvidence.filter((e) => !evidenceUploaded.includes(e));
    return { valid: missing.length === 0, missing };
}
// 状态流转 - 添加证据校验和乐观锁
router.patch('/:id/status', authenticate, async (req, res, next) => {
    try {
        const task = pvStore.tasks.get(req.params.id);
        if (!task)
            return res.status(404).json({ code: 404, message: 'task not found' });
        const user = req.user;
        const { status: newStatus, submitNote, reviewNote, supplementNote, reason, expectedVersion } = req.body;
        // 乐观锁检查
        if (expectedVersion !== undefined && task.version !== expectedVersion) {
            return res.status(409).json({
                code: 409,
                message: 'conflict: task has been modified by another user',
                currentVersion: task.version,
            });
        }
        const currentStatus = task.status;
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
        task.version = (task.version || 1) + 1; // 乐观锁版本递增
        task.updatedAt = new Date().toISOString();
        // 记录说明
        if (submitNote)
            task.submitNote = submitNote;
        if (reviewNote)
            task.reviewNote = reviewNote;
        if (supplementNote)
            task.supplementNote = supplementNote;
        if (reason)
            task.completionReason = reason;
        // 复核退回时发送通知
        if (newStatus === 'NEEDS_INFO') {
            notifyReviewResult(req.params.id, task.title, 'RETURNED', reviewNote || reason);
        }
        else if (newStatus === 'DONE' && currentStatus === 'IN_REVIEW') {
            notifyReviewResult(req.params.id, task.title, 'APPROVED');
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
    }
    catch (err) {
        next(err);
    }
});
// 分配任务
router.patch('/:id/assign', authenticate, requirePermission('task:assign'), async (req, res, next) => {
    try {
        const task = pvStore.tasks.get(req.params.id);
        if (!task)
            return res.status(404).json({ code: 404, message: 'task not found' });
        const user = req.user;
        const { assigneeId, reviewerId } = req.body;
        if (!assigneeId && !reviewerId) {
            return res.status(400).json({ code: 400, message: 'assigneeId or reviewerId required' });
        }
        const before = { assigneeId: task.assigneeId, reviewerId: task.reviewerId };
        if (assigneeId !== undefined)
            task.assigneeId = assigneeId;
        if (reviewerId !== undefined)
            task.reviewerId = reviewerId;
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
    }
    catch (err) {
        next(err);
    }
});
// 添加评论
router.post('/:id/comments', authenticate, async (req, res, next) => {
    try {
        const { content, mentions = [] } = req.body;
        if (!content)
            return res.status(400).json({ code: 400, message: 'content required' });
        const user = req.user;
        const c = {
            id: `c-${Date.now()}`,
            taskId: req.params.id,
            authorId: user.id,
            content,
            mentions,
            createdAt: new Date().toISOString(),
        };
        pvStore.comments.unshift(c);
        pvStore.save();
        res.json({ code: 0, data: c });
    }
    catch (err) {
        next(err);
    }
});
// 上传附件
router.post('/:id/attachments', authenticate, requirePermission('task:upload'), async (req, res, next) => {
    try {
        const { fileName, size, type, evidenceKey } = req.body;
        if (!fileName)
            return res.status(400).json({ code: 400, message: 'fileName required' });
        const user = req.user;
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
        pvStore.attachments.unshift(a);
        // 如果上传了证据，更新任务的 evidenceUploaded
        if (evidenceKey) {
            const task = pvStore.tasks.get(req.params.id);
            if (task) {
                const uploaded = task.evidenceUploaded || [];
                if (!uploaded.includes(evidenceKey)) {
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
    }
    catch (err) {
        next(err);
    }
});
// 复核任务
router.post('/:id/review', authenticate, requirePermission('task:review'), async (req, res, next) => {
    try {
        const task = pvStore.tasks.get(req.params.id);
        if (!task)
            return res.status(404).json({ code: 404, message: 'task not found' });
        const user = req.user;
        const { decision, reason } = req.body;
        if (!decision)
            return res.status(400).json({ code: 400, message: 'decision required' });
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
        pvStore.reviews.unshift(r);
        notifyReviewResult(req.params.id, task.title, decision, reason);
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
    }
    catch (err) {
        next(err);
    }
});
// 附件软删除
router.delete('/:id/attachments/:attachmentId', authenticate, requirePermission('task:upload'), async (req, res, next) => {
    try {
        const task = pvStore.tasks.get(req.params.id);
        if (!task)
            return res.status(404).json({ code: 404, message: 'task not found' });
        const attachments = pvStore.attachments;
        const attachment = attachments.find((a) => a.id === req.params.attachmentId && a.taskId === req.params.id);
        if (!attachment)
            return res.status(404).json({ code: 404, message: 'attachment not found' });
        const user = req.user;
        const before = { ...attachment };
        attachment.isDeleted = true;
        attachment.deletedBy = user.id;
        attachment.deletedAt = new Date().toISOString();
        if (attachment.evidenceKey) {
            const evidenceKey = attachment.evidenceKey;
            const remainingEvidenceAttachments = attachments.filter((a) => a.taskId === req.params.id &&
                a.evidenceKey === evidenceKey &&
                !a.isDeleted &&
                a.id !== attachment.id);
            if (remainingEvidenceAttachments.length === 0) {
                const evidenceUploaded = task.evidenceUploaded || [];
                task.evidenceUploaded = evidenceUploaded.filter((e) => e !== evidenceKey);
            }
        }
        pvStore.addAuditLog({
            id: `l-${Date.now()}`,
            actorId: user.id,
            objectType: 'ATTACHMENT',
            objectId: attachment.id,
            taskId: req.params.id,
            action: `删除附件 ${attachment.fileName}`,
            before,
            after: attachment,
            createdAt: new Date().toISOString(),
        });
        pvStore.save();
        res.json({ code: 0, data: { message: 'attachment deleted' } });
    }
    catch (err) {
        next(err);
    }
});
export default router;
