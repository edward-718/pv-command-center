/**
 * 用户与通知 API
 * - GET  /api/users              用户列表
 * - GET  /api/users/:id          用户详情
 * - GET  /api/notifications      通知列表
 * - PUT  /api/notifications/:id/read      标记单条已读
 * - PUT  /api/notifications/read-all     标记全部已读
 */
import { Router, type Request, type Response } from 'express';

const router = Router();
const g = globalThis as unknown as { __pvStore?: { users: unknown[]; notifications: unknown[] } };
if (!g.__pvStore) g.__pvStore = { users: [], notifications: [] };
const store = g.__pvStore;

// 用户列表
router.get('/', (_req: Request, res: Response) => {
  res.json({ code: 0, data: store.users });
});

// 用户详情
router.get('/:id', (req: Request, res: Response) => {
  const user = (store.users as Array<Record<string, unknown>>).find((u) => u.id === req.params.id);
  if (!user) return res.status(404).json({ code: 404, message: 'user not found' });
  res.json({ code: 0, data: user });
});

// 通知列表（支持按用户筛选）
router.get('/notifications', (req: Request, res: Response) => {
  const { userId, status } = req.query as { userId?: string; status?: string };
  let list = [...(store.notifications as Array<Record<string, unknown>>)];
  if (userId) list = list.filter((n) => n.userId === userId);
  if (status) list = list.filter((n) => n.status === status);
  // 按时间倒序
  list.sort((a, b) => new Date(b.createdAt as string).getTime() - new Date(a.createdAt as string).getTime());
  res.json({ code: 0, data: list });
});

// 标记单条通知已读
router.put('/notifications/:id/read', (req: Request, res: Response) => {
  const notification = (store.notifications as Array<Record<string, unknown>>).find((n) => n.id === req.params.id);
  if (!notification) return res.status(404).json({ code: 404, message: 'notification not found' });
  notification.status = 'READ';
  res.json({ code: 0, data: notification });
});

// 标记全部通知已读
router.put('/notifications/read-all', (req: Request, res: Response) => {
  const { userId } = req.body as { userId?: string };
  if (!userId) return res.status(400).json({ code: 400, message: 'userId required' });
  (store.notifications as Array<Record<string, unknown>>).forEach((n) => {
    if (n.userId === userId) n.status = 'READ';
  });
  res.json({ code: 0, data: { message: 'all notifications marked as read' } });
});

export default router;
