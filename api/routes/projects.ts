/**
 * 项目管理 API
 * - GET /api/projects 项目列表
 * - POST /api/projects 从模板创建项目
 * - GET /api/projects/:id 项目详情
 * - GET /api/projects/:id/tasks 项目任务列表
 */
import { Router, type Request, type Response } from 'express';

const router = Router();
const g = globalThis as unknown as { __pvStore?: { projects: unknown[]; tasks: Map<string, unknown>; templates: unknown[] } };
if (!g.__pvStore) g.__pvStore = { projects: [], tasks: new Map(), templates: [] };
const store = g.__pvStore;

router.get('/', (_req: Request, res: Response) => {
  res.json({ code: 0, data: store.projects });
});

router.get('/:id', (req: Request, res: Response) => {
  const project = (store.projects as Array<Record<string, unknown>>).find((p) => p.id === req.params.id);
  if (!project) return res.status(404).json({ code: 404, message: 'project not found' });
  res.json({ code: 0, data: project });
});

router.get('/:id/tasks', (req: Request, res: Response) => {
  const tasks = Array.from(store.tasks.values()).filter((t) => (t as { projectId: string }).projectId === req.params.id);
  res.json({ code: 0, data: tasks });
});

router.post('/', (req: Request, res: Response) => {
  const { name, code, type, product, region, description, templateId } = req.body as Record<string, unknown>;
  if (!name || !code || !templateId) {
    return res.status(400).json({ code: 400, message: 'name, code, templateId required' });
  }
  const project = {
    id: `p-${Date.now()}`,
    name,
    code,
    type,
    product,
    region,
    description,
    templateId,
    ownerId: 'u-001',
    status: 'ACTIVE',
    startDate: new Date().toISOString(),
    memberIds: ['u-001'],
    progress: 0,
  };
  store.projects.unshift(project);
  res.json({ code: 0, data: project });
});

export default router;
