/**
 * 用户 API
 * - GET  /api/users              用户列表
 * - GET  /api/users/:id          用户详情
 */
import { Router, type Request, type Response } from 'express';
import pvStore from '../store.js';
import { authenticate, requirePermission, getUsers } from '../middleware/auth.js';

const router = Router();

// 用户列表
router.get('/', authenticate, (_req: Request, res: Response) => {
  res.json({ code: 0, data: getUsers() });
});

// 用户详情
router.get('/:id', authenticate, (req: Request, res: Response) => {
  const user = getUsers().find((u) => u.id === req.params.id);
  if (!user) return res.status(404).json({ code: 404, message: 'user not found' });
  res.json({ code: 0, data: user });
});

export default router;
