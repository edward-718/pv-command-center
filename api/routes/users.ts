/**
 * 用户与通知 API
 * - GET  /api/users              用户列表
 * - GET  /api/users/:id          用户详情
 * - GET  /api/notifications      通知列表
 * - PUT  /api/notifications/:id/read      标记单条已读
 * - PUT  /api/notifications/read-all     标记全部已读
 */
import { Router, type Request, type Response } from 'express';
import pvStore from '../store.js';
import { authenticate, requirePermission, type AuthUser } from '../middleware/auth.js';

const router = Router();

// 用户列表（需认证）
router.get('/', authenticate, (_req: Request, res: Response) => {
  res.json({ code: 0, data: pvStore.users });
});

// 用户详情（需认证）
router.get('/:id', authenticate, (req: Request, res: Response) => {
  const user = (pvStore.users as Array<Record<string, unknown>>).find((u) => u.id === req.params.id);
  if (!user) return res.status(404).json({ code: 404, message: 'user not found' });
  res.json({ code: 0, data: user });
});

// 通知列表（需认证）
router.get('/notifications', authenticate, (req: Request, res: Response) => {
  const user = req.user as AuthUser;
  const { status } = req.query as { status?: string };
  let list = [...(pvStore.notifications as Array<Record<string, unknown>>)].filter((n) => n.userId === user.id);
  if (status) list = list.filter((n) => n.status === status);
  list.sort((a, b) => new Date(b.createdAt as string).getTime() - new Date(a.createdAt as string).getTime());
  res.json({ code: 0, data: list });
});

// 标记单条通知已读（需认证）
router.put('/notifications/:id/read', authenticate, (req: Request, res: Response) => {
  const notification = (pvStore.notifications as Array<Record<string, unknown>>).find((n) => n.id === req.params.id);
  if (!notification) return res.status(404).json({ code: 404, message: 'notification not found' });
  notification.status = 'READ';
  pvStore.save();
  res.json({ code: 0, data: notification });
});

// 标记全部通知已读（需认证）
router.put('/notifications/read-all', authenticate, (req: Request, res: Response) => {
  const user = req.user as AuthUser;
  (pvStore.notifications as Array<Record<string, unknown>>).forEach((n) => {
    if (n.userId === user.id) n.status = 'READ';
  });
  pvStore.save();
  res.json({ code: 0, data: { message: 'all notifications marked as read' } });
});

export default router;
