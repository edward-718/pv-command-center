import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  CalendarClock,
  ClipboardList,
  Download,
  FileText,
  ListChecks,
  Plus,
  ShieldCheck,
} from 'lucide-react';
import { useStore, selectVisibleTasks, roleCan } from '@/store/useStore';
import { PageHeader } from '@/components/TopBar';
import { Avatar, AvatarStack, RoleChip } from '@/components/Avatar';
import { Chip, PriorityTag, RiskTag, SeverityTag, StatusBadge, StatusFlowBar } from '@/components/Badge';
import { cn, daysFromNow, dueUrgency, formatDate, isOverdue, relativeFromNow } from '@/lib/utils';
import { PROJECT_TYPE_LABEL, type ProjectType, type Task, type TaskStatus } from '@/types';

const TYPE_TONE: Record<ProjectType, string> = {
  ICSR: 'bg-cobalt-50 text-cobalt-700 border-cobalt-200',
  INQUIRY: 'bg-amber-500/10 text-amber-700 border-amber-500/30',
  CAPA: 'bg-teal-50 text-teal-700 border-teal-200',
  PSUR: 'bg-ink-100 text-ink-700 border-ink-200',
};

const PROJECT_TABS = [
  { key: 'overview', label: '项目概览' },
  { key: 'tasks', label: '任务' },
  { key: 'members', label: '成员' },
  { key: 'audit', label: '审计' },
] as const;
type Tab = (typeof PROJECT_TABS)[number]['key'];

export function ProjectDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const me = useStore((s) => s.currentUser)!;
  const project = useStore((s) => s.projects.find((p) => p.id === id));
  const templates = useStore((s) => s.templates);
  const users = useStore((s) => s.users);
  const tasksAll = useStore((s) => s.tasks);
  const aiDrafts = useStore((s) => s.aiDrafts);
  const auditLogs = useStore((s) => s.auditLogs);
  const reviews = useStore((s) => s.reviews);
  const pushToast = useStore((s) => s.pushToast);

  const tasks = useMemo(
    () => (project ? selectVisibleTasks(useStore.getState(), me).filter((t) => t.projectId === project.id) : []),
    [project, tasksAll, me],
  );

  const [tab, setTab] = useState<Tab>('overview');
  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'ALL'>('ALL');

  if (!project) {
    return (
      <div className="surface p-10 text-center">
        <div className="text-[14px] font-semibold text-ink-800">项目不存在</div>
        <button className="btn btn-ghost mt-4" onClick={() => navigate('/projects')}>
          返回项目列表
        </button>
      </div>
    );
  }

  const tpl = templates.find((t) => t.id === project.templateId);
  const completed = tasks.filter((t) => t.status === 'DONE').length;
  const progress = completed / Math.max(tasks.length, 1);
  const overdue = tasks.filter((t) => t.status !== 'DONE' && isOverdue(t.dueAt)).length;
  const inReview = tasks.filter((t) => t.status === 'IN_REVIEW').length;
  const projectAudit = auditLogs.filter((l) => l.objectId === project.id || tasks.some((t) => t.id === l.objectId));

  const filteredTasks = statusFilter === 'ALL' ? tasks : tasks.filter((t) => t.status === statusFilter);

  return (
    <>
      <button
        onClick={() => navigate('/projects')}
        className="flex items-center gap-1.5 text-[12px] text-ink-500 hover:text-ink-900 mb-4 transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> 返回项目列表
      </button>

      <PageHeader
        title={project.name}
        subtitle={project.description}
        meta={[
          <span key="t" className={cn('chip chip-mono', TYPE_TONE[project.type])}>
            {PROJECT_TYPE_LABEL[project.type]}
          </span>,
          <span key="c" className="chip chip-mono bg-ink-100 text-ink-700 border-ink-200">
            {project.code}
          </span>,
          <Chip key="p" tone="neutral">
            <ClipboardList className="w-3 h-3" /> {project.product}
          </Chip>,
          <Chip key="r" tone="neutral">
            {project.region}
          </Chip>,
          <Chip key="d" tone={project.status === 'ACTIVE' ? 'teal' : 'neutral'}>
            {project.status === 'ACTIVE' ? '进行中' : '已关闭'}
          </Chip>,
        ]}
        actions={
          <>
            {roleCan(me.role, 'audit_export') && (
              <button
                className="btn btn-ghost"
                onClick={() => {
                  pushToast('success', '审计包已生成（演示）');
                }}
              >
                <Download className="w-3.5 h-3.5" /> 导出审计包
              </button>
            )}
            {roleCan(me.role, 'create_project') && (
              <button className="btn btn-primary">
                <Plus className="w-3.5 h-3.5" /> 新建任务
              </button>
            )}
          </>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 mb-5">
        <SmallStat label="任务总数" value={tasks.length} icon={ListChecks} tone="cobalt" />
        <SmallStat label="已完成" value={completed} icon={ClipboardList} tone="teal" />
        <SmallStat label="待复核" value={inReview} icon={ShieldCheck} tone="amber" />
        <SmallStat label="逾期" value={overdue} icon={CalendarClock} tone={overdue > 0 ? 'danger' : 'teal'} />
      </div>

      {/* 进度条 */}
      <div className="surface p-4 mb-5">
        <div className="flex items-center justify-between mb-2">
          <div className="text-[12.5px] font-semibold text-ink-800">整体进度</div>
          <div className="text-[12px] text-ink-500 font-mono">
            {completed}/{tasks.length} · {Math.round(progress * 100)}%
          </div>
        </div>
        <div className="h-2 bg-ink-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-cobalt-500 to-teal-500 rounded-full transition-all"
            style={{ width: `${Math.max(progress * 100, 4)}%` }}
          />
        </div>
        <div className="mt-3 flex items-center gap-2 text-[11px] text-ink-500">
          <span>起 {formatDate(project.startDate)}</span>
          <span className="text-ink-300">→</span>
          <span>止 {formatDate(project.endDate)}</span>
          <span className="ml-auto font-mono">{relativeFromNow(project.endDate)}</span>
        </div>
      </div>

      {/* Tab */}
      <div className="flex items-center gap-1 mb-4 border-b border-ink-900/5">
        {PROJECT_TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              'px-3.5 py-2 text-[12.5px] font-medium border-b-2 -mb-px transition-colors',
              tab === t.key
                ? 'border-teal-600 text-ink-900'
                : 'border-transparent text-ink-500 hover:text-ink-800',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-5">
          <section className="surface p-5">
            <h3 className="font-display text-[14.5px] font-semibold mb-3">关键任务</h3>
            <div className="space-y-2">
              {tasks
                .filter((t) => t.status !== 'DONE')
                .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime())
                .slice(0, 5)
                .map((t) => (
                  <button
                    key={t.id}
                    onClick={() => navigate(`/tasks/${t.id}`)}
                    className="w-full text-left p-3 rounded-lg border border-ink-900/5 hover:border-cobalt-500/30 hover:bg-cobalt-50/30 transition-all flex items-center gap-3"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="text-[13px] font-semibold text-ink-900 truncate">{t.title}</div>
                        <PriorityTag p={t.priority} />
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-ink-500">
                        <span className="font-mono">{t.caseId ?? '—'}</span>
                        <span>·</span>
                        <span>截止 {formatDate(t.dueAt)}</span>
                        <span>·</span>
                        <span>{relativeFromNow(t.dueAt)}</span>
                      </div>
                    </div>
                    <div className="shrink-0 flex items-center gap-2">
                      <StatusBadge status={t.status} />
                      <Avatar userId={t.assigneeId} size={22} />
                    </div>
                  </button>
                ))}
              {tasks.filter((t) => t.status !== 'DONE').length === 0 && (
                <div className="text-center py-8 text-[12.5px] text-ink-500">所有任务已完成 🎉</div>
              )}
            </div>
          </section>

          <div className="space-y-5">
            <section className="surface p-5">
              <h3 className="font-display text-[14.5px] font-semibold mb-3">项目元信息</h3>
              <div className="space-y-2.5 text-[12.5px]">
                <FieldRow label="项目负责人" value={
                  <div className="flex items-center gap-1.5">
                    <Avatar userId={project.ownerId} size={20} />
                    <span>{users.find((u) => u.id === project.ownerId)?.name}</span>
                  </div>
                } />
                <FieldRow label="使用模板" value={tpl?.name ?? '—'} />
                <FieldRow label="产品" value={project.product} />
                <FieldRow label="区域" value={project.region} />
                <FieldRow label="起止时间" value={`${formatDate(project.startDate)} → ${formatDate(project.endDate)}`} />
                <FieldRow label="成员" value={<AvatarStack userIds={project.memberIds} max={6} />} />
              </div>
            </section>

            {aiDrafts.filter((d) => d.projectId === project.id).length > 0 && (
              <section className="surface p-5">
                <h3 className="font-display text-[14.5px] font-semibold mb-3">AI 草稿</h3>
                <div className="space-y-2">
                  {aiDrafts
                    .filter((d) => d.projectId === project.id)
                    .map((d) => (
                      <div key={d.id} className="rounded-lg border border-ink-900/5 p-3 bg-cobalt-50/30">
                        <div className="flex items-center justify-between mb-1">
                          <span className="chip chip-mono bg-cobalt-100 text-cobalt-700 border-cobalt-200">
                            {d.kind === 'WEEKLY' ? '周报' : d.kind === 'MEETING' ? '会议纪要' : d.kind === 'CAPA' ? 'CAPA' : '风险'}
                          </span>
                          <span className="text-[10.5px] text-ink-500 font-mono">{formatDate(d.createdAt)}</span>
                        </div>
                        <div className="text-[11.5px] text-ink-600 line-clamp-2 mt-1">{d.content.replace(/[#*`]/g, '').slice(0, 80)}…</div>
                        <button
                          onClick={() => navigate('/ai')}
                          className="text-[11px] text-cobalt-600 hover:underline mt-1.5"
                        >
                          查看草稿 →
                        </button>
                      </div>
                    ))}
                </div>
              </section>
            )}
          </div>
        </div>
      )}

      {tab === 'tasks' && (
        <section className="surface p-3">
          <div className="flex items-center gap-1.5 mb-3 px-2 flex-wrap">
            <span className="text-[11.5px] text-ink-500 mr-1.5">状态</span>
            {(['ALL', 'NOT_STARTED', 'IN_PROGRESS', 'IN_REVIEW', 'NEEDS_INFO', 'DONE'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={cn(
                  'chip transition-all',
                  statusFilter === s
                    ? 'bg-ink-900 text-white border-ink-900'
                    : 'bg-ink-100 text-ink-600 border-ink-100 hover:bg-ink-200',
                )}
              >
                {s === 'ALL' ? '全部' : s === 'IN_PROGRESS' ? '处理中' : s === 'IN_REVIEW' ? '待复核' : s === 'NEEDS_INFO' ? '需补充' : s === 'NOT_STARTED' ? '未开始' : '已完成'}
              </button>
            ))}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px]">
              <thead className="text-[11px] text-ink-500 bg-ink-50 border-b border-ink-900/5">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">任务</th>
                  <th className="text-left px-3 py-2 font-medium">状态</th>
                  <th className="text-left px-3 py-2 font-medium">负责人</th>
                  <th className="text-left px-3 py-2 font-medium">截止</th>
                  <th className="text-left px-3 py-2 font-medium">证据</th>
                </tr>
              </thead>
              <tbody>
                {filteredTasks.map((t) => (
                  <tr
                    key={t.id}
                    onClick={() => navigate(`/tasks/${t.id}`)}
                    className="border-b border-ink-900/5 hover:bg-ink-50 cursor-pointer"
                  >
                    <td className="px-3 py-2.5">
                      <div className="font-semibold text-ink-900">{t.title}</div>
                      <div className="text-[10.5px] text-ink-500 font-mono mt-0.5">
                        {t.caseId ?? '—'} · {t.type}
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <StatusBadge status={t.status} />
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <Avatar userId={t.assigneeId} size={20} />
                        <span className="text-ink-700">{users.find((u) => u.id === t.assigneeId)?.name ?? '待分配'}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <div
                        className={cn('font-mono', {
                          'text-danger-600 font-semibold': dueUrgency(t.dueAt) === 'overdue',
                          'text-amber-700': dueUrgency(t.dueAt) === 'today' || dueUrgency(t.dueAt) === 'soon',
                          'text-ink-700': dueUrgency(t.dueAt) === 'ok',
                        })}
                      >
                        {formatDate(t.dueAt)}
                      </div>
                      <div className="text-[10.5px] text-ink-500 mt-0.5">{relativeFromNow(t.dueAt)}</div>
                    </td>
                    <td className="px-3 py-2.5">
                      <EvidenceProgress task={t} />
                    </td>
                  </tr>
                ))}
                {filteredTasks.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-3 py-10 text-center text-[12.5px] text-ink-500">
                      没有匹配的任务
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tab === 'members' && (
        <section className="surface p-5">
          <h3 className="font-display text-[14.5px] font-semibold mb-3">项目成员</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {project.memberIds.map((mid) => {
              const u = users.find((x) => x.id === mid);
              if (!u) return null;
              const myTasks = tasks.filter((t) => t.assigneeId === mid);
              return (
                <div key={mid} className="rounded-xl border border-ink-900/5 p-3.5 flex items-center gap-3">
                  <Avatar userId={mid} size={40} />
                  <div className="flex-1 min-w-0">
                    <div className="font-display text-[13.5px] font-semibold text-ink-900">{u.name}</div>
                    <div className="text-[11px] text-ink-500">{u.email}</div>
                    <div className="mt-1.5 flex items-center gap-1.5">
                      <RoleChip role={u.role} />
                      <span className="text-[10.5px] text-ink-500 font-mono">{myTasks.length} 个任务</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {tab === 'audit' && (
        <section className="surface p-5">
          <h3 className="font-display text-[14.5px] font-semibold mb-3">项目审计日志</h3>
          <ol className="space-y-2.5">
            {projectAudit.slice(0, 30).map((l) => (
              <li key={l.id} className="flex gap-2.5">
                <Avatar userId={l.actorId} size={22} />
                <div className="flex-1 min-w-0">
                  <div className="text-[12.5px] text-ink-800">
                    <span className="font-semibold">{users.find((u) => u.id === l.actorId)?.name ?? '系统'}</span> {l.action}
                  </div>
                  <div className="text-[10.5px] text-ink-500 font-mono mt-0.5">
                    {formatDate(l.createdAt, true)} · {l.objectType} · {l.objectId}
                  </div>
                </div>
              </li>
            ))}
            {projectAudit.length === 0 && (
              <li className="text-center py-6 text-[12.5px] text-ink-500">暂无审计记录</li>
            )}
          </ol>
        </section>
      )}
    </>
  );
}

function SmallStat({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
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
    <div className="surface p-3.5 flex items-center justify-between">
      <div>
        <div className="text-[11.5px] text-ink-500">{label}</div>
        <div className="font-display text-[22px] font-semibold text-ink-900 leading-none mt-1">{value}</div>
      </div>
      <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', toneClass)}>
        <Icon className="w-4 h-4" />
      </div>
    </div>
  );
}

function FieldRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="text-[11px] text-ink-500 uppercase tracking-wider">{label}</div>
      <div className="text-ink-800 text-right">{value}</div>
    </div>
  );
}

function EvidenceProgress({ task }: { task: Task }) {
  const have = task.evidenceUploaded.length;
  const need = task.requiredEvidence.length;
  const pct = need === 0 ? 1 : have / need;
  const tone = pct === 1 ? 'text-teal-700' : pct > 0.5 ? 'text-amber-700' : 'text-danger-600';
  return (
    <div className="flex items-center gap-2">
      <div className="w-20 h-1.5 bg-ink-100 rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full', pct === 1 ? 'bg-teal-500' : pct > 0.5 ? 'bg-amber-500' : 'bg-danger-500')}
          style={{ width: `${Math.max(pct * 100, 4)}%` }}
        />
      </div>
      <span className={cn('text-[10.5px] font-mono font-semibold', tone)}>
        {have}/{need}
      </span>
    </div>
  );
}
