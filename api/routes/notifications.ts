/**
 * 通知 API
 * - GET  /api/notifications              通知列表
 * - PUT  /api/notifications/:id/read     标记单条已读
 * - PUT  /api/notifications/read-all     标记全部已读
 */
import { Router, type Request, type Response } from 'express';
import pvStore from '../store.js';
import { authenticate, type AuthUser } from '../middleware/auth.js';

const router = Router();

// 通知列表
router.get('/', authenticate, (req: Request, res: Response) => {
  const user = req.user as AuthUser;
  const { status } = req.query as { status?: string };
  let list = [...(pvStore.notifications as Array<Record<string, unknown>>)].filter((n) => n.userId === user.id);
  if (status) list = list.filter((n) => n.status === status);
  list.sort((a, b) => new Date(b.createdAt as string).getTime() - new Date(a.createdAt as string).getTime());
  res.json({ code: 0, data: list });
});

// 标记单条通知已读
router.put('/:id/read', authenticate, (req: Request, res: Response) => {
  const user = req.user as AuthUser;
  const notification = (pvStore.notifications as Array<Record<string, unknown>>).find(
    (n) => n.id === req.params.id && n.userId === user.id
  );
  if (!notification) return res.status(404).json({ code: 404, message: 'notification not found' });
  notification.status = 'READ';
  pvStore.save();
  res.json({ code: 0, data: notification });
});

// 标记全部通知已读
router.put('/read-all', authenticate, (req: Request, res: Response) => {
  const user = req.user as AuthUser;
  let count = 0;
  (pvStore.notifications as Array<Record<string, unknown>>).forEach((n) => {
    if (n.userId === user.id && n.status === 'UNREAD') {
      n.status = 'READ';
      count++;
    }
  });
  pvStore.save();
  res.json({ code: 0, data: { message: 'all notifications marked as read', count } });
});

export default router;