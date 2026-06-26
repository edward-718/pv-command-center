import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  CircleDot,
  ClipboardList,
  Clock4,
  FileText,
  Flame,
  ListChecks,
  ShieldAlert,
  Sparkles,
  TrendingUp,
  Users2,
} from 'lucide-react';
import { useStore, selectVisibleProjects, selectVisibleTasks, roleCan } from '@/store/useStore';
import { PageHeader } from '@/components/TopBar';
import { Avatar, AvatarStack, RoleChip } from '@/components/Avatar';
import { Chip, PriorityTag, RiskTag, SeverityTag, StatusBadge } from '@/components/Badge';
import { cn, daysFromNow, dueUrgency, formatDate, relativeFromNow } from '@/lib/utils';
import { PROJECT_TYPE_LABEL, type ProjectType, type Task, type User } from '@/types';

const PROJECT_TYPE_TONE: Record<ProjectType, string> = {
  ICSR: 'bg-cobalt-50 text-cobalt-700 border-cobalt-200',
  INQUIRY: 'bg-amber-500/10 text-amber-700 border-amber-500/30',
  CAPA: 'bg-teal-50 text-teal-700 border-teal-200',
  PSUR: 'bg-ink-100 text-ink-700 border-ink-200',
};

export function DashboardPage() {
  const me = useStore((s) => s.currentUser);
  const navigate = useNavigate();
  const allProjects = useStore((s) => s.projects);
  const allTasks = useStore((s) => s.tasks);
  const users = useStore((s) => s.users);
  const templates = useStore((s) => s.templates);
  const auditLogs = useStore((s) => s.auditLogs);

  if (!me) return null;

  const projects = useMemo(() => selectVisibleProjects({ ...useStore.getState(), currentUser: me }, me), [me, allProjects, allTasks]);
  const tasks = useMemo(() => selectVisibleTasks({ ...useStore.getState(), currentUser: me }, me), [me, allProjects, allTasks]);

  const overdueTasks = tasks.filter((t) => t.status !== 'DONE' && daysFromNow(t.dueAt) < 0);
  const dueSoonTasks = tasks.filter((t) => t.status !== 'DONE' && daysFromNow(t.dueAt) >= 0 && daysFromNow(t.dueAt) <= 3);
  const inReviewTasks = tasks.filter((t) => t.status === 'IN_REVIEW');
  const doneTasks = tasks.filter((t) => t.status === 'DONE');
  const highRisk = tasks.filter((t) => t.riskLevel === 'HIGH' && t.status !== 'DONE');
  const missingEvidence = tasks.filter(
    (t) => t.status !== 'DONE' && t.evidenceUploaded.length < t.requiredEvidence.length,
  );

  // 今日高风险：合并逾期 + 临近 + 待复核
  const todayCritical = useMemo(() => {
    const list: { task: Task; reason: string; tone: 'danger' | 'amber' | 'cobalt' }[] = [];
    overdueTasks.forEach((t) => list.push({ task: t, reason: `逾期 ${Math.abs(Math.round(daysFromNow(t.dueAt)))} 天`, tone: 'danger' }));
    dueSoonTasks.slice(0, 3).forEach((t) =>
      list.push({ task: t, reason: `${Math.ceil(daysFromNow(t.dueAt))} 天内截止`, tone: 'amber' }),
    );
    inReviewTasks.slice(0, 2).forEach((t) => list.push({ task: t, reason: '待复核', tone: 'cobalt' }));
    return list.slice(0, 8);
  }, [overdueTasks, dueSoonTasks, inReviewTasks]);

  return (
    <>
      <PageHeader
        title={`你好，${me.name.split('')[0]}老师`}
        subtitle="这是 PV智枢 的项目驾驶舱。今天有 3 个高风险任务、2 项待复核、1 条证据缺失需要你关注。"
        meta={[
          <RoleChip key="role" role={me.role} />,
          <Chip key="org" tone="neutral">
            <Users2 className="w-3 h-3" /> {me.org}
          </Chip>,
          <Chip key="ts" tone="neutral">
            <CalendarClock className="w-3 h-3" /> {formatDate(new Date().toISOString())}
          </Chip>,
        ]}
        actions={
          roleCan(me.role, 'create_project') ? (
            <>
              <button className="btn btn-ghost" onClick={() => navigate('/audit')}>
                <ShieldAlert className="w-3.5 h-3.5" /> 审计中心
              </button>
              <button className="btn btn-primary" onClick={() => navigate('/projects/new')}>
                <ClipboardList className="w-3.5 h-3.5" /> 新建项目
              </button>
            </>
          ) : (
            <button className="btn btn-primary" onClick={() => navigate('/projects')}>
              查看我的项目
            </button>
          )
        }
      />

      {/* KPI 卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 mb-7">
        <KpiCard
          label="活跃项目"
          value={projects.filter((p) => p.status === 'ACTIVE').length}
          hint={`共 ${projects.length} 个项目`}
          icon={ListChecks}
          tone="teal"
        />
        <KpiCard
          label="逾期任务"
          value={overdueTasks.length}
          hint={overdueTasks.length > 0 ? '需立即处理' : '全部按时'}
          icon={AlertTriangle}
          tone={overdueTasks.length > 0 ? 'danger' : 'teal'}
        />
        <KpiCard
          label="待复核"
          value={inReviewTasks.length}
          hint={`涉及 ${new Set(inReviewTasks.map((t) => t.projectId)).size} 个项目`}
          icon={CheckCircle2}
          tone="amber"
        />
        <KpiCard
          label="证据缺失"
          value={missingEvidence.length}
          hint={missingEvidence.length > 0 ? '影响审计包完整性' : '证据齐备'}
          icon={FileText}
          tone={missingEvidence.length > 0 ? 'amber' : 'teal'}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-5">
        {/* 左主区：今日高风险 + 项目卡片 */}
        <div className="space-y-5">
          {/* 今日高风险 */}
          <section className="surface p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-danger-500/10 flex items-center justify-center">
                  <Flame className="w-3.5 h-3.5 text-danger-600" />
                </div>
                <h2 className="font-display text-[15px] font-semibold">今日最该处理</h2>
                <span className="chip chip-mono bg-danger-500/10 text-danger-700 border-danger-500/30">
                  {todayCritical.length} 个
                </span>
              </div>
              <Link to="/projects" className="text-[12px] text-cobalt-600 hover:underline">
                查看全部任务 →
              </Link>
            </div>

            {todayCritical.length === 0 ? (
              <div className="py-10 text-center">
                <div className="w-10 h-10 rounded-full bg-teal-50 mx-auto flex items-center justify-center mb-2">
                  <CheckCircle2 className="w-5 h-5 text-teal-600" />
                </div>
                <div className="text-[13.5px] font-medium text-ink-800">今日没有紧急任务</div>
                <div className="text-[12px] text-ink-500 mt-1">可以集中精力处理 CAPA 与质量复核</div>
              </div>
            ) : (
              <div className="space-y-2">
                {todayCritical.map(({ task, reason, tone }) => (
                  <button
                    key={task.id}
                    onClick={() => navigate(`/tasks/${task.id}`)}
                    className="w-full text-left p-3 rounded-xl border border-ink-900/5 hover:border-cobalt-500/30 hover:bg-cobalt-50/30 transition-all flex items-center gap-3.5 group"
                  >
                    <div
                      className={cn(
                        'w-9 h-9 rounded-lg flex items-center justify-center shrink-0',
                        tone === 'danger' && 'bg-danger-500/10 text-danger-600',
                        tone === 'amber' && 'bg-amber-500/15 text-amber-700',
                        tone === 'cobalt' && 'bg-cobalt-50 text-cobalt-600',
                      )}
                    >
                      {tone === 'danger' ? <AlertTriangle className="w-4 h-4" /> : tone === 'amber' ? <Clock4 className="w-4 h-4" /> : <CircleDot className="w-4 h-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="text-[13.5px] font-semibold text-ink-900 truncate">{task.title}</div>
                        <PriorityTag p={task.priority} />
                        <StatusBadge status={task.status} />
                      </div>
                      <div className="text-[11.5px] text-ink-500 mt-0.5 flex items-center gap-2 flex-wrap">
                        <span className="font-mono">{task.caseId ?? '—'}</span>
                        <span className="text-ink-300">·</span>
                        <span>{task.product}</span>
                        <span className="text-ink-300">·</span>
                        <span>截止 {formatDate(task.dueAt)}</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div
                        className={cn(
                          'text-[11px] font-mono font-semibold',
                          tone === 'danger' && 'text-danger-600',
                          tone === 'amber' && 'text-amber-700',
                          tone === 'cobalt' && 'text-cobalt-600',
                        )}
                      >
                        {reason}
                      </div>
                      <div className="text-[10.5px] text-ink-500 mt-0.5 flex items-center gap-1 justify-end">
                        <Avatar userId={task.assigneeId} size={16} />
                        {users.find((u) => u.id === task.assigneeId)?.name ?? '待分配'}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>

          {/* 项目卡片 */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-display text-[15px] font-semibold flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-cobalt-600" />
                活跃项目
              </h2>
              <Link to="/projects" className="text-[12px] text-cobalt-600 hover:underline">
                全部 {projects.length} 个项目 →
              </Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {projects.slice(0, 4).map((p) => {
                const projectTasks = tasks.filter((t) => t.projectId === p.id);
                const completed = projectTasks.filter((t) => t.status === 'DONE').length;
                const proj = completed / Math.max(projectTasks.length, 1);
                const tpl = templates.find((t) => t.id === p.templateId);
                return (
                  <button
                    key={p.id}
                    onClick={() => navigate(`/projects/${p.id}`)}
                    className="surface-soft p-4 text-left hover:shadow-panel hover:-translate-y-0.5 transition-all group"
                  >
                    <div className="flex items-center gap-2 mb-2.5 flex-wrap">
                      <span className={cn('chip chip-mono', PROJECT_TYPE_TONE[p.type])}>
                        {PROJECT_TYPE_LABEL[p.type]}
                      </span>
                      <span className="text-[10.5px] text-ink-400 font-mono">{p.code}</span>
                    </div>
                    <h3 className="font-display text-[14.5px] font-semibold text-ink-900 leading-snug text-pretty">
                      {p.name}
                    </h3>
                    <div className="text-[11.5px] text-ink-500 mt-1.5 line-clamp-2">{p.description}</div>

                    <div className="mt-3.5">
                      <div className="flex items-center justify-between text-[11px] mb-1.5">
                        <span className="text-ink-500">
                          <span className="text-ink-800 font-mono font-semibold">{projectTasks.length}</span> 个任务
                        </span>
                        <span className="text-ink-500">
                          <span className="text-ink-800 font-mono font-semibold">{Math.round(proj * 100)}%</span> 完成
                        </span>
                      </div>
                      <div className="h-1.5 bg-ink-100 rounded-full overflow-hidden">
                        <div
                          className={cn(
                            'h-full rounded-full transition-all',
                            proj === 1 ? 'bg-teal-500' : proj > 0.6 ? 'bg-cobalt-500' : proj > 0.3 ? 'bg-amber-500' : 'bg-danger-500',
                          )}
                          style={{ width: `${Math.max(proj * 100, 4)}%` }}
                        />
                      </div>
                    </div>

                    <div className="mt-3.5 flex items-center justify-between text-[11px]">
                      <div className="flex items-center gap-1.5 text-ink-500">
                        <AvatarStack userIds={p.memberIds} max={3} />
                      </div>
                      <div className="text-ink-500 font-mono">
                        {relativeFromNow(p.endDate)}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        </div>

        {/* 右栏：风险/通知 + AI 建议 */}
        <div className="space-y-5">
          <RiskPanel
            overdue={overdueTasks}
            inReview={inReviewTasks}
            missingEvidence={missingEvidence}
            highRisk={highRisk}
            onOpen={(id) => navigate(`/tasks/${id}`)}
          />

          <section className="surface p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-lg bg-cobalt-50 flex items-center justify-center">
                <Sparkles className="w-3.5 h-3.5 text-cobalt-600" />
              </div>
              <h2 className="font-display text-[14.5px] font-semibold">AI 助手建议</h2>
              <Chip tone="amber" className="ml-auto text-[10.5px]">草稿</Chip>
            </div>
            <p className="text-[12px] text-ink-600 leading-relaxed">
              基于本周任务进展，AI 已为「泰诺林® 肝损伤信号」项目生成<span className="font-semibold"> 周报草稿</span>。
              AI 输出仅为草稿，<span className="text-amber-700 font-medium">不替代医学判断</span>，需要人工确认。
            </p>
            <div className="mt-3 flex items-center gap-2">
              <button onClick={() => navigate('/ai')} className="btn btn-soft flex-1 text-[12px]">
                查看草稿
              </button>
              <button onClick={() => navigate('/ai')} className="btn btn-ghost text-[12px]">
                生成会议纪要
              </button>
            </div>
          </section>

          <RecentActivity logs={auditLogs} users={users} onOpen={(id) => navigate(`/tasks/${id}`)} />
        </div>
      </div>
    </>
  );
}

function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: 'teal' | 'amber' | 'cobalt' | 'danger';
}) {
  const toneClass = {
    teal: 'bg-teal-50 text-teal-700',
    amber: 'bg-amber-500/15 text-amber-700',
    cobalt: 'bg-cobalt-50 text-cobalt-600',
    danger: 'bg-danger-500/10 text-danger-600',
  }[tone];
  return (
    <div className="surface p-4 hover:shadow-panel transition-shadow">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[11.5px] text-ink-500 font-medium tracking-wide">{label}</div>
          <div className="font-display text-[28px] font-semibold text-ink-900 leading-none mt-1.5">
            {value}
          </div>
        </div>
        <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', toneClass)}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <div className="text-[11px] text-ink-500 mt-2">{hint}</div>
    </div>
  );
}

function RiskPanel({
  overdue,
  inReview,
  missingEvidence,
  highRisk,
  onOpen,
}: {
  overdue: Task[];
  inReview: Task[];
  missingEvidence: Task[];
  highRisk: Task[];
  onOpen: (id: string) => void;
}) {
  const sections = [
    {
      key: 'overdue',
      title: '逾期风险',
      icon: AlertTriangle,
      tone: 'text-danger-600',
      items: overdue.slice(0, 4),
      emptyText: '无逾期',
    },
    {
      key: 'review',
      title: '复核退回',
      icon: CheckCircle2,
      tone: 'text-amber-700',
      items: inReview.slice(0, 4),
      emptyText: '无待复核',
    },
    {
      key: 'evidence',
      title: '证据缺失',
      icon: FileText,
      tone: 'text-cobalt-600',
      items: missingEvidence.slice(0, 4),
      emptyText: '证据齐备',
    },
    {
      key: 'risk',
      title: '高风险任务',
      icon: ShieldAlert,
      tone: 'text-ink-700',
      items: highRisk.slice(0, 4),
      emptyText: '无',
    },
  ];

  return (
    <section className="surface p-4">
      <div className="flex items-center justify-between mb-3.5">
        <h2 className="font-display text-[14.5px] font-semibold">风险与待办</h2>
        <Link to="/projects" className="text-[11px] text-cobalt-600 hover:underline">
          全部 →
        </Link>
      </div>
      <div className="space-y-3.5">
        {sections.map((sec) => {
          const Icon = sec.icon;
          return (
            <div key={sec.key}>
              <div className="flex items-center gap-1.5 mb-1.5">
                <Icon className={cn('w-3.5 h-3.5', sec.tone)} />
                <div className="text-[11.5px] font-semibold text-ink-700">{sec.title}</div>
                <span className="text-[10.5px] text-ink-500 font-mono">{sec.items.length}</span>
              </div>
              {sec.items.length === 0 ? (
                <div className="text-[11.5px] text-ink-400 pl-5">{sec.emptyText}</div>
              ) : (
                <ul className="space-y-1">
                  {sec.items.map((t) => (
                    <li key={t.id}>
                      <button
                        onClick={() => onOpen(t.id)}
                        className="w-full text-left pl-5 pr-2 py-1.5 rounded-md hover:bg-ink-900/[0.03] flex items-center gap-2"
                      >
                        <span className={cn('dot shrink-0', {
                          'bg-danger-500': dueUrgency(t.dueAt) === 'overdue',
                          'bg-amber-500': dueUrgency(t.dueAt) === 'today' || dueUrgency(t.dueAt) === 'soon',
                          'bg-cobalt-500': dueUrgency(t.dueAt) === 'ok' && t.status === 'IN_REVIEW',
                          'bg-ink-300': dueUrgency(t.dueAt) === 'ok' && t.status !== 'IN_REVIEW',
                        })} />
                        <div className="flex-1 min-w-0 text-[12px] text-ink-800 truncate">{t.title}</div>
                        <div className="text-[10.5px] text-ink-500 font-mono shrink-0">
                          {relativeFromNow(t.dueAt)}
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function RecentActivity({ logs, users, onOpen }: { logs: ReturnType<typeof useStore.getState>['auditLogs']; users: User[]; onOpen: (id: string) => void }) {
  const recent = logs.slice(0, 6);
  return (
    <section className="surface p-4">
      <div className="flex items-center justify-between mb-3.5">
        <h2 className="font-display text-[14.5px] font-semibold">最近操作</h2>
        <Link to="/audit" className="text-[11px] text-cobalt-600 hover:underline">
          全部 →
        </Link>
      </div>
      <ol className="space-y-2.5">
        {recent.map((l, i) => {
          const actor = users.find((u) => u.id === l.actorId);
          return (
            <li key={l.id} className="flex gap-2.5">
              <div className="flex flex-col items-center">
                <Avatar userId={l.actorId} size={22} />
                {i < recent.length - 1 && <div className="w-px flex-1 bg-ink-900/10 mt-1.5" />}
              </div>
              <div className="flex-1 min-w-0 pb-1">
                <div className="text-[12px] text-ink-800 leading-snug">
                  <span className="font-semibold">{actor?.name ?? '系统'}</span> {l.action}
                </div>
                <div className="text-[10.5px] text-ink-500 font-mono mt-0.5">
                  {formatDate(l.createdAt, true)} · {relativeFromNow(l.createdAt)}
                </div>
                {l.objectType === 'TASK' && (
                  <button
                    onClick={() => onOpen(l.objectId)}
                    className="text-[11px] text-cobalt-600 hover:underline mt-0.5"
                  >
                    查看对象 →
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
