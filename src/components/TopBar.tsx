import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, ChevronDown, LogOut, Search, Sparkles, RotateCcw } from 'lucide-react';
import { useStore, roleCan, selectVisibleProjects, selectVisibleTasks } from '@/store/useStore';
import { ROLE_LABEL, type Role } from '@/types';
import { Avatar } from './Avatar';
import { cn, formatDate, relativeFromNow } from '@/lib/utils';

export function TopBar() {
  const me = useStore((s) => s.currentUser);
  const users = useStore((s) => s.users);
  const notifications = useStore((s) => s.notifications);
  const tasks = useStore((s) => s.tasks);
  const projects = useStore((s) => s.projects);
  const switchUser = useStore((s) => s.switchUser);
  const logout = useStore((s) => s.logout);
  const markAllNotificationsRead = useStore((s) => s.markAllNotificationsRead);
  const markNotificationRead = useStore((s) => s.markNotificationRead);
  const resetData = useStore((s) => s.resetData);
  const navigate = useNavigate();

  const [userOpen, setUserOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState('');
  const userRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (userRef.current && !userRef.current.contains(e.target as Node)) setUserOpen(false);
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  if (!me) return null;

  const myNotifs = notifications
    .filter((n) => n.userId === me.id)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const unread = myNotifs.filter((n) => n.status === 'UNREAD').length;

  const notifCategoryTone: Record<string, string> = {
    DEADLINE: 'bg-amber-500',
    OVERDUE: 'bg-danger-500',
    REVIEW: 'bg-cobalt-500',
    EVIDENCE: 'bg-violet-500',
    SUBMISSION: 'bg-teal-500',
    SYSTEM: 'bg-ink-400',
    COMMENT: 'bg-sky-500',
    MENTION: 'bg-fuchsia-500',
    TASK: 'bg-emerald-500',
  };

  // 搜索结果
  const searchResults = search.trim() && me
    ? {
        tasks: selectVisibleTasks({ ...useStore.getState(), currentUser: me }, me)
          .filter(
            (t) =>
              t.title.toLowerCase().includes(search.toLowerCase()) ||
              t.description.toLowerCase().includes(search.toLowerCase()) ||
              (t.caseId ?? '').toLowerCase().includes(search.toLowerCase()),
          )
          .slice(0, 5),
        projects: selectVisibleProjects({ ...useStore.getState(), currentUser: me }, me)
          .filter(
            (p) =>
              p.name.toLowerCase().includes(search.toLowerCase()) ||
              p.code.toLowerCase().includes(search.toLowerCase()),
          )
          .slice(0, 4),
      }
    : null;

  return (
    <header className="h-14 border-b border-ink-900/5 bg-white/70 backdrop-blur-sm flex items-center px-5 sticky top-0 z-30">
      <div className="flex-1 flex items-center gap-3">
        <div className="relative max-w-md w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-400" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setSearchOpen(true);
            }}
            onFocus={() => setSearchOpen(true)}
            placeholder="搜索项目、病例编号、任务标题…"
            className="w-full bg-ink-900/[0.03] border border-transparent hover:border-ink-900/10 focus:border-cobalt-500/40 focus:bg-white focus:shadow-soft rounded-lg pl-9 pr-3 py-1.5 text-[13px] text-ink-800 placeholder:text-ink-400 transition-all outline-none"
          />

          {searchOpen && search.trim() && searchResults && (
            <div className="absolute top-full mt-1.5 left-0 right-0 surface p-2 max-h-[480px] overflow-y-auto scrollbar-thin z-40 animate-fade-in">
              {searchResults.projects.length === 0 && searchResults.tasks.length === 0 ? (
                <div className="px-3 py-6 text-center text-[12px] text-ink-500">没有匹配结果</div>
              ) : (
                <>
                  {searchResults.projects.length > 0 && (
                    <div className="px-2 pt-1.5 pb-1 text-[10px] uppercase tracking-widest text-ink-400">项目</div>
                  )}
                  {searchResults.projects.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => {
                        navigate(`/projects/${p.id}`);
                        setSearchOpen(false);
                        setSearch('');
                      }}
                      className="w-full text-left px-2.5 py-1.5 rounded-md hover:bg-ink-900/[0.04] flex items-center gap-2"
                    >
                      <div className="w-1.5 h-1.5 rounded-full bg-cobalt-500" />
                      <div className="flex-1 min-w-0">
                        <div className="text-[12.5px] text-ink-800 truncate">{p.name}</div>
                        <div className="text-[10.5px] text-ink-500 font-mono">{p.code}</div>
                      </div>
                    </button>
                  ))}
                  {searchResults.tasks.length > 0 && (
                    <div className="px-2 pt-2 pb-1 text-[10px] uppercase tracking-widest text-ink-400">任务</div>
                  )}
                  {searchResults.tasks.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => {
                        navigate(`/tasks/${t.id}`);
                        setSearchOpen(false);
                        setSearch('');
                      }}
                      className="w-full text-left px-2.5 py-1.5 rounded-md hover:bg-ink-900/[0.04] flex items-center gap-2"
                    >
                      <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                      <div className="flex-1 min-w-0">
                        <div className="text-[12.5px] text-ink-800 truncate">{t.title}</div>
                        {t.caseId && (
                          <div className="text-[10.5px] text-ink-500 font-mono">{t.caseId}</div>
                        )}
                      </div>
                    </button>
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => navigate('/ai')}
          className="hidden md:flex items-center gap-1.5 text-[12px] font-medium text-ink-700 px-2.5 py-1.5 rounded-lg hover:bg-cobalt-50/60 hover:text-cobalt-700 transition-colors"
        >
          <Sparkles className="w-3.5 h-3.5" />
          AI 工作台
        </button>

        <div ref={notifRef} className="relative">
          <button
            onClick={() => setNotifOpen((v) => !v)}
            className="relative w-8 h-8 rounded-lg hover:bg-ink-900/[0.04] flex items-center justify-center transition-colors"
            aria-label={`通知${unread > 0 ? `，${unread}条未读` : ''}`}
          >
            <Bell className="w-4 h-4 text-ink-700" aria-hidden="true" />
            {unread > 0 && (
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-danger-500 ring-2 ring-white" />
            )}
          </button>
          {notifOpen && (
            <div className="absolute right-0 top-full mt-1.5 w-[360px] surface p-2 z-40 animate-fade-in">
              <div className="flex items-center justify-between px-2.5 pt-1.5 pb-2">
                <div className="text-[12px] font-semibold text-ink-800">通知 · {unread} 未读</div>
                <button
                  onClick={() => markAllNotificationsRead(me.id)}
                  className="text-[11px] text-cobalt-600 hover:underline"
                >
                  全部标为已读
                </button>
              </div>
              <div className="max-h-[400px] overflow-y-auto scrollbar-thin">
                {myNotifs.length === 0 ? (
                  <div className="px-3 py-8 text-center text-[12px] text-ink-500">暂无通知</div>
                ) : (
                  myNotifs.map((n) => (
                    <button
                      key={n.id}
                      onClick={() => {
                        markNotificationRead(n.id);
                        if (n.source && n.source !== 'system' && n.source !== 'batch') {
                          if (n.category === 'SUBMISSION') {
                            navigate(`/projects/${n.source}`);
                          } else {
                            navigate(`/tasks/${n.source}`);
                          }
                          setNotifOpen(false);
                        } else {
                          setNotifOpen(false);
                        }
                      }}
                      className={cn(
                        'w-full text-left px-2.5 py-2 rounded-md hover:bg-ink-900/[0.04] flex gap-2.5',
                        n.status === 'UNREAD' && 'bg-cobalt-50/30',
                      )}
                    >
                      <div
                        className={cn(
                          'w-1 self-stretch rounded-full',
                          notifCategoryTone[n.category] ?? 'bg-ink-400',
                        )}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-[12.5px] text-ink-800 leading-snug">{n.content}</div>
                        <div className="text-[10.5px] text-ink-500 mt-1 font-mono">
                          {formatDate(n.createdAt, true)} · {relativeFromNow(n.createdAt)}
                        </div>
                      </div>
                      {n.status === 'UNREAD' && <div className="w-1.5 h-1.5 rounded-full bg-cobalt-500 mt-1.5" />}
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <div ref={userRef} className="relative">
          <button
            onClick={() => setUserOpen((v) => !v)}
            className="flex items-center gap-2 pl-1.5 pr-2 py-1 rounded-lg hover:bg-ink-900/[0.04] transition-colors"
          >
            <Avatar userId={me.id} size={28} />
            <div className="hidden md:block text-left">
              <div className="text-[12.5px] font-semibold text-ink-800 leading-tight">{me.name}</div>
              <div className="text-[10.5px] text-ink-500 leading-tight">{ROLE_LABEL[me.role]}</div>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-ink-500" />
          </button>
          {userOpen && (
            <div className="absolute right-0 top-full mt-1.5 w-[280px] surface p-2 z-40 animate-fade-in">
              <div className="px-2.5 pt-1.5 pb-2">
                <div className="text-[12px] font-semibold text-ink-800">切换角色（演示）</div>
                <div className="text-[10.5px] text-ink-500 mt-0.5">选择不同角色查看权限差异</div>
              </div>
              <div className="max-h-[280px] overflow-y-auto scrollbar-thin">
                {users.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => {
                      switchUser(u.id);
                      setUserOpen(false);
                    }}
                    className={cn(
                      'w-full px-2.5 py-1.5 rounded-md hover:bg-ink-900/[0.04] flex items-center gap-2 text-left',
                      u.id === me.id && 'bg-teal-50/50',
                    )}
                  >
                    <Avatar userId={u.id} size={24} />
                    <div className="flex-1 min-w-0">
                      <div className="text-[12.5px] text-ink-800">{u.name}</div>
                      <div className="text-[10.5px] text-ink-500">{ROLE_LABEL[u.role]} · {u.org}</div>
                    </div>
                    {u.id === me.id && <div className="w-1.5 h-1.5 rounded-full bg-teal-500" />}
                  </button>
                ))}
              </div>
              <div className="border-t border-ink-900/5 mt-1 pt-1 flex items-center justify-between">
                <button
                  onClick={() => {
                    resetData();
                    logout();
                    setUserOpen(false);
                  }}
                  className="flex-1 flex items-center gap-1.5 px-2.5 py-1.5 rounded-md hover:bg-ink-900/[0.04] text-[12px] text-ink-700"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  重置演示数据
                </button>
                <button
                  onClick={() => {
                    logout();
                    setUserOpen(false);
                  }}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md hover:bg-danger-500/10 text-[12px] text-danger-700"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  退出
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
  meta,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  meta?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-6 mb-6">
      <div>
        <h1 className="font-display text-[26px] font-semibold tracking-tight text-ink-900 leading-tight">
          {title}
        </h1>
        {subtitle && <p className="text-[13.5px] text-ink-500 mt-1.5 max-w-2xl">{subtitle}</p>}
        {meta && <div className="mt-3 flex items-center gap-2 flex-wrap">{meta}</div>}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}
