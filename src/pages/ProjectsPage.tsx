import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarClock, Filter, Plus, Search, Users2 } from 'lucide-react';
import { useStore, selectVisibleProjects, selectVisibleTasks, roleCan } from '@/store/useStore';
import { PageHeader } from '@/components/TopBar';
import { AvatarStack, RoleChip } from '@/components/Avatar';
import { Chip, StatusBadge, RiskTag } from '@/components/Badge';
import { cn, formatDate, relativeFromNow } from '@/lib/utils';
import { PROJECT_TYPE_LABEL, type ProjectType, type TaskStatus } from '@/types';

const TYPE_TONE: Record<ProjectType, string> = {
  ICSR: 'bg-cobalt-50 text-cobalt-700 border-cobalt-200',
  INQUIRY: 'bg-amber-500/10 text-amber-700 border-amber-500/30',
  CAPA: 'bg-teal-50 text-teal-700 border-teal-200',
  PSUR: 'bg-ink-100 text-ink-700 border-ink-200',
};

export function ProjectsPage() {
  const me = useStore((s) => s.currentUser)!;
  const allProjects = useStore((s) => s.projects);
  const allTasks = useStore((s) => s.tasks);
  const users = useStore((s) => s.users);
  const navigate = useNavigate();

  const projects = useMemo(
    () => selectVisibleProjects({ ...useStore.getState(), currentUser: me }, me),
    [me, allProjects, allTasks],
  );
  const tasks = useMemo(
    () => selectVisibleTasks({ ...useStore.getState(), currentUser: me }, me),
    [me, allProjects, allTasks],
  );

  const [q, setQ] = useState('');
  const [type, setType] = useState<ProjectType | 'ALL'>('ALL');
  const [status, setStatus] = useState<TaskStatus | 'ALL'>('ALL');

  const filtered = projects.filter((p) => {
    if (type !== 'ALL' && p.type !== type) return false;
    if (q && !`${p.name} ${p.code} ${p.product}`.toLowerCase().includes(q.toLowerCase())) return false;
    if (status !== 'ALL') {
      const has = tasks.some((t) => t.projectId === p.id && t.status === status);
      if (!has) return false;
    }
    return true;
  });

  return (
    <>
      <PageHeader
        title="项目管理"
        subtitle={`共 ${projects.length} 个项目，${tasks.filter((t) => t.status !== 'DONE').length} 个未完成任务。按类型、状态或关键词筛选。`}
        actions={
          roleCan(me.role, 'create_project') && (
            <button className="btn btn-primary" onClick={() => navigate('/projects/new')}>
              <Plus className="w-3.5 h-3.5" /> 新建项目
            </button>
          )
        }
      />

      <div className="surface p-3.5 mb-5 flex items-center gap-2.5 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="搜索项目名称 / 编号 / 产品"
            className="w-full bg-ink-900/[0.03] border border-transparent focus:border-cobalt-500/40 focus:bg-white rounded-lg pl-9 pr-3 py-1.5 text-[12.5px] outline-none transition-all"
          />
        </div>
        <div className="flex items-center gap-1.5">
          <Filter className="w-3.5 h-3.5 text-ink-500" />
          <span className="text-[11.5px] text-ink-500">类型</span>
          {(['ALL', 'ICSR', 'INQUIRY', 'CAPA', 'PSUR'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setType(t)}
              className={cn(
                'chip transition-all',
                type === t
                  ? 'bg-ink-900 text-white border-ink-900'
                  : 'bg-ink-100 text-ink-600 border-ink-100 hover:bg-ink-200',
              )}
            >
              {t === 'ALL' ? '全部' : PROJECT_TYPE_LABEL[t as ProjectType]}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[11.5px] text-ink-500">任务状态</span>
          {(['ALL', 'IN_PROGRESS', 'IN_REVIEW', 'NEEDS_INFO', 'NOT_STARTED', 'DONE'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={cn(
                'chip transition-all',
                status === s
                  ? 'bg-ink-900 text-white border-ink-900'
                  : 'bg-ink-100 text-ink-600 border-ink-100 hover:bg-ink-200',
              )}
            >
              {s === 'ALL' ? '全部' : s === 'IN_PROGRESS' ? '处理中' : s === 'IN_REVIEW' ? '待复核' : s === 'NEEDS_INFO' ? '需补充' : s === 'NOT_STARTED' ? '未开始' : '已完成'}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
        {filtered.map((p) => {
          const projectTasks = tasks.filter((t) => t.projectId === p.id);
          const done = projectTasks.filter((t) => t.status === 'DONE').length;
          const progress = done / Math.max(projectTasks.length, 1);
          const overdue = projectTasks.filter((t) => t.status !== 'DONE' && new Date(t.dueAt) < new Date()).length;
          return (
            <button
              key={p.id}
              onClick={() => navigate(`/projects/${p.id}`)}
              className="surface-soft p-5 text-left hover:shadow-pop hover:-translate-y-0.5 transition-all"
            >
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <span className={cn('chip chip-mono', TYPE_TONE[p.type])}>{PROJECT_TYPE_LABEL[p.type]}</span>
                <span className="text-[10.5px] text-ink-500 font-mono">{p.code}</span>
                <span
                  className={cn(
                    'ml-auto chip text-[10.5px]',
                    p.status === 'ACTIVE' ? 'bg-teal-50 text-teal-700 border-teal-200' : 'bg-ink-100 text-ink-600',
                  )}
                >
                  {p.status === 'ACTIVE' ? '进行中' : '已关闭'}
                </span>
              </div>
              <h3 className="font-display text-[15px] font-semibold text-ink-900 leading-snug text-pretty line-clamp-2">
                {p.name}
              </h3>
              <div className="mt-2.5 text-[11.5px] text-ink-500 line-clamp-2 leading-relaxed">{p.description}</div>

              <div className="mt-4 grid grid-cols-3 gap-2.5 text-center">
                <Metric label="任务" value={projectTasks.length} />
                <Metric label="已完成" value={done} tone="teal" />
                <Metric label="逾期" value={overdue} tone={overdue > 0 ? 'danger' : 'ink'} />
              </div>

              <div className="mt-3 h-1.5 bg-ink-100 rounded-full overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full transition-all',
                    progress === 1 ? 'bg-teal-500' : progress > 0.6 ? 'bg-cobalt-500' : progress > 0.3 ? 'bg-amber-500' : 'bg-danger-500',
                  )}
                  style={{ width: `${Math.max(progress * 100, 4)}%` }}
                />
              </div>

              <div className="mt-3.5 flex items-center justify-between text-[11px] text-ink-500">
                <div className="flex items-center gap-1.5">
                  <Users2 className="w-3 h-3" />
                  <AvatarStack userIds={p.memberIds} max={3} />
                </div>
                <div className="flex items-center gap-1 font-mono">
                  <CalendarClock className="w-3 h-3" />
                  {relativeFromNow(p.endDate)}
                </div>
              </div>
            </button>
          );
        })}

        {filtered.length === 0 && (
          <div className="col-span-full surface p-10 text-center">
            <div className="text-[14px] font-semibold text-ink-800">没有匹配的项目</div>
            <div className="text-[12px] text-ink-500 mt-1.5">尝试调整筛选条件或清空搜索</div>
          </div>
        )}
      </div>
    </>
  );
}

function Metric({ label, value, tone = 'ink' }: { label: string; value: number; tone?: 'teal' | 'danger' | 'ink' }) {
  const color = tone === 'teal' ? 'text-teal-700' : tone === 'danger' ? 'text-danger-600' : 'text-ink-800';
  return (
    <div className="rounded-lg bg-ink-900/[0.025] border border-ink-900/5 py-1.5">
      <div className={cn('font-display text-[16px] font-semibold leading-none', color)}>{value}</div>
      <div className="text-[10.5px] text-ink-500 mt-0.5">{label}</div>
    </div>
  );
}
