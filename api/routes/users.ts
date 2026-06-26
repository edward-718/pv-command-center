/**
 * 用户与通知 API
 * - GET /api/users
 * - GET /api/notifications
 */
import { Router, type Request, type Response } from 'express';

const router = Router();
const g = globalThis as unknown as { __pvStore?: { users: unknown[]; notifications: unknown[] } };
if (!g.__pvStore) g.__pvStore = { users: [], notifications: [] };
const store = g.__pvStore;

// 用户
router.get('/', (_req: Request, res: Response) => {
  res.json({ code: 0, data: store.users });
});

// 通知
router.get('/notifications', (req: Request, res: Response) => {
  const { userId } = req.query as { userId?: string };
  let list = [...(store.notifications as Array<Record<string, unknown>>)];
  if (userId) list = list.filter((n) => n.userId === userId);
  res.json({ code: 0, data: list });
});

export default router;
