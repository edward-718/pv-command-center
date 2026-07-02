import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  FolderKanban,
  FileStack,
  ShieldCheck,
  Sparkles,
  Users2,
  Settings2,
  Activity,
  Bell,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useStore, roleCan, selectVisibleProjects, selectVisibleTasks } from '@/store/useStore';
import type { Role } from '@/types';

type NavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
  visibleFor: Role[] | 'all';
};

export function Sidebar() {
  const me = useStore((s) => s.currentUser);
  const tasks = useStore((s) => s.tasks);
  const projects = useStore((s) => s.projects);
  const auditLogs = useStore((s) => s.auditLogs);
  const attachments = useStore((s) => s.attachments);
  const notifications = useStore((s) => s.notifications);
  const location = useLocation();
  if (!me) return null;

  // 使用可见性过滤器，确保统计数据只包含用户有权限查看的任务和项目
  const visibleTasks = selectVisibleTasks({ ...useStore.getState(), currentUser: me }, me);
  const visibleProjects = selectVisibleProjects({ ...useStore.getState(), currentUser: me }, me);
  const visibleProjectIds = new Set(visibleProjects.map((p) => p.id));
  const visibleTaskIds = new Set(visibleTasks.map((t) => t.id));
  const visibleAuditLogs = auditLogs.filter((l) => {
    if (l.objectType === 'PROJECT') return visibleProjectIds.has(l.objectId);
    if (l.objectType === 'TASK') return visibleTaskIds.has(l.objectId);
    if (l.objectType === 'REVIEW') return visibleTaskIds.has(l.objectId);
    if (l.objectType === 'ATTACHMENT') {
      const att = attachments.find((a) => a.id === l.objectId);
      return att ? visibleTaskIds.has(att.taskId) : false;
    }
    if (l.objectType === 'TEMPLATE') return me.role === 'PM' || me.role === 'ADMIN' || me.role === 'PROCESSOR';
    if (l.objectType === 'EXPORT') return roleCan(me.role, 'audit_export');
    return false;
  });
  const overdue = visibleTasks.filter((t) => t.status !== 'DONE' && new Date(t.dueAt).getTime() < Date.now()).length;
  const inReview = visibleTasks.filter((t) => t.status === 'IN_REVIEW').length;
  const activeProjects = visibleProjects.filter((p) => p.status === 'ACTIVE').length;
  const unreadNotifications = notifications.filter((n) => n.userId === me.id && n.status === 'UNREAD').length;

  const items: NavItem[] = [
    { to: '/', label: '项目驾驶舱', icon: LayoutDashboard, badge: overdue || undefined, visibleFor: 'all' },
    { to: '/projects', label: '项目管理', icon: FolderKanban, badge: activeProjects, visibleFor: 'all' },
    { to: '/notifications', label: '通知中心', icon: Bell, badge: unreadNotifications || undefined, visibleFor: 'all' },
    { to: '/templates', label: '项目模板', icon: FileStack, visibleFor: ['PM', 'ADMIN', 'PROCESSOR'] },
    { to: '/audit', label: '审计中心', icon: ShieldCheck, badge: visibleAuditLogs.length, visibleFor: ['PM', 'QA', 'ADMIN'] },
    { to: '/ai', label: 'AI 助手', icon: Sparkles, visibleFor: 'all' },
    { to: '/vendors', label: '供应商空间', icon: Users2, visibleFor: ['PM', 'VENDOR', 'ADMIN'] },
    { to: '/settings', label: '系统配置', icon: Settings2, visibleFor: ['ADMIN'] },
  ];

  const visibleItems = items.filter(
    (it) => it.visibleFor === 'all' || it.visibleFor.includes(me.role),
  );

  return (
    <aside className="w-60 shrink-0 border-r border-ink-900/5 bg-white/60 backdrop-blur-sm flex flex-col">
      <div className="px-5 pt-6 pb-5 border-b border-ink-900/5">
        <div className="flex items-center gap-2.5">
          <div className="relative w-9 h-9 rounded-xl bg-gradient-to-br from-teal-600 to-cobalt-600 flex items-center justify-center shadow-soft">
            <Activity className="w-5 h-5 text-white" />
            <div className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-amber-500 ring-2 ring-white" />
          </div>
          <div>
            <div className="font-display text-[15px] font-semibold tracking-tight text-ink-900">PV智枢</div>
            <div className="text-[11px] text-ink-500 leading-tight">药物警戒 · 项目指挥中心</div>
          </div>
        </div>
      </div>

      <nav className="px-3 py-4 flex-1 overflow-y-auto scrollbar-thin">
        <div className="text-[10px] uppercase tracking-widest text-ink-400 px-2 mb-2">工作台</div>
        <ul className="space-y-0.5">
          {visibleItems.map((it) => {
            const Icon = it.icon;
            const isActive = location.pathname === it.to || (it.to !== '/' && location.pathname.startsWith(it.to));
            return (
              <li key={it.to}>
                <NavLink
                  to={it.to}
                  className={cn(
                    'flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-all',
                    isActive
                      ? 'bg-teal-600 text-white shadow-soft'
                      : 'text-ink-700 hover:bg-ink-900/[0.04]',
                  )}
                >
                  <Icon className="w-4 h-4" />
                  <span className="flex-1">{it.label}</span>
                  {it.badge !== undefined && it.badge > 0 && (
                    <span
                      className={cn(
                        'min-w-[20px] h-[18px] rounded-full text-[10px] font-semibold flex items-center justify-center px-1.5',
                        isActive ? 'bg-white/20 text-white' : 'bg-amber-500/15 text-amber-700',
                      )}
                    >
                      {it.badge > 99 ? '99+' : it.badge}
                    </span>
                  )}
                </NavLink>
              </li>
            );
          })}
        </ul>

        {roleCan(me.role, 'create_project') && (
          <div className="mt-6 px-2">
            <div className="text-[10px] uppercase tracking-widest text-ink-400 mb-2">快捷操作</div>
            <NavLink
              to="/projects/new"
              className="block rounded-xl border border-dashed border-ink-900/15 px-3 py-3 text-[12px] text-ink-600 hover:border-teal-500/40 hover:bg-teal-50/30 transition-all"
            >
              <div className="font-medium text-ink-800">+ 新建 PV 项目</div>
              <div className="text-ink-500 mt-0.5">从模板一键创建</div>
            </NavLink>
          </div>
        )}
      </nav>

      <div className="px-4 py-4 border-t border-ink-900/5">
        <div className="rounded-xl bg-gradient-to-br from-cobalt-600 to-teal-600 p-4 text-white">
          <div className="text-[10px] uppercase tracking-widest text-white/70 mb-1.5">合规声明</div>
          <p className="text-[12px] leading-relaxed text-white/95">
            AI 输出仅为草稿，不替代医学判断。所有变更均留痕至审计日志。
          </p>
        </div>
      </div>
    </aside>
  );
}
