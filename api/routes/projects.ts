/**
 * 项目管理 API
 * - GET  /api/projects         项目列表
 * - POST /api/projects         创建项目
 * - GET  /api/projects/:id    项目详情
 * - PUT  /api/projects/:id    更新项目
 * - PUT  /api/projects/:id/status   更新项目状态
 * - DELETE /api/projects/:id  归档项目（软删除）
 */
import { Router, type Request, type Response } from 'express';
import pvStore from '../store.js';
import { authenticate, filterVisibleProjects, requirePermission, type AuthUser } from '../middleware/auth.js';

const router = Router();

// 项目列表
router.get('/', authenticate, (req: Request, res: Response) => {
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
});

// 项目详情
router.get('/:id', authenticate, (req: Request, res: Response) => {
  const project = (pvStore.projects as Array<Record<string, unknown>>).find((p) => p.id === req.params.id);
  if (!project) return res.status(404).json({ code: 404, message: 'project not found' });
  res.json({ code: 0, data: project });
});

// 创建项目
router.post('/', authenticate, requirePermission('project:create'), (req: Request, res: Response) => {
  const { name, code, type, product, region, description, templateId } = req.body as Record<string, unknown>;
  if (!name || !code || !templateId) {
    return res.status(400).json({ code: 400, message: 'name, code, templateId required' });
  }

  const user = req.user as AuthUser;
  const project = {
    id: `p-${Date.now()}`,
    name,
    code,
    type: type || 'ICSR',
    product: product || '',
    region: region || '',
    description: description || '',
    templateId,
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
  pvStore.save();
  res.json({ code: 0, data: project });
});

// 更新项目
router.put('/:id', authenticate, requirePermission('project:update'), (req: Request, res: Response) => {
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
});

// 更新项目状态
router.put('/:id/status', authenticate, requirePermission('project:update'), (req: Request, res: Response) => {
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
});

// 归档项目（软删除）
router.delete('/:id', authenticate, requirePermission('project:delete'), (req: Request, res: Response) => {
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
});

export default router;
