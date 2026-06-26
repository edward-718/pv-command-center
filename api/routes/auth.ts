/**
 * 认证 API（MVP：模拟实现）
 * - POST /api/auth/login    登录
 * - POST /api/auth/logout   登出
 * - GET  /api/auth/me       当前用户信息
 */
import { Router, type Request, type Response } from 'express';

const router = Router();

// MVP 模拟用户数据（生产环境应连接数据库）
type User = {
  id: string;
  name: string;
  email: string;
  role: string;
  org: string;
};

const mockUsers: User[] = [
  { id: 'u-001', name: '林婉清', email: 'lin.wq@pharma.com', role: 'PM', org: '信安医药 PV 中心' },
  { id: 'u-002', name: '赵思源', email: 'zhao.sy@pharma.com', role: 'PROCESSOR', org: '信安医药 PV 中心' },
  { id: 'u-003', name: 'Dr. Chen', email: 'chen.med@pharma.com', role: 'PHYSICIAN', org: '信安医药 PV 中心' },
  { id: 'u-004', name: '何婧仪', email: 'he.jy@pharma.com', role: 'QA', org: '信安医药 PV 中心' },
  { id: 'u-005', name: 'CRO-王启航', email: 'wang.qh@cro-partner.com', role: 'VENDOR', org: 'Eastbridge CRO' },
  { id: 'u-006', name: '吴启明', email: 'wu.qm@pharma.com', role: 'ADMIN', org: '信安医药 PV 中心' },
];

// 内存会话存储（MVP）
const sessions: Map<string, string> = new Map(); // token -> userId

// 简单 Token 生成
function generateToken(userId: string): string {
  return `token-${userId}-${Date.now()}`;
}

// 登录
router.post('/login', (req: Request, res: Response) => {
  const { email } = req.body as { email?: string };
  if (!email) return res.status(400).json({ code: 400, message: 'email required' });

  const user = mockUsers.find((u) => u.email === email);
  if (!user) return res.status(401).json({ code: 401, message: 'user not found' });

  const token = generateToken(user.id);
  sessions.set(token, user.id);

  res.json({
    code: 0,
    data: {
      token,
      user,
    },
  });
});

// 登出
router.post('/logout', (req: Request, res: Response) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (token) sessions.delete(token);
  res.json({ code: 0, data: { message: 'logged out' } });
});

// 当前用户
router.get('/me', (req: Request, res: Response) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ code: 401, message: 'not authenticated' });

  const userId = sessions.get(token);
  if (!userId) return res.status(401).json({ code: 401, message: 'invalid token' });

  const user = mockUsers.find((u) => u.id === userId);
  if (!user) return res.status(404).json({ code: 404, message: 'user not found' });

  res.json({ code: 0, data: user });
});

// 用户列表（供登录选择）
router.get('/users', (_req: Request, res: Response) => {
  res.json({ code: 0, data: mockUsers });
});

export default router;
