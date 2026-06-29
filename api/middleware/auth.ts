/**
 * 认证与权限中间件
 * - JWT Token 验证
 * - RBAC 权限控制
 */
import type { Request, Response, NextFunction } from 'express';

export type Role = 'PM' | 'PROCESSOR' | 'PHYSICIAN' | 'QA' | 'VENDOR' | 'ADMIN';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  org: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

// 模拟用户数据（生产环境应从数据库获取）
const users: AuthUser[] = [
  { id: 'u-001', name: '林婉清', email: 'lin.wq@pharma.com', role: 'PM', org: '信安医药 PV 中心' },
  { id: 'u-002', name: '赵思源', email: 'zhao.sy@pharma.com', role: 'PROCESSOR', org: '信安医药 PV 中心' },
  { id: 'u-003', name: 'Dr. Chen', email: 'chen.med@pharma.com', role: 'PHYSICIAN', org: '信安医药 PV 中心' },
  { id: 'u-004', name: '何婧仪', email: 'he.jy@pharma.com', role: 'QA', org: '信安医药 PV 中心' },
  { id: 'u-005', name: 'CRO-王启航', email: 'wang.qh@cro-partner.com', role: 'VENDOR', org: 'Eastbridge CRO' },
  { id: 'u-006', name: '吴启明', email: 'wu.qm@pharma.com', role: 'ADMIN', org: '信安医药 PV 中心' },
];

// 会话存储
const sessions: Map<string, AuthUser> = new Map();

/**
 * 生成 Token
 */
export function generateToken(userId: string): string {
  const user = users.find((u) => u.id === userId);
  if (!user) throw new Error('User not found');
  const token = `pv-${userId}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  sessions.set(token, user);
  return token;
}

/**
 * 验证 Token
 */
export function verifyToken(token: string): AuthUser | null {
  return sessions.get(token) || null;
}

/**
 * 清除 Token
 */
export function clearToken(token: string): void {
  sessions.delete(token);
}

/**
 * 获取用户列表
 */
export function getUsers(): AuthUser[] {
  return users;
}

/**
 * 根据 ID 获取用户
 */
export function getUserById(id: string): AuthUser | undefined {
  return users.find((u) => u.id === id);
}

// 权限定义
export type Permission =
  | 'project:create'
  | 'project:read'
  | 'project:update'
  | 'project:delete'
  | 'task:read'
  | 'task:update'
  | 'task:assign'
  | 'task:review'
  | 'task:upload'
  | 'audit:read'
  | 'audit:export'
  | 'template:read'
  | 'template:update'
  | 'notification:read'
  | 'ai:generate'
  | 'ai:confirm';

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  PM: ['project:create', 'project:read', 'project:update', 'project:delete', 'task:read', 'task:update', 'task:assign', 'task:review', 'task:upload', 'audit:read', 'audit:export', 'template:read', 'template:update', 'notification:read', 'ai:generate', 'ai:confirm'],
  PROCESSOR: ['project:read', 'task:read', 'task:update', 'task:upload', 'notification:read'],
  PHYSICIAN: ['project:read', 'task:read', 'task:update', 'task:review', 'task:upload', 'notification:read'],
  QA: ['project:read', 'task:read', 'task:review', 'task:upload', 'audit:read', 'audit:export', 'notification:read', 'ai:confirm'],
  VENDOR: ['project:read', 'task:read', 'task:upload', 'notification:read'],
  ADMIN: ['project:create', 'project:read', 'project:update', 'project:delete', 'task:read', 'task:update', 'task:assign', 'task:review', 'task:upload', 'audit:read', 'audit:export', 'template:read', 'template:update', 'notification:read', 'ai:generate', 'ai:confirm'],
};

/**
 * 检查用户是否具有指定权限
 */
export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

/**
 * 认证中间件
 */
export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ code: 401, message: 'Unauthorized: missing token' });
    return;
  }

  const token = authHeader.slice(7);
  const user = verifyToken(token);
  if (!user) {
    res.status(401).json({ code: 401, message: 'Unauthorized: invalid token' });
    return;
  }

  req.user = user;
  next();
}

/**
 * 权限中间件工厂
 */
export function requirePermission(...permissions: Permission[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ code: 401, message: 'Unauthorized' });
      return;
    }

    const hasAllPermissions = permissions.every((p) => hasPermission(req.user!.role, p));
    if (!hasAllPermissions) {
      res.status(403).json({ code: 403, message: 'Forbidden: insufficient permissions' });
      return;
    }

    next();
  };
}

/**
 * 角色中间件工厂
 */
export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ code: 401, message: 'Unauthorized' });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({ code: 403, message: 'Forbidden: role not allowed' });
      return;
    }

    next();
  };
}

/**
 * 项目可见性过滤
 * 根据用户角色过滤可访问的项目
 */
export function filterVisibleProjects(projects: unknown[], user: AuthUser, tasks: Map<string, unknown>): unknown[] {
  if (user.role === 'ADMIN' || user.role === 'QA') {
    return projects; // 全局可见
  }

  return (projects as Array<{ id: string; ownerId: string; memberIds?: string[] }>).filter((p) => {
    if (p.ownerId === user.id) return true;
    if (p.memberIds?.includes(user.id)) return true;
    // 检查用户是否有该项目的任务
    return Array.from(tasks.values()).some(
      (t) => (t as { projectId: string; assigneeId?: string }).projectId === p.id &&
              (t as { assigneeId?: string }).assigneeId === user.id
    );
  });
}
