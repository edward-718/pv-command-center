import { useEffect, useMemo, useState } from 'react';
import { useStore, roleCan, selectVisibleProjects } from '@/store/useStore';
import { PageHeader } from '@/components/TopBar';
import { Chip } from '@/components/Badge';
import { cn, formatDate, relativeFromNow } from '@/lib/utils';
import { CheckCircle2, FileText, Sparkles, Wand2 } from 'lucide-react';
import { PROJECT_TYPE_LABEL, type AIDraft, type Project } from '@/types';

type DraftKind = 'WEEKLY' | 'MEETING' | 'CAPA' | 'RISK';

const KIND_OPTIONS: { kind: DraftKind; label: string; desc: string }[] = [
  { kind: 'WEEKLY', label: '周报草稿', desc: '基于本周任务进展自动汇总' },
  { kind: 'MEETING', label: '会议纪要', desc: '根据最近动作生成讨论纪要' },
  { kind: 'CAPA', label: 'CAPA 初稿', desc: '针对偏差与根因生成行动项' },
  { kind: 'RISK', label: '风险摘要', desc: '梳理当前高风险任务与影响' },
];

const KIND_TONE: Record<DraftKind, string> = {
  WEEKLY: 'bg-cobalt-50 text-cobalt-700 border-cobalt-200',
  MEETING: 'bg-teal-50 text-teal-700 border-teal-200',
  CAPA: 'bg-amber-500/10 text-amber-700 border-amber-500/30',
  RISK: 'bg-danger-500/10 text-danger-700 border-danger-500/30',
};

export function AIPage() {
  const me = useStore((s) => s.currentUser)!;
  const allProjects = useStore((s) => s.projects);
  const tasks = useStore((s) => s.tasks);
  const users = useStore((s) => s.users);
  const drafts = useStore((s) => s.aiDrafts);
  const saveDraft = useStore((s) => s.saveAIDraft);
  const confirmDraft = useStore((s) => s.confirmAIDraft); // Bug18修复: 改名避免遮蔽window.confirm

  const projects = useMemo(
    () => selectVisibleProjects({ ...useStore.getState(), currentUser: me }, me),
    [me, allProjects, tasks],
  );

  const [selectedProject, setSelectedProject] = useState<Project | null>(projects[0] ?? null);
  // Bug17修复: projects变化时同步selectedProject
  useEffect(() => {
    if (projects.length > 0 && !selectedProject) {
      setSelectedProject(projects[0]);
    } else if (selectedProject && !projects.some((p) => p.id === selectedProject.id)) {
      setSelectedProject(projects[0] ?? null);
    }
  }, [projects, selectedProject]);

  const [kind, setKind] = useState<DraftKind>('WEEKLY');
  const [generating, setGenerating] = useState(false);
  const [preview, setPreview] = useState<string>('');

  const canConfirm = roleCan(me.role, 'confirm_ai');

  const generate = async () => {
    if (!selectedProject) return;
    setGenerating(true);
    setPreview('');
    await new Promise((r) => setTimeout(r, 700));
    const text = renderDraft(selectedProject, kind, tasks, users);
    setPreview(text);
    setGenerating(false);
  };

  const onSave = () => {
    if (!selectedProject || !preview) return;
    saveDraft(selectedProject.id, kind, preview);
    setPreview('');
  };

  return (
    <>
      <PageHeader
        title="AI 工作助手"
        subtitle="基于项目数据生成草稿：周报、会议纪要、CAPA 初稿、风险摘要。所有输出默认为草稿，必须由人工确认。"
        meta={[
          <Chip key="warn" tone="amber">
            <Sparkles className="w-3 h-3" /> AI 仅为草稿生成器
          </Chip>,
        ]}
      />

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.4fr] gap-5">
        <section className="surface p-5 space-y-5">
          <div>
            <div className="text-[11px] uppercase tracking-widest text-ink-500 mb-2">项目</div>
            <div className="space-y-1.5 max-h-[260px] overflow-y-auto scrollbar-thin">
              {projects.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSelectedProject(p)}
                  className={cn(
                    'w-full text-left px-3 py-2 rounded-lg border transition-all flex items-center gap-2',
                    selectedProject?.id === p.id
                      ? 'border-teal-500/40 bg-teal-50/30'
                      : 'border-ink-900/5 hover:border-ink-900/15',
                  )}
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-cobalt-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-[12.5px] font-semibold text-ink-900 truncate">{p.name}</div>
                    <div className="text-[10.5px] text-ink-500 font-mono">
                      {p.code} · {PROJECT_TYPE_LABEL[p.type]}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="text-[11px] uppercase tracking-widest text-ink-500 mb-2">草稿类型</div>
            <div className="grid grid-cols-2 gap-1.5">
              {KIND_OPTIONS.map((o) => (
                <button
                  key={o.kind}
                  onClick={() => setKind(o.kind)}
                  className={cn(
                    'text-left p-2.5 rounded-lg border transition-all',
                    kind === o.kind
                      ? 'border-cobalt-500/40 bg-cobalt-50/40'
                      : 'border-ink-900/5 hover:border-ink-900/15',
                  )}
                >
                  <div className="text-[12.5px] font-semibold text-ink-900">{o.label}</div>
                  <div className="text-[10.5px] text-ink-500 mt-0.5">{o.desc}</div>
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={generate}
            disabled={!selectedProject || generating}
            className="btn btn-primary w-full"
          >
            <Wand2 className="w-3.5 h-3.5" />
            {generating ? '生成中…' : '生成草稿'}
          </button>

          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-[11.5px] text-amber-900 leading-relaxed">
            ⚠ AI 输出默认标记为<span className="font-semibold"> 草稿</span>，
            <span className="font-semibold"> 不自动改变任务状态、不自动外发、不替代医学判断</span>。
            需要有权限的角色确认后才能作为正式记录。
          </div>
        </section>

        <section className="surface p-5 flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display text-[15px] font-semibold flex items-center gap-2">
              <FileText className="w-4 h-4 text-cobalt-600" /> 草稿预览
            </h3>
            {preview && (
              <div className="flex items-center gap-1.5">
                <button onClick={onSave} className="btn btn-soft text-[12px]">
                  保存为草稿
                </button>
              </div>
            )}
          </div>

          {generating ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="w-10 h-10 rounded-full bg-cobalt-50 mx-auto flex items-center justify-center mb-3">
                  <Sparkles className="w-4 h-4 text-cobalt-600 animate-pulse-soft" />
                </div>
                <div className="text-[13px] font-medium text-ink-800">AI 正在汇总项目数据</div>
                <div className="text-[11.5px] text-ink-500 mt-1">基于任务、证据、审计日志生成</div>
              </div>
            </div>
          ) : preview ? (
            <div className="flex-1 overflow-y-auto scrollbar-thin">
              <MarkdownPreview text={preview} />
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center max-w-sm">
                <div className="w-12 h-12 rounded-2xl bg-cobalt-50 mx-auto flex items-center justify-center mb-3">
                  <Sparkles className="w-5 h-5 text-cobalt-600" />
                </div>
                <div className="text-[14px] font-semibold text-ink-800">选择项目 + 草稿类型后开始生成</div>
                <div className="text-[12px] text-ink-500 mt-2 leading-relaxed">
                  AI 会从任务状态、证据、审计日志和近期评论中提取关键信息，
                  不会改变任何任务状态或外发内容。
                </div>
              </div>
            </div>
          )}
        </section>
      </div>

      {/* 历史草稿 */}
      <section className="surface p-5 mt-5">
        <h3 className="font-display text-[15px] font-semibold mb-3">历史草稿</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {drafts
            .filter((d) => projects.some((p) => p.id === d.projectId))
            .map((d) => {
              const p = projects.find((x) => x.id === d.projectId);
              return (
                <div key={d.id} className="rounded-xl border border-ink-900/5 p-3.5">
                  <div className="flex items-center gap-2 flex-wrap mb-1.5">
                    <span className={cn('chip chip-mono', KIND_TONE[d.kind])}>
                      {d.kind === 'WEEKLY' ? '周报' : d.kind === 'MEETING' ? '会议纪要' : d.kind === 'CAPA' ? 'CAPA' : '风险'}
                    </span>
                    <span className="text-[10.5px] text-ink-500 font-mono">
                      {p?.code} · {formatDate(d.createdAt)} · {relativeFromNow(d.createdAt)}
                    </span>
                    {d.confirmed ? (
                      <Chip tone="teal" className="ml-auto text-[10px]">
                        <CheckCircle2 className="w-2.5 h-2.5" /> 已确认
                      </Chip>
                    ) : (
                      <Chip tone="amber" className="ml-auto text-[10px]">草稿</Chip>
                    )}
                  </div>
                  <div className="text-[12px] text-ink-700 leading-relaxed line-clamp-3">
                    {d.content.replace(/[#*`>]/g, '').slice(0, 220)}…
                  </div>
                  {!d.confirmed && canConfirm && (
                    <div className="mt-2.5 flex items-center gap-1.5">
                      <button
                        onClick={() => confirmDraft(d.id)}
                        className="btn btn-soft text-[11.5px] py-1"
                      >
                        <CheckCircle2 className="w-3 h-3" /> 确认为正式记录
                      </button>
                      <span className="text-[10.5px] text-ink-500">确认后写入审计日志</span>
                    </div>
                  )}
                </div>
              );
            })}
          {drafts.filter((d) => projects.some((p) => p.id === d.projectId)).length === 0 && (
            <div className="col-span-full text-center py-8 text-[12.5px] text-ink-500">
              暂无历史草稿
            </div>
          )}
        </div>
      </section>
    </>
  );
}

function MarkdownPreview({ text }: { text: string }) {
  // 极简 Markdown 渲染：标题、列表、加粗
  const lines = text.split('\n');
  return (
    <article className="prose-sm max-w-none text-[13px] leading-relaxed text-ink-800 space-y-1.5">
      {lines.map((line, i) => {
        if (line.startsWith('# ')) return <h1 key={i} className="font-display text-[20px] font-semibold mt-2">{line.slice(2)}</h1>;
        if (line.startsWith('## ')) return <h2 key={i} className="font-display text-[15px] font-semibold mt-4 text-ink-900">{line.slice(3)}</h2>;
        if (line.startsWith('### ')) return <h3 key={i} className="font-display text-[13.5px] font-semibold mt-3 text-ink-900">{line.slice(4)}</h3>;
        if (line.startsWith('- ') || line.startsWith('* ')) return <li key={i} className="ml-4 list-disc text-ink-700">{renderInline(line.slice(2))}</li>;
        if (/^\d+\.\s/.test(line)) return <li key={i} className="ml-4 list-decimal text-ink-700">{renderInline(line.replace(/^\d+\.\s/, ''))}</li>;
        if (line.trim() === '') return <div key={i} className="h-1" />;
        return <p key={i} className="text-ink-700">{renderInline(line)}</p>;
      })}
    </article>
  );
}

function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((p, i) => {
    if (p.startsWith('**') && p.endsWith('**')) return <strong key={i} className="text-ink-900 font-semibold">{p.slice(2, -2)}</strong>;
    if (p.startsWith('`') && p.endsWith('`')) return <code key={i} className="px-1 py-0.5 rounded bg-ink-100 text-cobalt-700 font-mono text-[12px]">{p.slice(1, -1)}</code>;
    return <span key={i}>{p}</span>;
  });
}

function renderDraft(
  project: Project,
  kind: DraftKind,
  tasks: ReturnType<typeof useStore.getState>['tasks'],
  users: ReturnType<typeof useStore.getState>['users'],
): string {
  const projectTasks = tasks.filter((t) => t.projectId === project.id);
  const done = projectTasks.filter((t) => t.status === 'DONE');
  const inProgress = projectTasks.filter((t) => t.status === 'IN_PROGRESS');
  const inReview = projectTasks.filter((t) => t.status === 'IN_REVIEW');
  const overdue = projectTasks.filter((t) => t.status !== 'DONE' && new Date(t.dueAt) < new Date());

  if (kind === 'WEEKLY') {
    return `# ${project.name} · 周报草稿

## 本周进展
- 已完成任务 ${done.length} 个：${done.map((t) => t.title).join('、') || '暂无'}
- 进行中 ${inProgress.length} 个，待复核 ${inReview.length} 个
- 整体完成度 ${Math.round((done.length / Math.max(projectTasks.length, 1)) * 100)}%

## 风险与待办
${overdue.length > 0 ? `- **逾期任务 ${overdue.length} 个**：${overdue.map((t) => t.title).join('、')}` : '- 当前无逾期任务'}
- 关键节点：${projectTasks.filter((t) => t.priority === 'P0' && t.status !== 'DONE').map((t) => t.title).join('、') || '无'}

## 下周计划
- 推进 ${inProgress[0]?.title ?? '关键任务'} 至下一阶段
- 与 ${users.find((u) => u.id === project.ownerId)?.name ?? 'PM'} 同步资源

> ⚠ 本草稿由 AI 生成，需要 ${users.find((u) => u.id === project.ownerId)?.name ?? 'PM'} 确认后再发送。`;
  }

  if (kind === 'MEETING') {
    return `# ${project.name} · 例会纪要草稿

## 会议时间
${formatDate(new Date().toISOString())}

## 讨论要点
- ${project.product} 当前项目整体进度 ${Math.round((done.length / Math.max(projectTasks.length, 1)) * 100)}%
- 待复核任务：${inReview.map((t) => t.title).join('、') || '无'}
- 风险点：${overdue.length > 0 ? `${overdue.length} 个任务逾期` : '无明显风险'}

## 决议
- 跟进逾期任务，责任人于本周内提交进展
- 下次会议前补齐 P0 任务证据

## 行动项
- [ ] ${inProgress[0]?.title ?? '关键任务'} - 责任人 ${users.find((u) => u.id === inProgress[0]?.assigneeId)?.name ?? '待定'}
- [ ] 复核 ${inReview[0]?.title ?? '待复核任务'} - 复核人 ${users.find((u) => u.id === inReview[0]?.reviewerId)?.name ?? '待定'}`;
  }

  if (kind === 'CAPA') {
    return `# ${project.name} · CAPA 初稿

## 偏差描述
- 项目运行中识别的关键偏差与影响范围（待人工补充具体描述）

## 根因分析（建议）
- 流程层面：模板与 SOP 是否对齐
- 人员层面：培训与变更管理是否到位
- 系统层面：证据归档与版本管理是否存在漏洞

## 行动项
- **短期（≤7 天）**：补齐缺失证据，更新 SOP 引用
- **中期（≤30 天）**：完成培训记录，发布 v2 流程
- **长期（≤90 天）**：评估效果，更新模板

## 责任分工
- 项目经理：${users.find((u) => u.id === project.ownerId)?.name ?? '—'}
- QA：质量复核与效果评估

> ⚠ 本初稿为 AI 草稿，需要由 PM + QA 联合评审后落地。`;
  }

  // RISK
  return `# ${project.name} · 风险摘要

## 风险概览
- **总任务数**：${projectTasks.length}
- **逾期任务**：${overdue.length}
- **高风险任务**：${projectTasks.filter((t) => t.riskLevel === 'HIGH' && t.status !== 'DONE').length}

## 关键风险
${
  projectTasks
    .filter((t) => t.riskLevel === 'HIGH' && t.status !== 'DONE')
    .map((t) => `- **${t.title}**：截止 ${formatDate(t.dueAt)}，负责人 ${users.find((u) => u.id === t.assigneeId)?.name ?? '待分配'}`)
    .join('\n') || '- 暂无高风险任务'
}

## 缓解建议
- 优先处理逾期任务，避免监管窗口延误
- 加强供应商交付物审核
- 提前 7 / 3 / 1 天分级提醒`;
}
