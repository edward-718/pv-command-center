import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  CalendarClock,
  CheckSquare,
  ChevronDown,
  ClipboardList,
  Download,
  FileCheck,
  FileText,
  LayoutGrid,
  List,
  ListChecks,
  Plus,
  Search,
  ShieldCheck,
  Upload,
  X,
} from 'lucide-react';
import { useStore, selectVisibleTasks, selectVisibleProjects, roleCan } from '@/store/useStore';
import { PageHeader } from '@/components/TopBar';
import { Avatar, AvatarStack, RoleChip } from '@/components/Avatar';
import { Chip, PriorityTag, RiskTag, SeverityTag, StatusBadge, StatusFlowBar } from '@/components/Badge';
import { KanbanBoard } from '@/components/KanbanBoard';
import { cn, daysFromNow, dueUrgency, formatDate, getMissingEvidence, isOverdue, relativeFromNow } from '@/lib/utils';
import { exportTasksToCSV, parseCSVFile, autoMapColumns } from '@/lib/csv';
import {
  PROJECT_TYPE_LABEL,
  CASE_TYPE_LABEL,
  TASK_STATUS_LABEL,
  RISK_LABEL,
  type ProjectType,
  type Task,
  type TaskStatus,
  type RiskLevel,
  type SavedFilter,
} from '@/types';

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
  const projects = useStore((s) => s.projects);
  const templates = useStore((s) => s.templates);
  const users = useStore((s) => s.users);
  const tasksAll = useStore((s) => s.tasks);
  const aiDrafts = useStore((s) => s.aiDrafts);
  const auditLogs = useStore((s) => s.auditLogs);
  const reviews = useStore((s) => s.reviews);
  const pushToast = useStore((s) => s.pushToast);
  const allAttachments = useStore((s) => s.attachments);
  const savedFilters = useStore((s) => s.savedFilters);
  const batchUpdateTasks = useStore((s) => s.batchUpdateTasks);
  const saveFilter = useStore((s) => s.saveFilter);
  const deleteFilter = useStore((s) => s.deleteFilter);
  const importTasksFromCSV = useStore((s) => s.importTasksFromCSV);
  const logCSVExport = useStore((s) => s.logCSVExport);

  const tasks = useMemo(
    () => (project ? selectVisibleTasks({ ...useStore.getState(), projects, tasks: tasksAll }, me).filter((t) => t.projectId === project.id) : []),
    [project, tasksAll, me, projects],
  );

  const projectVisible = useMemo(() => {
    if (!project || !me) return false;
    const visibleProjects = selectVisibleProjects({ ...useStore.getState(), projects, currentUser: me }, me);
    return visibleProjects.some((p) => p.id === project.id);
  }, [project, me, projects]);

  const [tab, setTab] = useState<Tab>('overview');
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>(() => {
    return (localStorage.getItem('pv-view-mode') as 'list' | 'kanban') || 'list';
  });
  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'ALL'>('ALL');
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  const [showBatchBar, setShowBatchBar] = useState(false);

  // Advanced search state
  const [advKeyword, setAdvKeyword] = useState('');
  const [advAssigneeIds, setAdvAssigneeIds] = useState<string[]>([]);
  const [advDueFrom, setAdvDueFrom] = useState('');
  const [advDueTo, setAdvDueTo] = useState('');
  const [advRiskLevels, setAdvRiskLevels] = useState<RiskLevel[]>([]);
  const [advStatuses, setAdvStatuses] = useState<TaskStatus[]>([]);
  const [advSeriousness, setAdvSeriousness] = useState<string[]>([]);

  // CSV import dialog
  const [showCSVImport, setShowCSVImport] = useState(false);
  const [csvPreview, setCsvPreview] = useState<{ headers: string[]; rows: Record<string, string>[] } | null>(null);
  const [csvMapping, setCsvMapping] = useState<Record<string, string>>({});
  const [csvFileName, setCsvFileName] = useState('');

  // Batch operation
  const [batchAction, setBatchAction] = useState<{ type: 'assign' | 'risk' | 'dueDate'; value: string } | null>(null);
  const [showBatchConfirm, setShowBatchConfirm] = useState(false);

  // Bug1修复: 所有useMemo必须在早期return之前
  const filteredTasks = useMemo(() => {
    if (!project) return [];
    let result = tasks;
    if (statusFilter !== 'ALL') result = result.filter((t) => t.status === statusFilter);
    if (advKeyword) {
      const kw = advKeyword.toLowerCase();
      result = result.filter((t) => t.title.toLowerCase().includes(kw) || (t.caseId ?? '').toLowerCase().includes(kw));
    }
    if (advAssigneeIds.length > 0) result = result.filter((t) => t.assigneeId && advAssigneeIds.includes(t.assigneeId));
    if (advDueFrom) result = result.filter((t) => t.dueAt >= advDueFrom);
    if (advDueTo) {
      if (advDueFrom && advDueTo < advDueFrom) {
        // 无效范围，不应用截止日筛选
      } else {
        result = result.filter((t) => t.dueAt <= advDueTo + 'T23:59:59');
      }
    }
    if (advRiskLevels.length > 0) result = result.filter((t) => advRiskLevels.includes(t.riskLevel));
    if (advStatuses.length > 0) result = result.filter((t) => advStatuses.includes(t.status));
    if (advSeriousness.length > 0) result = result.filter((t) => t.seriousness && advSeriousness.includes(t.seriousness));
    return result;
  }, [project, tasks, statusFilter, advKeyword, advAssigneeIds, advDueFrom, advDueTo, advRiskLevels, advStatuses, advSeriousness]);

  const canBatch = me.role === 'PM' || me.role === 'ADMIN';

  // Bug20: 当筛选条件变化时，清理已不存在的选中任务ID
  const validSelectedTaskIds = useMemo(() => {
    return new Set([...selectedTaskIds].filter((id) => filteredTasks.some((t) => t.id === id)));
  }, [selectedTaskIds, filteredTasks]);

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

  if (!projectVisible) {
    return (
      <div className="surface p-10 text-center">
        <div className="text-[14px] font-semibold text-ink-800">无权限访问该项目</div>
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

  const toggleViewMode = (mode: 'list' | 'kanban') => {
    setViewMode(mode);
    localStorage.setItem('pv-view-mode', mode);
  };

  const toggleTaskSelection = (taskId: string) => {
    setSelectedTaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      setShowBatchBar(next.size > 0);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (validSelectedTaskIds.size === filteredTasks.length) {
      setSelectedTaskIds(new Set());
      setShowBatchBar(false);
    } else {
      setSelectedTaskIds(new Set(filteredTasks.map((t) => t.id)));
      setShowBatchBar(true);
    }
  };

  const executeBatch = () => {
    if (!batchAction || !batchAction.value) return;
    setShowBatchConfirm(true);
  };

  const confirmBatch = () => {
    if (!batchAction) return;
    const ids = Array.from(validSelectedTaskIds);
    if (batchAction.type === 'assign') {
      batchUpdateTasks(ids, { type: 'assign', assigneeId: batchAction.value });
    } else if (batchAction.type === 'risk') {
      batchUpdateTasks(ids, { type: 'risk', riskLevel: batchAction.value as RiskLevel });
    } else if (batchAction.type === 'dueDate') {
      batchUpdateTasks(ids, { type: 'dueDate', deltaDays: parseInt(batchAction.value) || 0 });
    }
    setSelectedTaskIds(new Set());
    setShowBatchBar(false);
    setBatchAction(null);
    setShowBatchConfirm(false);
  };

  const batchActionLabel = () => {
    if (!batchAction) return '';
    if (batchAction.type === 'assign') return `分配负责人：${users.find((u) => u.id === batchAction.value)?.name ?? batchAction.value}`;
    if (batchAction.type === 'risk') return `调整风险等级：${batchAction.value === 'HIGH' ? '高' : batchAction.value === 'MEDIUM' ? '中' : '低'}`;
    if (batchAction.type === 'dueDate') return `截止日延后 ${batchAction.value} 天`;
    return '';
  };

  const handleExportCSV = () => {
    if (filteredTasks.length === 0) {
      pushToast('error', '没有可导出的任务');
      return;
    }
    exportTasksToCSV(filteredTasks, users, [project!], allAttachments);
    logCSVExport(filteredTasks.length);
    pushToast('success', `已导出 ${filteredTasks.length} 条任务`);
  };

  const handleCSVFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const parsed = await parseCSVFile(file);
      if (parsed.rows.length === 0) {
        pushToast('error', '文件中没有有效数据行');
        e.target.value = '';
        return;
      }
      setCsvPreview(parsed);
      setCsvMapping(autoMapColumns(parsed.headers));
      setCsvFileName(file.name);
      setShowCSVImport(true);
    } catch (err) {
      pushToast('error', 'CSV文件解析失败，请检查文件格式');
    }
    e.target.value = '';
  };

  const handleCSVImport = () => {
    if (!csvPreview) return;
    // Bug22/23: 验证至少映射了title必填字段
    const hasTitleMapping = Object.values(csvMapping).some((v) => v === 'title');
    if (!hasTitleMapping) {
      pushToast('error', '请至少将一个CSV列映射到"任务标题"字段');
      return;
    }
    const report = importTasksFromCSV(csvPreview.rows, csvMapping as Record<string, keyof Task>);
    // Bug7修复: 完整反馈（全部失败/完全成功/部分成功）
    if (report.successCount === 0 && report.errors.length > 0) {
      pushToast('error', `导入失败：全部 ${report.skippedCount} 行被跳过`);
    } else if (report.errors.length === 0) {
      pushToast('success', `导入成功：${report.successCount} 条任务`);
    } else {
      const errorDetail = report.errors.slice(0, 3).map((e) => `第${e.row}行: ${e.reason}`).join('\n');
      pushToast('info', `成功 ${report.successCount}，跳过 ${report.skippedCount}。\n${errorDetail}${report.errors.length > 3 ? '\n...' : ''}`);
    }
    setShowCSVImport(false);
    setCsvPreview(null);
    setCsvMapping({});
    setCsvFileName('');
  };

  const handleSaveFilter = () => {
    const name = prompt('请输入快捷筛选名称');
    if (!name) return;
    saveFilter(name, {
      keyword: advKeyword,
      projectIds: project ? [project.id] : [],
      assigneeIds: advAssigneeIds,
      dueDateFrom: advDueFrom,
      dueDateTo: advDueTo,
      riskLevels: advRiskLevels,
      statuses: advStatuses,
      seriousnessLevels: advSeriousness as NonNullable<Task['seriousness']>[],
    });
  };

  const applySavedFilter = (f: SavedFilter) => {
    // Bug39: 重置statusFilter避免与saved statuses冲突
    setStatusFilter('ALL');
    setAdvKeyword(f.conditions.keyword);
    setAdvAssigneeIds(f.conditions.assigneeIds);
    setAdvDueFrom(f.conditions.dueDateFrom);
    setAdvDueTo(f.conditions.dueDateTo);
    setAdvRiskLevels(f.conditions.riskLevels);
    setAdvStatuses(f.conditions.statuses);
    setAdvSeriousness(f.conditions.seriousnessLevels);
    setShowAdvancedSearch(true);
  };

  const resetAdvancedSearch = () => {
    setAdvKeyword('');
    setAdvAssigneeIds([]);
    setAdvDueFrom('');
    setAdvDueTo('');
    setAdvRiskLevels([]);
    setAdvStatuses([]);
    setAdvSeriousness([]);
  };

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

      {/* 法规与监管 */}
      {(project.regulatoryRule || project.dayZero || project.submissions.length > 0) && (
        <div className="surface p-4 mb-5">
          <h3 className="font-display text-[13.5px] font-semibold mb-3 flex items-center gap-2">
            <FileCheck className="w-4 h-4 text-teal-600" /> 法规与监管
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-lg bg-ink-900/[0.02] border border-ink-900/5 p-3">
              <div className="text-[10.5px] uppercase tracking-widest text-ink-500 mb-1">法规规则</div>
              <div className="text-[13px] font-semibold text-ink-800">
                {project.regulatoryRule ?? '未设置'}
              </div>
            </div>
            <div className="rounded-lg bg-ink-900/[0.02] border border-ink-900/5 p-3">
              <div className="text-[10.5px] uppercase tracking-widest text-ink-500 mb-1">Day 0</div>
              <div className="text-[13px] font-semibold text-ink-800 font-mono">
                {project.dayZero ? formatDate(project.dayZero, true) : '未设置'}
              </div>
            </div>
            <div className="rounded-lg bg-ink-900/[0.02] border border-ink-900/5 p-3">
              <div className="text-[10.5px] uppercase tracking-widest text-ink-500 mb-1">病例类型</div>
              <div className="text-[13px] font-semibold text-ink-800">
                {project.caseType ? CASE_TYPE_LABEL[project.caseType] : '未分类'}
              </div>
            </div>
            <div className="rounded-lg bg-ink-900/[0.02] border border-ink-900/5 p-3">
              <div className="text-[10.5px] uppercase tracking-widest text-ink-500 mb-1">提交记录</div>
              <div className="text-[13px] font-semibold text-ink-800">
                {project.submissions.length} 条
              </div>
            </div>
          </div>
          {project.submissions.length > 0 && (
            <div className="mt-4 pt-3 border-t border-ink-900/5">
              <div className="text-[11.5px] font-semibold text-ink-700 mb-2">最新提交</div>
              <div className="space-y-2">
                {project.submissions
                  .sort((a, b) => new Date(b.submitDate).getTime() - new Date(a.submitDate).getTime())
                  .slice(0, 2)
                  .map((sub) => (
                    <div key={sub.id} className="flex items-center justify-between text-[12px]">
                      <div className="flex items-center gap-2">
                        <span className="text-ink-800 font-medium">{sub.agency}</span>
                        <span className="text-ink-500">· {sub.channel}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-ink-500 font-mono">{formatDate(sub.submitDate, true)}</span>
                        <Chip tone={sub.status === 'CONFIRMED' ? 'teal' : sub.status === 'RETURNED' ? 'danger' : sub.status === 'SUBMITTED' ? 'cobalt' : 'neutral'} className="text-[10px]">
                          {sub.status === 'PENDING' ? '待提交' : sub.status === 'SUBMITTED' ? '已提交' : sub.status === 'CONFIRMED' ? '已确认' : '被退回'}
                        </Chip>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}

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
          {/* Toolbar */}
          <div className="flex items-center gap-2 mb-3 px-1 flex-wrap">
            <div className="flex items-center gap-1 bg-ink-50 rounded-lg p-0.5">
              <button
                onClick={() => toggleViewMode('list')}
                className={cn('flex items-center gap-1 px-2.5 py-1 rounded text-[12px] font-medium transition-colors', viewMode === 'list' ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-500 hover:text-ink-700')}
              >
                <List className="w-3.5 h-3.5" /> 列表
              </button>
              <button
                onClick={() => toggleViewMode('kanban')}
                className={cn('flex items-center gap-1 px-2.5 py-1 rounded text-[12px] font-medium transition-colors', viewMode === 'kanban' ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-500 hover:text-ink-700')}
              >
                <LayoutGrid className="w-3.5 h-3.5" /> 看板
              </button>
            </div>
            <div className="flex-1 min-w-[180px] relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-400" />
              <input
                className="field-input pl-8 text-[12px] py-1.5"
                placeholder="搜索任务标题或病例编号..."
                value={advKeyword}
                onChange={(e) => setAdvKeyword(e.target.value)}
              />
            </div>
            <button
              onClick={() => setShowAdvancedSearch(!showAdvancedSearch)}
              className={cn('btn btn-ghost text-[12px]', showAdvancedSearch && 'text-cobalt-600')}
            >
              <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', showAdvancedSearch && 'rotate-180')} /> 高级搜索
            </button>
            {roleCan(me.role, 'create_project') && (
              <>
                <button onClick={handleExportCSV} className="btn btn-ghost text-[12px]">
                  <Download className="w-3.5 h-3.5" /> 导出CSV
                </button>
                <label className="btn btn-ghost text-[12px] cursor-pointer">
                  <Upload className="w-3.5 h-3.5" /> 导入CSV
                  <input type="file" accept=".csv" className="hidden" onChange={handleCSVFileSelect} />
                </label>
              </>
            )}
          </div>

          {/* Quick filters */}
          {savedFilters.length > 0 && (
            <div className="flex items-center gap-1.5 mb-3 px-1 flex-wrap">
              {savedFilters
                .filter((f) => f.createdBy === me.id || me.role === 'ADMIN')
                .map((f) => (
                  <div key={f.id} className="flex items-center gap-0.5">
                    <button
                      onClick={() => applySavedFilter(f)}
                      className="chip bg-cobalt-50 text-cobalt-700 border-cobalt-200 hover:bg-cobalt-100 text-[11px]"
                    >
                      {f.name}
                    </button>
                    <button
                      onClick={() => deleteFilter(f.id)}
                      className="text-ink-400 hover:text-danger-600 text-[10px] px-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
            </div>
          )}

          {/* Advanced search panel */}
          {showAdvancedSearch && (
            <div className="mb-3 p-3 bg-ink-50 rounded-lg border border-ink-900/5">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                <div>
                  <label className="field-label text-[10.5px]">负责人</label>
                  <select
                    multiple
                    className="field-select text-[11px] min-h-[60px]"
                    value={advAssigneeIds}
                    onChange={(e) => setAdvAssigneeIds(Array.from(e.target.selectedOptions).map((o) => o.value))}
                  >
                    {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="field-label text-[10.5px]">截止日范围</label>
                  <input type="date" className="field-input text-[11px] py-1" value={advDueFrom} onChange={(e) => setAdvDueFrom(e.target.value)} />
                  <input type="date" className="field-input text-[11px] py-1 mt-1" value={advDueTo} onChange={(e) => setAdvDueTo(e.target.value)} />
                </div>
                <div>
                  <label className="field-label text-[10.5px]">风险等级</label>
                  <div className="flex flex-col gap-1">
                    {(['HIGH', 'MEDIUM', 'LOW'] as RiskLevel[]).map((r) => (
                      <label key={r} className="flex items-center gap-1.5 text-[11px]">
                        <input type="checkbox" checked={advRiskLevels.includes(r)} onChange={() => setAdvRiskLevels((prev) => prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r])} />
                        {RISK_LABEL[r]}
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="field-label text-[10.5px]">状态</label>
                  <div className="flex flex-col gap-1">
                    {(['NOT_STARTED', 'IN_PROGRESS', 'IN_REVIEW', 'NEEDS_INFO', 'DONE'] as TaskStatus[]).map((s) => (
                      <label key={s} className="flex items-center gap-1.5 text-[11px]">
                        <input type="checkbox" checked={advStatuses.includes(s)} onChange={() => setAdvStatuses((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s])} />
                        {TASK_STATUS_LABEL[s]}
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="field-label text-[10.5px]">严重性</label>
                  <div className="flex flex-col gap-1">
                    {(['SERIOUS', 'NON_SERIOUS'] as const).map((s) => (
                      <label key={s} className="flex items-center gap-1.5 text-[11px]">
                        <input type="checkbox" checked={advSeriousness.includes(s)} onChange={() => setAdvSeriousness((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s])} />
                        {s === 'SERIOUS' ? '严重' : '非严重'}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 mt-3">
                <button onClick={resetAdvancedSearch} className="btn btn-ghost text-[11px]">重置</button>
                <button onClick={handleSaveFilter} className="btn btn-soft text-[11px]">保存为快捷筛选</button>
              </div>
            </div>
          )}

          {/* Status filter chips */}
          <div className="flex items-center gap-1.5 mb-3 px-2 flex-wrap">
            <span className="text-[11.5px] text-ink-500 mr-1.5">状态</span>
            {(['ALL', 'NOT_STARTED', 'IN_PROGRESS', 'IN_REVIEW', 'NEEDS_INFO', 'DONE'] as const).map((s) => (
              <button key={s} onClick={() => setStatusFilter(s)} className={cn('chip transition-all', statusFilter === s ? 'bg-ink-900 text-white border-ink-900' : 'bg-ink-100 text-ink-600 border-ink-100 hover:bg-ink-200')}>
                {s === 'ALL' ? '全部' : TASK_STATUS_LABEL[s]}
              </button>
            ))}
            <span className="ml-auto text-[11.5px] text-ink-500">共 {filteredTasks.length} 个任务</span>
          </div>

          {/* Kanban View */}
          {viewMode === 'kanban' ? (
            <KanbanBoard tasks={filteredTasks} onTaskClick={(id) => navigate(`/tasks/${id}`)} />
          ) : (
            <>
              {/* List View with checkboxes */}
              <div className="overflow-x-auto">
                <table className="w-full text-[12.5px]">
                  <thead className="text-[11px] text-ink-500 bg-ink-50 border-b border-ink-900/5">
                    <tr>
                      {canBatch && (
                        <th className="text-left px-3 py-2 font-medium w-8">
                          <input type="checkbox" checked={validSelectedTaskIds.size === filteredTasks.length && filteredTasks.length > 0} onChange={toggleSelectAll} />
                        </th>
                      )}
                      <th className="text-left px-3 py-2 font-medium">任务</th>
                      <th className="text-left px-3 py-2 font-medium">状态</th>
                      <th className="text-left px-3 py-2 font-medium">负责人</th>
                      <th className="text-left px-3 py-2 font-medium">截止</th>
                      <th className="text-left px-3 py-2 font-medium">证据</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTasks.map((t) => (
                      <tr key={t.id} className="border-b border-ink-900/5 hover:bg-ink-50 cursor-pointer" onClick={() => navigate(`/tasks/${t.id}`)}>
                        {canBatch && (
                          <td className="px-3 py-2.5" onClick={(e) => { e.stopPropagation(); toggleTaskSelection(t.id); }}>
                            <input type="checkbox" checked={validSelectedTaskIds.has(t.id)} onChange={() => {}} />
                          </td>
                        )}
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-2 mb-1">
                            <div className="font-semibold text-ink-900">{t.title}</div>
                            {t.blocked && <span className="chip chip-mono text-[10px] bg-danger-50 text-danger-700 border-danger-200">阻塞</span>}
                            {t.followUpRound > 0 && <span className="chip chip-mono text-[10px] bg-cobalt-50 text-cobalt-700 border-cobalt-200">随访-{t.followUpRound}</span>}
                          </div>
                          <div className="text-[10.5px] text-ink-500 font-mono">{t.caseId ?? '—'} · {t.type}</div>
                        </td>
                        <td className="px-3 py-2.5"><StatusBadge status={t.status} /></td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-1.5">
                            <Avatar userId={t.assigneeId} size={20} />
                            <span className="text-ink-700">{users.find((u) => u.id === t.assigneeId)?.name ?? '待分配'}</span>
                          </div>
                        </td>
                        <td className="px-3 py-2.5">
                          <div className={cn('font-mono', { 'text-danger-600 font-semibold': dueUrgency(t.dueAt) === 'overdue', 'text-amber-700': dueUrgency(t.dueAt) === 'today' || dueUrgency(t.dueAt) === 'soon', 'text-ink-700': dueUrgency(t.dueAt) === 'ok' })}>
                            {formatDate(t.dueAt)}
                          </div>
                          <div className="text-[10.5px] text-ink-500 mt-0.5">{relativeFromNow(t.dueAt)}</div>
                        </td>
                        <td className="px-3 py-2.5"><EvidenceProgress task={t} /></td>
                      </tr>
                    ))}
                    {filteredTasks.length === 0 && (
                <tr><td colSpan={canBatch ? 6 : 5} className="px-3 py-10 text-center text-[12.5px] text-ink-500">没有匹配的任务</td></tr>
              )}
                  </tbody>
                </table>
              </div>

              {/* Batch operation floating bar */}
              {canBatch && showBatchBar && validSelectedTaskIds.size > 0 && (
                <div className="sticky bottom-0 left-0 right-0 bg-ink-900 text-white rounded-lg shadow-panel p-3 mt-3 flex items-center gap-3 flex-wrap">
                  <span className="text-[12px] font-medium">已选择 {validSelectedTaskIds.size} 个任务</span>
                  <select className="text-[11px] bg-ink-800 text-white border border-ink-700 rounded px-2 py-1" value={batchAction?.type === 'assign' ? batchAction.value : ''} onChange={(e) => setBatchAction({ type: 'assign', value: e.target.value })}>
                    <option value="">分配负责人...</option>
                    {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                  <select className="text-[11px] bg-ink-800 text-white border border-ink-700 rounded px-2 py-1" value={batchAction?.type === 'risk' ? batchAction.value : ''} onChange={(e) => setBatchAction({ type: 'risk', value: e.target.value })}>
                    <option value="">调整风险...</option>
                    <option value="HIGH">高</option>
                    <option value="MEDIUM">中</option>
                    <option value="LOW">低</option>
                  </select>
                  <select className="text-[11px] bg-ink-800 text-white border border-ink-700 rounded px-2 py-1" value={batchAction?.type === 'dueDate' ? batchAction.value : ''} onChange={(e) => setBatchAction({ type: 'dueDate', value: e.target.value })}>
                    <option value="">截止日调整...</option>
                    <option value="1">+1天</option>
                    <option value="3">+3天</option>
                    <option value="7">+7天</option>
                    <option value="14">+14天</option>
                  </select>
                  <button onClick={executeBatch} disabled={!batchAction || !batchAction.value} className="btn btn-primary text-[12px] disabled:opacity-50">执行</button>
                  <button onClick={() => { setSelectedTaskIds(new Set()); setShowBatchBar(false); setBatchAction(null); }} className="btn btn-ghost text-[12px] text-white hover:bg-ink-800">取消</button>
                </div>
              )}
            </>
          )}

          {/* Batch operation confirmation dialog */}
          {showBatchConfirm && batchAction && (
            <div className="fixed inset-0 bg-ink-900/40 flex items-center justify-center z-50" onClick={() => setShowBatchConfirm(false)}>
              <div className="bg-white rounded-xl shadow-xl max-w-sm w-full mx-4" onClick={(e) => e.stopPropagation()}>
                <div className="p-5">
                  <h3 className="font-display text-[14px] font-semibold mb-2">确认批量操作</h3>
                  <div className="text-[12.5px] text-ink-600 space-y-1.5">
                    <div>影响任务数量：<span className="font-semibold text-ink-900">{validSelectedTaskIds.size} 个</span></div>
                    <div>操作类型：<span className="font-semibold text-ink-900">{batchActionLabel()}</span></div>
                  </div>
                </div>
                <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-ink-900/5">
                  <button onClick={() => setShowBatchConfirm(false)} className="btn btn-ghost text-[12px]">取消</button>
                  <button onClick={confirmBatch} className="btn btn-primary text-[12px]">确认执行</button>
                </div>
              </div>
            </div>
          )}

          {/* CSV Import Preview Dialog */}
          {showCSVImport && csvPreview && (
            <div className="fixed inset-0 bg-ink-900/40 flex items-center justify-center z-50" onClick={() => setShowCSVImport(false)}>
              <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between p-5 border-b border-ink-900/5">
                  <h3 className="font-display text-[15px] font-semibold">导入 CSV 任务</h3>
                  <button onClick={() => setShowCSVImport(false)} className="text-ink-400 hover:text-ink-700"><X className="w-4 h-4" /></button>
                </div>
                <div className="p-5 space-y-4">
                  <div className="text-[12px] text-ink-600">已选择文件：{csvFileName}（{csvPreview.rows.length} 行）</div>
                  <div>
                    <h4 className="text-[12.5px] font-semibold mb-2">字段映射</h4>
                    <div className="space-y-1.5">
                      {csvPreview.headers.map((h) => (
                        <div key={h} className="flex items-center gap-2 text-[11.5px]">
                          <span className="text-ink-600 min-w-[120px]">CSV「{h}」</span>
                          <span className="text-ink-400">→</span>
                          <select className="field-select text-[11px] py-0.5" value={csvMapping[h] || ''} onChange={(e) => setCsvMapping({ ...csvMapping, [h]: e.target.value })}>
                            <option value="">忽略</option>
                            <option value="title">任务标题</option>
                            <option value="assigneeId">负责人</option>
                            <option value="dueAt">截止日</option>
                            <option value="riskLevel">风险等级</option>
                            <option value="projectId">项目ID</option>
                            <option value="description">描述</option>
                          </select>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h4 className="text-[12.5px] font-semibold mb-2">数据预览（前 5 行）</h4>
                    <div className="overflow-x-auto">
                      <table className="w-full text-[11px] border border-ink-900/5 rounded">
                        <thead className="bg-ink-50">
                          <tr>{csvPreview.headers.map((h) => <th key={h} className="px-2 py-1 text-left font-medium">{h}</th>)}</tr>
                        </thead>
                        <tbody>
                          {csvPreview.rows.slice(0, 5).map((row, i) => (
                            <tr key={i} className="border-t border-ink-900/5">
                              {csvPreview.headers.map((h) => <td key={h} className="px-2 py-1">{row[h]}</td>)}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <div className="text-[12px] text-ink-600">预计导入：{Math.min(csvPreview.rows.length, 100)} 条{csvPreview.rows.length > 100 ? `（共 ${csvPreview.rows.length} 行，仅导入前 100 行）` : ''}</div>
                </div>
                <div className="flex items-center justify-end gap-2 p-5 border-t border-ink-900/5">
                  <button onClick={() => setShowCSVImport(false)} className="btn btn-ghost text-[12px]">取消</button>
                  <button onClick={handleCSVImport} className="btn btn-primary text-[12px]">开始导入</button>
                </div>
              </div>
            </div>
          )}
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
  const allAttachments = useStore((s) => s.attachments);
  const missing = getMissingEvidence(task.requiredEvidence, task.evidenceUploaded, allAttachments);
  const have = task.requiredEvidence.length - missing.length;
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
