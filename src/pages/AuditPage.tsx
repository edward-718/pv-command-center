import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, FileText, Filter, Search, ShieldCheck } from 'lucide-react';
import { useStore, roleCan, selectVisibleProjects, selectVisibleTasks } from '@/store/useStore';
import { PageHeader } from '@/components/TopBar';
import { Avatar } from '@/components/Avatar';
import { Chip } from '@/components/Badge';
import { cn, formatDate, relativeFromNow } from '@/lib/utils';
import type { AuditLog } from '@/types';

export function AuditPage() {
  const me = useStore((s) => s.currentUser)!;
  const logs = useStore((s) => s.auditLogs);
  const users = useStore((s) => s.users);
  const projects = useStore((s) => s.projects);
  const tasks = useStore((s) => s.tasks);
  const navigate = useNavigate();
  const pushToast = useStore((s) => s.pushToast);

  const [q, setQ] = useState('');
  const [objectType, setObjectType] = useState<AuditLog['objectType'] | 'ALL'>('ALL');
  const [actorId, setActorId] = useState<string | 'ALL'>('ALL');

  const visibleProjects = useMemo(
    () => selectVisibleProjects({ ...useStore.getState(), currentUser: me }, me),
    [me, projects, tasks],
  );
  const visibleTasks = useMemo(
    () => selectVisibleTasks({ ...useStore.getState(), currentUser: me }, me),
    [me, projects, tasks],
  );
  const visibleProjectIds = useMemo(() => new Set(visibleProjects.map((p) => p.id)), [visibleProjects]);
  const visibleTaskIds = useMemo(() => new Set(visibleTasks.map((t) => t.id)), [visibleTasks]);

  const visibleLogs = useMemo(() => {
    return logs.filter((l) => {
      if (l.objectType === 'PROJECT') return visibleProjectIds.has(l.objectId);
      if (l.objectType === 'TASK') return visibleTaskIds.has(l.objectId);
      if (l.objectType === 'REVIEW') return visibleTaskIds.has(l.objectId);
      if (l.objectType === 'ATTACHMENT') {
        const att = useStore.getState().attachments.find((a) => a.id === l.objectId);
        return att ? visibleTaskIds.has(att.taskId) : false;
      }
      // Bug12修复: TEMPLATE日志对QA可见，移除PROCESSOR死代码
      if (l.objectType === 'TEMPLATE') return me.role === 'PM' || me.role === 'ADMIN' || me.role === 'QA';
      if (l.objectType === 'EXPORT') return roleCan(me.role, 'audit_export');
      return false;
    });
  }, [logs, visibleProjectIds, visibleTaskIds, me]);

  const filtered = useMemo(() => {
    return visibleLogs.filter((l) => {
      if (objectType !== 'ALL' && l.objectType !== objectType) return false;
      if (actorId !== 'ALL' && l.actorId !== actorId) return false;
      if (q && !`${l.action} ${l.objectId}`.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
  }, [visibleLogs, objectType, actorId, q]);

  const canExport = roleCan(me.role, 'audit_export');

  const onExport = () => {
    pushToast('success', '审计包已生成（演示）：包含任务清单、附件清单、审批记录、审计日志。');
  };

  return (
    <>
      <PageHeader
        title="审计中心"
        subtitle={`所有关键操作均会留痕。当前共 ${visibleLogs.length} 条日志，导出审计包用于内部或外部审计。`}
        actions={
          canExport && (
            <button onClick={onExport} className="btn btn-primary text-[12px]">
              <Download className="w-3.5 h-3.5" /> 导出审计包（HTML）
            </button>
          )
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3.5 mb-5">
        <AuditStat label="总日志数" value={visibleLogs.length} icon={FileText} tone="cobalt" />
        <AuditStat label="任务相关" value={visibleLogs.filter((l) => l.objectType === 'TASK').length} icon={ShieldCheck} tone="amber" />
        <AuditStat label="项目相关" value={visibleLogs.filter((l) => l.objectType === 'PROJECT').length} icon={ShieldCheck} tone="teal" />
        <AuditStat
          label="导出次数"
          value={visibleLogs.filter((l) => l.objectType === 'EXPORT').length}
          icon={Download}
          tone="ink"
        />
      </div>

      <div className="surface p-3.5 mb-5 flex items-center gap-2.5 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="搜索动作描述 / 对象 ID"
            className="w-full bg-ink-900/[0.03] border border-transparent focus:border-cobalt-500/40 focus:bg-white rounded-lg pl-9 pr-3 py-1.5 text-[12.5px] outline-none transition-all"
          />
        </div>
        <div className="flex items-center gap-1.5">
          <Filter className="w-3.5 h-3.5 text-ink-500" />
          <span className="text-[11.5px] text-ink-500">对象</span>
          {(['ALL', 'TASK', 'PROJECT', 'TEMPLATE', 'REVIEW', 'ATTACHMENT', 'EXPORT'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setObjectType(t)}
              className={cn(
                'chip transition-all',
                objectType === t
                  ? 'bg-ink-900 text-white border-ink-900'
                  : 'bg-ink-100 text-ink-600 border-ink-100 hover:bg-ink-200',
              )}
            >
              {t === 'ALL' ? '全部' : t}
            </button>
          ))}
        </div>
        <select
          className="field-select py-1 text-[12px] w-auto"
          value={actorId}
          onChange={(e) => setActorId(e.target.value)}
        >
          <option value="ALL">全部操作人</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
      </div>

      <section className="surface p-0 overflow-hidden">
        <table className="w-full text-[12.5px]">
          <thead className="bg-ink-50 text-[11px] text-ink-500">
            <tr>
              <th className="text-left px-3 py-2 font-medium">时间</th>
              <th className="text-left px-3 py-2 font-medium">操作人</th>
              <th className="text-left px-3 py-2 font-medium">动作</th>
              <th className="text-left px-3 py-2 font-medium">对象</th>
              <th className="text-left px-3 py-2 font-medium">详情</th>
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, 100).map((l) => {
              const actor = users.find((u) => u.id === l.actorId);
              const task = l.objectType === 'TASK' ? tasks.find((t) => t.id === l.objectId) : null;
              const project = l.objectType === 'PROJECT' ? projects.find((p) => p.id === l.objectId) : null;
              return (
                <tr key={l.id} className="border-t border-ink-900/5 hover:bg-ink-50">
                  <td className="px-3 py-2.5 align-top">
                    <div className="font-mono text-[12px] text-ink-800">{formatDate(l.createdAt, true)}</div>
                    <div className="text-[10.5px] text-ink-500 mt-0.5">{relativeFromNow(l.createdAt)}</div>
                  </td>
                  <td className="px-3 py-2.5 align-top">
                    <div className="flex items-center gap-1.5">
                      <Avatar userId={l.actorId} size={22} />
                      <div>
                        <div className="font-medium text-ink-800 text-[12.5px]">{actor?.name ?? '系统'}</div>
                        <div className="text-[10.5px] text-ink-500">{actor?.role}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 align-top">
                    <div className="text-ink-800 font-medium">{l.action}</div>
                  </td>
                  <td className="px-3 py-2.5 align-top">
                    <Chip tone="neutral" className="text-[10.5px]">{l.objectType}</Chip>
                    <div className="text-[10.5px] text-ink-500 font-mono mt-1">{l.objectId}</div>
                  </td>
                  <td className="px-3 py-2.5 align-top max-w-[280px]">
                    {task && (
                      <button
                        onClick={() => navigate(`/tasks/${task.id}`)}
                        className="text-cobalt-600 hover:underline text-[12px]"
                      >
                        {task.title}
                      </button>
                    )}
                    {project && (
                      <button
                        onClick={() => navigate(`/projects/${project.id}`)}
                        className="text-cobalt-600 hover:underline text-[12px]"
                      >
                        {project.name}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-10 text-center text-[12.5px] text-ink-500">
                  没有匹配的审计记录
                </td>
              </tr>
            )}
          </tbody>
        </table>
        {filtered.length > 100 && (
          <div className="text-center py-3 text-[11.5px] text-ink-500 border-t border-ink-900/5">
            显示前 100 条，共 {filtered.length} 条
          </div>
        )}
      </section>
    </>
  );
}

function AuditStat({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  tone: 'teal' | 'amber' | 'cobalt' | 'ink';
}) {
  const toneClass = {
    teal: 'bg-teal-50 text-teal-700',
    amber: 'bg-amber-500/15 text-amber-700',
    cobalt: 'bg-cobalt-50 text-cobalt-600',
    ink: 'bg-ink-100 text-ink-700',
  }[tone];
  return (
    <div className="surface p-4 flex items-center justify-between">
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
