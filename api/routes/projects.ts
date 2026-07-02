/**
 * 项目管理 API
 * - GET  /api/projects         项目列表
 * - POST /api/projects         创建项目
 * - GET  /api/projects/:id    项目详情
 * - PUT  /api/projects/:id    更新项目
 * - PUT  /api/projects/:id/status   更新项目状态
 * - DELETE /api/projects/:id  归档项目（软删除）
 */
import { Router, type Request, type Response, type NextFunction } from 'express';
import pvStore from '../store.js';
import { authenticate, filterVisibleProjects, requirePermission, type AuthUser } from '../middleware/auth.js';

const router = Router();

// 项目列表
router.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user as AuthUser;
    const { status, type, search, includeArchived } = req.query as { status?: string; type?: string; search?: string; includeArchived?: string };
    let projects = filterVisibleProjects(pvStore.projects, user, pvStore.tasks) as Array<Record<string, unknown>>;

    // 默认过滤掉已归档（有 deletedAt）的项目
    if (includeArchived !== 'true') {
      projects = projects.filter((p) => !p.deletedAt);
    }

    if (status) projects = projects.filter((p) => p.status === status);
    if (type) projects = projects.filter((p) => p.type === type);
    if (search) {
      const q = search.toLowerCase();
      projects = projects.filter((p) =>
        (p.name as string).toLowerCase().includes(q) ||
        (p.code as string)?.toLowerCase().includes(q) ||
        (p.product as string)?.toLowerCase().includes(q)
      );
    }

    projects.sort((a, b) => new Date(b.updatedAt as string).getTime() - new Date(a.updatedAt as string).getTime());
    res.json({ code: 0, data: projects });
  } catch (err) {
    next(err);
  }
});

// 项目详情
router.get('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const project = (pvStore.projects as Array<Record<string, unknown>>).find((p) => p.id === req.params.id);
    if (!project) return res.status(404).json({ code: 404, message: 'project not found' });
    res.json({ code: 0, data: project });
  } catch (err) {
    next(err);
  }
});

// 创建项目
router.post('/', authenticate, requirePermission('project:create'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, code, type, product, region, description, templateId } = req.body as Record<string, unknown>;

    if (!name || typeof name !== 'string') {
      return res.status(400).json({ code: 400, message: 'name is required' });
    }
    if (name.length > 60) {
      return res.status(400).json({ code: 400, message: 'name must be 60 characters or less' });
    }
    if (!code || typeof code !== 'string') {
      return res.status(400).json({ code: 400, message: 'code is required' });
    }
    if (code.length > 30) {
      return res.status(400).json({ code: 400, message: 'code must be 30 characters or less' });
    }
    if (product === undefined || product === null || product === '') {
      return res.status(400).json({ code: 400, message: 'product is required' });
    }

    const user = req.user as AuthUser;
    const project = {
      id: `p-${Date.now()}`,
      name,
      code,
      type: type || 'ICSR',
      product,
      region: region || '',
      description: description || '',
      templateId: templateId || null,
      ownerId: user.id,
      status: 'ACTIVE',
      startDate: new Date().toISOString(),
      endDate: null,
      memberIds: [user.id],
      progress: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    (pvStore.projects as unknown[]).unshift(project);
    pvStore.addAuditLog({
      id: `l-${Date.now()}`,
      actorId: user.id,
      objectType: 'PROJECT',
      objectId: project.id,
      action: `创建项目 ${name}`,
      before: null,
      after: project,
      createdAt: new Date().toISOString(),
    });

    if (templateId) {
      const template = (pvStore.templates as Array<Record<string, unknown>>).find((t) => t.id === templateId);
      if (template && template.nodes && Array.isArray(template.nodes)) {
        const nodes = template.nodes as Array<Record<string, unknown>>;
        const projectCreatedAt = new Date(project.createdAt);

        nodes.forEach((node, index) => {
          const relativeDueDays = (node.relativeDueDays as number) || 0;
          const dueAt = new Date(projectCreatedAt);
          dueAt.setDate(dueAt.getDate() + relativeDueDays);

          const task = {
            id: `t-${Date.now()}-${index}`,
            projectId: project.id,
            title: node.title as string || 'Untitled Task',
            description: (node.description as string) || '',
            type: (node.type as string) || 'DEFAULT',
            status: 'NOT_STARTED',
            priority: 'P2',
            riskLevel: 'MEDIUM',
            assigneeId: null,
            reviewerId: null,
            dueAt: dueAt.toISOString(),
            caseId: null,
            requiredEvidence: (node.requiredEvidence as string[]) || [],
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
            id: `l-${Date.now()}-${index}`,
            actorId: user.id,
            objectType: 'TASK',
            objectId: task.id,
            action: `从模板创建任务: ${task.title}`,
            before: null,
            after: task,
            createdAt: new Date().toISOString(),
          });
        });
      }
    }

    pvStore.save();
    res.json({ code: 0, data: project });
  } catch (err) {
    next(err);
  }
});

// 更新项目
router.put('/:id', authenticate, requirePermission('project:update'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const project = (pvStore.projects as Array<Record<string, unknown>>).find((p) => p.id === req.params.id);
    if (!project) return res.status(404).json({ code: 404, message: 'project not found' });

    const user = req.user as AuthUser;
    const { name, code, type, product, region, description, memberIds } = req.body as Record<string, unknown>;
    const before = { ...project };

    if (name !== undefined) project.name = name;
    if (code !== undefined) project.code = code;
    if (type !== undefined) project.type = type;
    if (product !== undefined) project.product = product;
    if (region !== undefined) project.region = region;
    if (description !== undefined) project.description = description;
    if (memberIds !== undefined) project.memberIds = memberIds;
    project.updatedAt = new Date().toISOString();

    pvStore.addAuditLog({
      id: `l-${Date.now()}`,
      actorId: user.id,
      objectType: 'PROJECT',
      objectId: project.id,
      action: `更新项目信息`,
      before,
      after: project,
      createdAt: new Date().toISOString(),
    });
    pvStore.save();
    res.json({ code: 0, data: project });
  } catch (err) {
    next(err);
  }
});

// 更新项目状态
router.put('/:id/status', authenticate, requirePermission('project:update'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const project = (pvStore.projects as Array<Record<string, unknown>>).find((p) => p.id === req.params.id);
    if (!project) return res.status(404).json({ code: 404, message: 'project not found' });

    const user = req.user as AuthUser;
    const { status } = req.body as { status?: string };
    if (!status || !['ACTIVE', 'CLOSED'].includes(status)) {
      return res.status(400).json({ code: 400, message: 'status must be ACTIVE or CLOSED' });
    }

    const before = { status: project.status };
    project.status = status;
    project.updatedAt = new Date().toISOString();
    if (status === 'CLOSED') {
      project.endDate = new Date().toISOString();
    }

    pvStore.addAuditLog({
      id: `l-${Date.now()}`,
      actorId: user.id,
      objectType: 'PROJECT',
      objectId: project.id,
      action: `项目状态变更 ${before.status} → ${status}`,
      before,
      after: { status: project.status },
      createdAt: new Date().toISOString(),
    });
    pvStore.save();
    res.json({ code: 0, data: project });
  } catch (err) {
    next(err);
  }
});

// 归档项目（软删除）
router.delete('/:id', authenticate, requirePermission('project:delete'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const project = (pvStore.projects as Array<Record<string, unknown>>).find((p) => p.id === req.params.id);
    if (!project) return res.status(404).json({ code: 404, message: 'project not found' });

    const user = req.user as AuthUser;
    project.status = 'CLOSED';
    project.updatedAt = new Date().toISOString();
    (project as Record<string, unknown>).deletedAt = new Date().toISOString();
    (project as Record<string, unknown>).deletedBy = user.id;

    pvStore.addAuditLog({
      id: `l-${Date.now()}`,
      actorId: user.id,
      objectType: 'PROJECT',
      objectId: project.id,
      action: `归档项目`,
      before: { status: 'ACTIVE' },
      after: { status: 'CLOSED' },
      createdAt: new Date().toISOString(),
    });
    pvStore.save();
    res.json({ code: 0, data: { message: 'project archived' } });
  } catch (err) {
    next(err);
  }
});

export default router;
