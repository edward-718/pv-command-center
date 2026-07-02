import { useNavigate } from 'react-router-dom';
import { useStore, roleCan } from '@/store/useStore';
import { PageHeader } from '@/components/TopBar';
import { Avatar, RoleChip } from '@/components/Avatar';
import { Chip, PriorityTag, StatusBadge } from '@/components/Badge';
import { cn, daysFromNow, dueUrgency, formatDate, relativeFromNow } from '@/lib/utils';
import { ArrowRight, Building2, FileText, MessageSquare, Upload } from 'lucide-react';
import type { Task } from '@/types';

export function VendorsPage() {
  const me = useStore((s) => s.currentUser)!;
  const allTasks = useStore((s) => s.tasks);
  const allProjects = useStore((s) => s.projects);
  const users = useStore((s) => s.users);
  const navigate = useNavigate();

  // 供应商只能看到分配给自己的任务；PM 可以看到所有供应商空间
  const isVendor = me.role === 'VENDOR';
  const tasks = isVendor
    ? allTasks.filter((t) => t.assigneeId === me.id || t.reviewerId === me.id)
    : allTasks.filter((t) => {
        const assignee = users.find((u) => u.id === t.assigneeId);
        return assignee?.role === 'VENDOR';
      });

  const projects = isVendor
    ? allProjects.filter((p) => p.memberIds.includes(me.id) || tasks.some((t) => t.projectId === p.id))
    : allProjects.filter((p) => p.memberIds.some((mid) => users.find((u) => u.id === mid)?.role === 'VENDOR'));

  return (
    <>
      <PageHeader
        title="供应商协作空间"
        subtitle={
          isVendor
            ? '您只看到被分派的任务、缺失项和反馈。任务清单、附件、提交回执等操作受限于授权范围。'
            : '按供应商查看分派任务、SLA 与交付状态。仅 PM / QA 可查看完整审计日志。'
        }
        actions={
          <Chip tone="amber" className="text-[11px]">
            受限视图
          </Chip>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-5">
        <aside className="surface p-4">
          <h3 className="font-display text-[13.5px] font-semibold mb-3 flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 text-cobalt-600" /> 供应商档案
          </h3>
          <div className="space-y-2.5">
            {users
              .filter((u) => u.role === 'VENDOR')
              .map((u) => {
                const myTasks = allTasks.filter((t) => t.assigneeId === u.id || t.reviewerId === u.id);
                const overdue = myTasks.filter((t) => t.status !== 'DONE' && daysFromNow(t.dueAt) < 0).length;
                return (
                  <div key={u.id} className="rounded-lg border border-ink-900/5 p-3 flex items-center gap-2.5">
                    <Avatar userId={u.id} size={36} />
                    <div className="flex-1 min-w-0">
                      <div className="text-[12.5px] font-semibold text-ink-900">{u.name}</div>
                      <div className="text-[10.5px] text-ink-500">{u.org}</div>
                      <div className="mt-1.5 flex items-center gap-1">
                        <Chip tone={overdue > 0 ? 'danger' : 'teal'} className="text-[10px]">
                          {myTasks.length} 任务 · {overdue} 逾期
                        </Chip>
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>

          {!isVendor && roleCan(me.role, 'create_project') && (
            <div className="mt-4 pt-4 border-t border-ink-900/5">
              <button className="btn btn-ghost w-full text-[12px]">
                + 邀请新供应商
              </button>
            </div>
          )}
        </aside>

        <section className="surface p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display text-[14.5px] font-semibold">
              供应商分派任务 · {tasks.length} 个
            </h3>
            <div className="text-[11.5px] text-ink-500">
              涉及项目 {projects.length} 个
            </div>
          </div>

          {tasks.length === 0 ? (
            <div className="py-12 text-center text-[12.5px] text-ink-500">
              当前没有供应商分派任务
            </div>
          ) : (
            <div className="space-y-2.5">
              {tasks.map((t) => {
                const p = allProjects.find((x) => x.id === t.projectId);
                return (
                  <button
                    key={t.id}
                    onClick={() => navigate(`/tasks/${t.id}`)}
                    className="w-full text-left p-3.5 rounded-xl border border-ink-900/5 hover:border-cobalt-500/30 hover:bg-cobalt-50/30 transition-all flex items-center gap-3.5"
                  >
                    <div
                      className={cn(
                        'w-1 self-stretch rounded-full',
                        dueUrgency(t.dueAt) === 'overdue' && 'bg-danger-500',
                        dueUrgency(t.dueAt) === 'today' && 'bg-amber-500',
                        dueUrgency(t.dueAt) === 'soon' && 'bg-amber-500',
                        dueUrgency(t.dueAt) === 'ok' && 'bg-cobalt-500',
                      )}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="text-[13.5px] font-semibold text-ink-900 truncate">{t.title}</div>
                        <PriorityTag p={t.priority} />
                        <StatusBadge status={t.status} />
                      </div>
                      <div className="text-[11.5px] text-ink-500 mt-1 flex items-center gap-2 flex-wrap">
                        <span className="font-mono">{p?.code}</span>
                        <span className="text-ink-300">·</span>
                        <span>{p?.name}</span>
                        <span className="text-ink-300">·</span>
                        <span>截止 {formatDate(t.dueAt)}</span>
                        <span className="text-ink-300">·</span>
                        <span>{relativeFromNow(t.dueAt)}</span>
                      </div>
                      {t.requiredEvidence.length > 0 && (
                        <div className="text-[11px] text-ink-500 mt-1.5 flex items-center gap-1.5 flex-wrap">
                          <span>需提交：</span>
                          {t.requiredEvidence.map((e) => (
                            <span key={e} className="chip chip-mono bg-cobalt-50 text-cobalt-700 border-cobalt-200 text-[10px]">
                              {e}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="shrink-0 flex flex-col items-end gap-1.5">
                      <div className="text-[10.5px] text-ink-500 font-mono">
                        {t.evidenceUploaded.length}/{t.requiredEvidence.length} 证据
                      </div>
                      <div className="flex items-center gap-1.5">
                        <ActionHint label="上传" icon={Upload} />
                        <ActionHint label="评论" icon={MessageSquare} />
                        <ActionHint label="查看" icon={ArrowRight} />
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </>
  );
}

function ActionHint({ label, icon: Icon }: { label: string; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <span className="text-[10.5px] text-ink-500 inline-flex items-center gap-0.5">
      <Icon className="w-3 h-3" />
      {label}
    </span>
  );
}
