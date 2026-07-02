import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  AtSign,
  Bell,
  BellOff,
  CheckCircle2,
  CheckSquare,
  Clock4,
  FileCheck,
  FileWarning,
  Filter,
  MessageSquare,
} from 'lucide-react';
import { useStore } from '@/store/useStore';
import { PageHeader } from '@/components/TopBar';
import { Avatar } from '@/components/Avatar';
import { Chip } from '@/components/Badge';
import { cn, formatDate, relativeFromNow } from '@/lib/utils';
import type { Notification } from '@/types';

const CATEGORY_CONFIG: Record<Notification['category'], { label: string; icon: React.ComponentType<{ className?: string }>; tone: string }> = {
  DEADLINE: { label: '截止提醒', icon: Clock4, tone: 'bg-amber-50 text-amber-700 border-amber-200' },
  OVERDUE: { label: '逾期通知', icon: AlertCircle, tone: 'bg-danger-500/10 text-danger-700 border-danger-500/30' },
  REVIEW: { label: '复核通知', icon: CheckCircle2, tone: 'bg-cobalt-50 text-cobalt-700 border-cobalt-200' },
  EVIDENCE: { label: '证据提醒', icon: FileWarning, tone: 'bg-violet-50 text-violet-700 border-violet-200' },
  SUBMISSION: { label: '提交通知', icon: FileCheck, tone: 'bg-teal-50 text-teal-700 border-teal-200' },
  SYSTEM: { label: '系统通知', icon: Bell, tone: 'bg-ink-100 text-ink-700 border-ink-200' },
  COMMENT: { label: '评论通知', icon: MessageSquare, tone: 'bg-sky-50 text-sky-700 border-sky-200' },
  MENTION: { label: '有人@你', icon: AtSign, tone: 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200' },
  TASK: { label: '任务通知', icon: CheckSquare, tone: 'bg-teal-50 text-teal-700 border-teal-200' },
};

const DEFAULT_CATEGORY_CONFIG = CATEGORY_CONFIG.SYSTEM;

type FilterType = 'all' | 'unread' | Notification['category'];

export function NotificationsPage() {
  const me = useStore((s) => s.currentUser)!;
  const navigate = useNavigate();
  const notifications = useStore((s) => s.notifications);
  const tasks = useStore((s) => s.tasks);
  const users = useStore((s) => s.users);
  const projects = useStore((s) => s.projects);
  const markNotificationRead = useStore((s) => s.markNotificationRead);
  const markAllNotificationsRead = useStore((s) => s.markAllNotificationsRead);

  const [filter, setFilter] = useState<FilterType>('all');

  const myNotifications = notifications.filter((n) => n.userId === me.id);

  const filteredNotifications = myNotifications.filter((n) => {
    if (filter === 'all') return true;
    if (filter === 'unread') return n.status === 'UNREAD';
    return n.category === filter;
  });

  const sortedNotifications = [...filteredNotifications].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  const unreadCount = myNotifications.filter((n) => n.status === 'UNREAD').length;

  const onMarkRead = (id: string) => {
    markNotificationRead(id);
  };

  const onMarkAllRead = () => {
    markAllNotificationsRead(me.id);
  };

  const getSourceTask = (source: string) => {
    return tasks.find((t) => t.id === source);
  };

  const getSourceProject = (source: string) => {
    return projects.find((p) => p.id === source);
  };

  return (
    <>
      <button
        onClick={() => navigate('/')}
        className="flex items-center gap-1.5 text-[12px] text-ink-500 hover:text-ink-900 mb-4 transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> 返回驾驶舱
      </button>

      <PageHeader
        title="通知中心"
        subtitle={`共 ${myNotifications.length} 条通知，${unreadCount} 条未读`}
        meta={
          <div className="flex items-center gap-2">
            <Chip tone="neutral" className="text-[11px]">
              <Bell className="w-3 h-3" /> {unreadCount} 未读
            </Chip>
          </div>
        }
        actions={
          unreadCount > 0 && (
            <button onClick={onMarkAllRead} className="btn btn-primary text-[12px]">
              <CheckCircle2 className="w-3.5 h-3.5" /> 全部标为已读
            </button>
          )
        }
      />

      <div className="flex items-center gap-2 mb-5">
        <Filter className="w-4 h-4 text-ink-500" />
        <div className="flex items-center gap-1 flex-wrap">
          {(['all', 'unread', ...Object.keys(CATEGORY_CONFIG)] as FilterType[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all',
                filter === f
                  ? 'bg-teal-600 text-white'
                  : 'bg-ink-900/[0.04] text-ink-700 hover:bg-ink-900/[0.08]',
              )}
            >
              {f === 'all' && '全部'}
              {f === 'unread' && '未读'}
              {f !== 'all' && f !== 'unread' && CATEGORY_CONFIG[f as Notification['category']]?.label}
            </button>
          ))}
        </div>
      </div>

      {sortedNotifications.length === 0 ? (
        <div className="surface p-12 text-center">
          <div className="w-14 h-14 rounded-full bg-ink-100 mx-auto flex items-center justify-center mb-4">
            <BellOff className="w-7 h-7 text-ink-400" />
          </div>
          <div className="text-[15px] font-semibold text-ink-800">暂无通知</div>
          <div className="text-[12px] text-ink-500 mt-2">系统会在任务即将到期、逾期或需要复核时发送通知</div>
        </div>
      ) : (
        <div className="space-y-3">
          {sortedNotifications.map((n) => {
            const config = CATEGORY_CONFIG[n.category] ?? DEFAULT_CATEGORY_CONFIG;
            const Icon = config.icon;
            const sourceTask = n.category !== 'SUBMISSION' ? getSourceTask(n.source) : null;
            const sourceProject = n.category === 'SUBMISSION' ? getSourceProject(n.source) : null;
            return (
              <div
                key={n.id}
                className={cn(
                  'surface p-4 rounded-xl border transition-all',
                  n.status === 'UNREAD'
                    ? 'border-teal-500/30 bg-teal-50/20'
                    : 'border-ink-900/5',
                )}
              >
                <div className="flex items-start gap-4">
                  <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center shrink-0', config.tone)}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={cn('chip text-[10.5px]', config.tone)}>{config.label}</span>
                      {n.status === 'UNREAD' && (
                        <span className="chip text-[10.5px] bg-teal-500/15 text-teal-700 border-teal-200">
                          未读
                        </span>
                      )}
                    </div>
                    <div className="text-[13.5px] font-semibold text-ink-900 leading-relaxed">
                      {n.content}
                    </div>
                    <div className="text-[11px] text-ink-500 mt-2 flex items-center gap-2 flex-wrap">
                      <span className="font-mono">{formatDate(n.createdAt, true)}</span>
                      <span className="text-ink-300">·</span>
                      <span>{relativeFromNow(n.createdAt)}</span>
                      {sourceTask && (
                        <>
                          <span className="text-ink-300">·</span>
                          <button
                            onClick={() => navigate(`/tasks/${sourceTask.id}`)}
                            className="text-cobalt-600 hover:underline"
                          >
                            查看任务
                          </button>
                        </>
                      )}
                      {sourceProject && (
                        <>
                          <span className="text-ink-300">·</span>
                          <button
                            onClick={() => navigate(`/projects/${sourceProject.id}`)}
                            className="text-cobalt-600 hover:underline"
                          >
                            查看项目
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    {n.status === 'UNREAD' && (
                      <button
                        onClick={() => onMarkRead(n.id)}
                        className="btn btn-soft text-[12px] px-3"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> 标为已读
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}