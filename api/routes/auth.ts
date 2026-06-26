/**
 * 认证 API（MVP：模拟实现）
 * - POST /api/auth/login    登录
 * - POST /api/auth/logout   登出
 * - GET  /api/auth/me       当前用户信息
 */
import { Router, type Request, type Response } from 'express';
import { generateToken, clearToken, getUsers, getUserById } from '../middleware/auth.js';

const router = Router();

// 登录
router.post('/login', (req: Request, res: Response) => {
  const { email } = req.body as { email?: string };
  if (!email) return res.status(400).json({ code: 400, message: 'email required' });

  const user = getUsers().find((u) => u.email === email);
  if (!user) return res.status(401).json({ code: 401, message: 'user not found' });

  const token = generateToken(user.id);

  res.json({
    code: 0,
    data: { token, user },
  });
});

// 登出
router.post('/logout', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    clearToken(authHeader.slice(7));
  }
  res.json({ code: 0, data: { message: 'logged out' } });
});

// 当前用户
router.get('/me', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ code: 401, message: 'not authenticated' });
  }

  const token = authHeader.slice(7);
  // 简单验证：从 token 中解析 userId
  const parts = token.split('-');
  if (parts.length < 2) return res.status(401).json({ code: 401, message: 'invalid token' });

  const userId = parts[1];
  const user = getUserById(userId);
  if (!user) return res.status(404).json({ code: 404, message: 'user not found' });

  res.json({ code: 0, data: user });
});

// 用户列表（供登录选择）
router.get('/users', (_req: Request, res: Response) => {
  res.json({ code: 0, data: getUsers() });
});

export default router;
