import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Clock4,
  Download,
  FileText,
  ListChecks,
  MessageSquareText,
  Paperclip,
  Pencil,
  Send,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  XCircle,
} from 'lucide-react';
import { useStore, roleCan } from '@/store/useStore';
import { PageHeader } from '@/components/TopBar';
import { Avatar } from '@/components/Avatar';
import {
  Chip,
  PriorityTag,
  RiskTag,
  SeverityTag,
  StatusBadge,
  StatusFlowBar,
} from '@/components/Badge';
import {
  canTransition,
  cn,
  daysFromNow,
  dueUrgency,
  fileSizeFmt,
  formatDate,
  isOverdue,
  relativeFromNow,
} from '@/lib/utils';
import type { TaskStatus, Comment } from '@/types';

const STATUS_TABS = [
  { key: 'overview', label: '概览', icon: ListChecks },
  { key: 'process', label: '处理区', icon: Pencil },
  { key: 'evidence', label: '证据与附件', icon: Paperclip },
  { key: 'comments', label: '协作', icon: MessageSquareText },
  { key: 'review', label: '复核与日志', icon: ShieldCheck },
] as const;
type Tab = (typeof STATUS_TABS)[number]['key'];

export function TaskDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const me = useStore((s) => s.currentUser)!;
  const task = useStore((s) => s.tasks.find((t) => t.id === id));
  const users = useStore((s) => s.users);
  const projects = useStore((s) => s.projects);
  const allComments = useStore((s) => s.comments);
  const allAttachments = useStore((s) => s.attachments);
  const allReviews = useStore((s) => s.reviews);
  const auditLogs = useStore((s) => s.auditLogs);
  const updateStatus = useStore((s) => s.updateTaskStatus);
  const updateField = useStore((s) => s.updateTaskField);
  const addComment = useStore((s) => s.addComment);
  const uploadAttachment = useStore((s) => s.uploadAttachment);
  const reviewTask = useStore((s) => s.reviewTask);
  const pushToast = useStore((s) => s.pushToast);

  const [tab, setTab] = useState<Tab>('overview');
  const [commentText, setCommentText] = useState('');
  const [reviewReason, setReviewReason] = useState('');
  const [reviewDecision, setReviewDecision] = useState<'APPROVED' | 'RETURNED' | null>(null);
  const [medicalOpinion, setMedicalOpinion] = useState(task?.medicalOpinion ?? '');
  type FollowUp = 'NONE' | 'PENDING' | 'COMPLETED';
  const [followUpStatus, setFollowUpStatus] = useState<FollowUp>((task?.followUpStatus as FollowUp) ?? 'NONE');

  if (!task) {
    return (
      <div className="surface p-10 text-center">
        <div className="text-[14px] font-semibold text-ink-800">任务不存在</div>
        <button className="btn btn-ghost mt-4" onClick={() => navigate('/projects')}>
          返回项目
        </button>
      </div>
    );
  }

  const project = projects.find((p) => p.id === task.projectId);
  const assignee = users.find((u) => u.id === task.assigneeId);
  const reviewer = users.find((u) => u.id === task.reviewerId);
  const owner = users.find((u) => u.id === project?.ownerId);
  const taskComments = allComments.filter((c) => c.taskId === task.id);
  const taskAttachments = allAttachments.filter((a) => a.taskId === task.id);
  const taskReviews = allReviews.filter((r) => r.taskId === task.id);
  const taskAudit = auditLogs.filter((l) => l.objectId === task.id);
  const allowedTransitions = canTransition(task.status, '') ? [] : []; // placeholder

  const isAssignee = me.id === task.assigneeId;
  const isReviewer = me.id === task.reviewerId;
  const canEditMedical = me.role === 'PHYSICIAN' || me.role === 'PM' || me.role === 'ADMIN';

  const onStatusChange = (next: TaskStatus) => {
    if (task.status === next) return;
    if (next === 'DONE' && !roleCan(me.role, 'review') && !isReviewer) {
      pushToast('error', '提交至"已完成"需要由复核人确认，不能直接修改');
      return;
    }
    updateStatus(task.id, next);
    pushToast('success', `状态已更新为「${next}」`);
  };

  const onSubmitComment = () => {
    if (!commentText.trim()) return;
    const mentions = Array.from(commentText.matchAll(/@([一-龥a-zA-Z0-9]+)/g)).map((m) => {
      const u = users.find((u) => u.name === m[1]);
      return u?.id ?? '';
    }).filter(Boolean);
    addComment(task.id, commentText.trim(), mentions);
    setCommentText('');
  };

  const onUpload = (evidenceKey?: string) => {
    const sample = ['原始报告表.pdf', '随访记录.docx', '评估报告.pdf', 'CAPA计划.xlsx'];
    const name = sample[Math.floor(Math.random() * sample.length)];
    const size = 100_000 + Math.floor(Math.random() * 800_000);
    uploadAttachment(task.id, name, size, 'application/pdf', evidenceKey);
  };

  const onSaveMedical = () => {
    updateField(task.id, 'medicalOpinion', medicalOpinion);
    pushToast('success', '医学意见已保存');
  };

  const onSaveFollowUp = () => {
    updateField(task.id, 'followUpStatus', followUpStatus);
    pushToast('success', '随访状态已更新');
  };

  const onReview = () => {
    if (!reviewDecision) return;
    if (reviewDecision === 'RETURNED' && !reviewReason.trim()) {
      pushToast('error', '退回时必须填写原因');
      return;
    }
    reviewTask(task.id, reviewDecision, reviewReason.trim() || undefined);
    setReviewDecision(null);
    setReviewReason('');
  };

  const evidenceHave = task.evidenceUploaded.length;
  const evidenceNeed = task.requiredEvidence.length;
  const evidencePct = evidenceNeed === 0 ? 1 : evidenceHave / evidenceNeed;

  return (
    <>
      <button
        onClick={() => (project ? navigate(`/projects/${project.id}`) : navigate('/projects'))}
        className="flex items-center gap-1.5 text-[12px] text-ink-500 hover:text-ink-900 mb-4 transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> {project?.name ?? '返回'}
      </button>

      <div className="surface p-6 mb-5">
        <div className="flex items-start gap-4 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <PriorityTag p={task.priority} />
              <StatusBadge status={task.status} />
              {task.riskLevel === 'HIGH' && <RiskTag level="HIGH" />}
              {task.severity && <SeverityTag severity={task.severity} />}
              {task.caseId && (
                <span className="chip chip-mono bg-ink-900/[0.04] text-ink-700 border-ink-900/5">
                  {task.caseId}
                </span>
              )}
            </div>
            <h1 className="font-display text-[24px] font-semibold text-ink-900 leading-tight text-balance">
              {task.title}
            </h1>
            <p className="text-[13px] text-ink-500 mt-2 max-w-2xl leading-relaxed">{task.description}</p>

            <div className="mt-4 flex items-center gap-2 flex-wrap">
              <MetaItem icon={Clock4} label="截止">
                <span
                  className={cn('font-mono font-semibold', {
                    'text-danger-600': isOverdue(task.dueAt) && task.status !== 'DONE',
                    'text-amber-700': dueUrgency(task.dueAt) === 'today' || dueUrgency(task.dueAt) === 'soon',
                    'text-ink-800': dueUrgency(task.dueAt) === 'ok',
                  })}
                >
                  {formatDate(task.dueAt, true)} · {relativeFromNow(task.dueAt)}
                </span>
              </MetaItem>
              <Divider />
              <MetaItem icon={ListChecks} label="项目">
                <button
                  onClick={() => navigate(`/projects/${project?.id}`)}
                  className="text-cobalt-600 hover:underline text-[12.5px] font-medium"
                >
                  {project?.name}
                </button>
              </MetaItem>
              <Divider />
              <MetaItem icon={FileText} label="产品">{task.product ?? '—'}</MetaItem>
              <Divider />
              <MetaItem icon={FileText} label="区域">{task.region ?? '—'}</MetaItem>
            </div>
          </div>

          <div className="flex flex-col items-end gap-2.5 shrink-0 min-w-[260px]">
            <div className="text-right">
              <div className="text-[10.5px] uppercase tracking-widest text-ink-500">负责人</div>
              <div className="mt-1 flex items-center gap-2 justify-end">
                <Avatar userId={task.assigneeId} size={28} />
                <div>
                  <div className="text-[13px] font-semibold text-ink-900">{assignee?.name ?? '待分配'}</div>
                  <div className="text-[10.5px] text-ink-500">{assignee ? assignee.email : '—'}</div>
                </div>
              </div>
            </div>
            {reviewer && (
              <div className="text-right">
                <div className="text-[10.5px] uppercase tracking-widest text-ink-500">复核人</div>
                <div className="mt-1 flex items-center gap-2 justify-end">
                  <Avatar userId={reviewer.id} size={24} />
                  <div className="text-[12.5px] text-ink-800">{reviewer.name}</div>
                </div>
              </div>
            )}

            <div className="flex items-center gap-1.5 mt-1.5">
              {task.status !== 'DONE' && isAssignee && task.status !== 'IN_REVIEW' && (
                <button
                  className="btn btn-soft text-[12px]"
                  onClick={() => onStatusChange('IN_REVIEW')}
                >
                  <Send className="w-3.5 h-3.5" /> 提交复核
                </button>
              )}
              {task.status === 'IN_REVIEW' && isReviewer && (
                <>
                  <button
                    className="btn btn-primary text-[12px]"
                    onClick={() => onReview()}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" /> 通过
                  </button>
                  <button
                    className="btn btn-danger text-[12px]"
                    onClick={() => onReview()}
                  >
                    <XCircle className="w-3.5 h-3.5" /> 退回
                  </button>
                </>
              )}
              {task.status === 'NOT_STARTED' && isAssignee && (
                <button
                  className="btn btn-cobalt text-[12px]"
                  onClick={() => onStatusChange('IN_PROGRESS')}
                >
                  开始处理
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="mt-5 pt-4 border-t border-ink-900/5 flex items-center gap-4">
          <div className="text-[11px] text-ink-500 uppercase tracking-widest">状态进度</div>
          <StatusFlowBar status={task.status} />
          <div className="ml-auto text-[11px] text-ink-500 font-mono">
            更新于 {formatDate(task.updatedAt, true)}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-4 border-b border-ink-900/5 overflow-x-auto">
        {STATUS_TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                'flex items-center gap-1.5 px-3.5 py-2 text-[12.5px] font-medium border-b-2 -mb-px transition-colors whitespace-nowrap',
                tab === t.key
                  ? 'border-teal-600 text-ink-900'
                  : 'border-transparent text-ink-500 hover:text-ink-800',
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {t.label}
              {t.key === 'comments' && taskComments.length > 0 && (
                <span className="ml-1 chip-mono text-[10.5px] text-ink-500 font-mono">{taskComments.length}</span>
              )}
              {t.key === 'evidence' && (
                <span
                  className={cn(
                    'ml-1 chip-mono text-[10.5px] font-mono',
                    evidencePct === 1 ? 'text-teal-700' : 'text-amber-700',
                  )}
                >
                  {evidenceHave}/{evidenceNeed}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {tab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-5">
          <section className="surface p-5 space-y-5">
            <div>
              <h3 className="font-display text-[14.5px] font-semibold mb-2.5 flex items-center gap-2">
                <FileText className="w-3.5 h-3.5 text-cobalt-600" /> 关键字段
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-[12.5px]">
                <KeyField label="Day 0" value={task.dayZero ? formatDate(task.dayZero) : '—'} />
                <KeyField label="严重性" value={task.severity ?? '—'} />
                <KeyField label="是否严重" value={task.seriousness === 'SERIOUS' ? '严重' : task.seriousness === 'NON_SERIOUS' ? '非严重' : '—'} />
                <KeyField label="随访状态" value={
                  <select
                    className="field-select py-1 text-[12px]"
                    value={followUpStatus}
                    onChange={(e) => setFollowUpStatus(e.target.value as FollowUp)}
                    disabled={!canEditMedical && me.role !== 'PROCESSOR'}
                  >
                    <option value="NONE">无需</option>
                    <option value="PENDING">待随访</option>
                    <option value="COMPLETED">已完成</option>
                  </select>
                } />
                <KeyField label="模板节点" value={task.type} />
                <KeyField label="风险等级" value={<RiskTag level={task.riskLevel} />} />
              </div>
              {(canEditMedical || me.role === 'PROCESSOR') && (
                <div className="mt-3">
                  <button onClick={onSaveFollowUp} className="btn btn-ghost text-[12px]">
                    保存随访状态
                  </button>
                </div>
              )}
            </div>

            <div>
              <h3 className="font-display text-[14.5px] font-semibold mb-2.5 flex items-center gap-2">
                <Pencil className="w-3.5 h-3.5 text-cobalt-600" /> 医学意见
              </h3>
              <textarea
                className="field-textarea"
                value={medicalOpinion}
                onChange={(e) => setMedicalOpinion(e.target.value)}
                placeholder="由 Safety Physician 填写：因果关系评估、严重性、预期性、监管建议等。"
                disabled={!canEditMedical}
              />
              {canEditMedical && (
                <div className="mt-2 flex items-center gap-2">
                  <button onClick={onSaveMedical} className="btn btn-soft text-[12px]">
                    <CheckCircle2 className="w-3.5 h-3.5" /> 保存医学意见
                  </button>
                  <span className="text-[11px] text-ink-500">保存后写入审计日志</span>
                </div>
              )}
            </div>

            <div>
              <h3 className="font-display text-[14.5px] font-semibold mb-2.5 flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-cobalt-600" /> AI 助手建议
                <Chip tone="amber" className="text-[10px]">仅草稿</Chip>
              </h3>
              <div className="rounded-xl border border-dashed border-cobalt-200 bg-cobalt-50/30 p-3.5 text-[12.5px] text-ink-700 leading-relaxed">
                <p>建议：补充肝功能基线（ALT/AST/ALP/TBIL）以增强因果关系评估的可信度。可参考 RUCAM 量表的"过去用药史"和"伴随用药"两项。</p>
                <p className="mt-2 text-[11px] text-ink-500">⚠ AI 输出不替代医学判断，需要 Safety Physician 确认。</p>
                <button onClick={() => navigate('/ai')} className="mt-2 btn btn-soft text-[12px]">
                  生成完整分析
                </button>
              </div>
            </div>
          </section>

          <div className="space-y-5">
            <section className="surface p-5">
              <h3 className="font-display text-[14.5px] font-semibold mb-3">证据完整度</h3>
              <div className="space-y-2.5">
                {task.requiredEvidence.map((req) => {
                  const att = taskAttachments.find((a) => a.evidenceKey === req);
                  return (
                    <div key={req} className="flex items-center gap-2.5 text-[12.5px]">
                      {att ? (
                        <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-ink-800 font-medium">{req}</div>
                        {att && (
                          <div className="text-[10.5px] text-ink-500 font-mono">
                            {att.fileName} · v{att.version} · {fileSizeFmt(att.size)}
                          </div>
                        )}
                      </div>
                      {!att && (
                        <button onClick={() => onUpload(req)} className="text-[11px] text-cobalt-600 hover:underline">
                          上传
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="mt-3 h-1.5 bg-ink-100 rounded-full overflow-hidden">
                <div
                  className={cn('h-full rounded-full', evidencePct === 1 ? 'bg-teal-500' : evidencePct > 0.5 ? 'bg-amber-500' : 'bg-danger-500')}
                  style={{ width: `${Math.max(evidencePct * 100, 4)}%` }}
                />
              </div>
              <div className="mt-1.5 text-[11px] text-ink-500 text-right font-mono">
                {evidenceHave} / {evidenceNeed} 必填证据
              </div>
            </section>

            <section className="surface p-5">
              <h3 className="font-display text-[14.5px] font-semibold mb-3">项目元信息</h3>
              <div className="space-y-2 text-[12.5px]">
                <RowKV k="项目编号" v={<span className="font-mono">{project?.code}</span>} />
                <RowKV k="项目类型" v={project?.type} />
                <RowKV k="项目负责人" v={
                  <div className="flex items-center gap-1.5">
                    <Avatar userId={owner?.id} size={20} />
                    <span>{owner?.name}</span>
                  </div>
                } />
                <RowKV k="任务创建" v={formatDate(task.createdAt, true)} />
                <RowKV k="最近更新" v={formatDate(task.updatedAt, true)} />
              </div>
            </section>
          </div>
        </div>
      )}

      {tab === 'process' && (
        <section className="surface p-6 max-w-3xl">
          <h3 className="font-display text-[15px] font-semibold mb-3">处理记录</h3>
          <p className="text-[12.5px] text-ink-500 leading-relaxed mb-4">
            在此区域填写处理进展、内部结论或行动项。所有保存操作都会写入审计日志，并通知项目相关方。
          </p>
          <textarea
            className="field-textarea min-h-[200px]"
            value={medicalOpinion}
            onChange={(e) => setMedicalOpinion(e.target.value)}
            placeholder="例如：已与首诊医生取得联系，确认患者在用药前 6 个月内未使用其他肝毒性药物。下一步将补充 ALT 趋势图。"
          />
          <div className="mt-3 flex items-center gap-2">
            <button onClick={onSaveMedical} className="btn btn-primary text-[12px]">
              <CheckCircle2 className="w-3.5 h-3.5" /> 保存处理记录
            </button>
            <button onClick={() => onStatusChange('IN_REVIEW')} className="btn btn-soft text-[12px]" disabled={task.status === 'IN_REVIEW' || task.status === 'DONE'}>
              提交至复核 <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </section>
      )}

      {tab === 'evidence' && (
        <section className="surface p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display text-[15px] font-semibold">附件与证据</h3>
            <button onClick={() => onUpload()} className="btn btn-primary text-[12px]">
              <Upload className="w-3.5 h-3.5" /> 上传附件
            </button>
          </div>
          <table className="w-full text-[12.5px]">
            <thead className="bg-ink-50 text-[11px] text-ink-500">
              <tr>
                <th className="text-left px-3 py-2 font-medium">文件</th>
                <th className="text-left px-3 py-2 font-medium">关联证据</th>
                <th className="text-left px-3 py-2 font-medium">上传人</th>
                <th className="text-left px-3 py-2 font-medium">大小</th>
                <th className="text-left px-3 py-2 font-medium">版本</th>
                <th className="text-left px-3 py-2 font-medium">上传时间</th>
                <th className="text-left px-3 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {taskAttachments.map((a) => {
                const u = users.find((x) => x.id === a.uploaderId);
                return (
                  <tr key={a.id} className="border-t border-ink-900/5">
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <FileText className="w-3.5 h-3.5 text-cobalt-600" />
                        <span className="font-medium text-ink-800">{a.fileName}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      {a.evidenceKey ? (
                        <span className="chip chip-mono bg-teal-50 text-teal-700 border-teal-200">
                          {a.evidenceKey}
                        </span>
                      ) : (
                        <span className="text-ink-400">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <Avatar userId={a.uploaderId} size={18} />
                        <span className="text-ink-700">{u?.name}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 font-mono">{fileSizeFmt(a.size)}</td>
                    <td className="px-3 py-2.5 font-mono">v{a.version}</td>
                    <td className="px-3 py-2.5 font-mono text-ink-500">{formatDate(a.createdAt)}</td>
                    <td className="px-3 py-2.5 text-right">
                      <button className="text-ink-500 hover:text-cobalt-600 mr-2">
                        <Download className="w-3.5 h-3.5" />
                      </button>
                      <button className="text-ink-500 hover:text-danger-600">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {taskAttachments.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-[12.5px] text-ink-500">
                    暂无附件，点击右上角上传
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      )}

      {tab === 'comments' && (
        <section className="surface p-5 max-w-3xl">
          <h3 className="font-display text-[15px] font-semibold mb-4">协作与评论</h3>
          <div className="space-y-3.5">
            {taskComments.map((c) => (
              <CommentItem key={c.id} c={c} users={users} />
            ))}
            {taskComments.length === 0 && (
              <div className="text-center py-6 text-[12.5px] text-ink-500">还没有评论，开始协作吧</div>
            )}
          </div>
          <div className="mt-5 pt-4 border-t border-ink-900/5">
            <textarea
              className="field-textarea"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="发表评论，使用 @ 提及同事…"
            />
            <div className="mt-2 flex items-center justify-between">
              <div className="text-[11px] text-ink-500">
                支持 @ 提及，例如 @林婉清 @Dr. Chen
              </div>
              <button
                onClick={onSubmitComment}
                className="btn btn-primary text-[12px]"
                disabled={!commentText.trim()}
              >
                <Send className="w-3.5 h-3.5" /> 发布
              </button>
            </div>
          </div>
        </section>
      )}

      {tab === 'review' && (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.2fr] gap-5">
          <section className="surface p-5">
            <h3 className="font-display text-[15px] font-semibold mb-3">质量复核</h3>
            {!isReviewer && task.status !== 'IN_REVIEW' && (
              <div className="text-[12.5px] text-ink-500 leading-relaxed">
                复核将在任务进入"待复核"状态后开启。当前状态：<StatusBadge status={task.status} />
              </div>
            )}
            {(isReviewer || task.status === 'IN_REVIEW') && (
              <div className="space-y-3.5">
                <div className="rounded-lg border border-ink-900/5 p-3 bg-ink-50">
                  <div className="text-[11px] text-ink-500 mb-1.5">复核要点</div>
                  <ul className="text-[12px] text-ink-700 space-y-1 list-disc pl-4">
                    <li>必填证据是否齐备（{evidenceHave}/{evidenceNeed}）</li>
                    <li>医学意见是否完整、是否符合 SOP</li>
                    <li>Day 0、随访状态、严重性是否准确</li>
                    <li>是否有未关闭的偏差或 CAPA</li>
                  </ul>
                </div>
                {task.status === 'IN_REVIEW' && isReviewer && (
                  <>
                    <div className="field">
                      <label className="field-label">复核决定</label>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => setReviewDecision('APPROVED')}
                          className={cn(
                            'btn flex-1',
                            reviewDecision === 'APPROVED' ? 'btn-primary' : 'btn-ghost',
                          )}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" /> 通过
                        </button>
                        <button
                          onClick={() => setReviewDecision('RETURNED')}
                          className={cn(
                            'btn flex-1',
                            reviewDecision === 'RETURNED' ? 'btn-danger' : 'btn-ghost',
                          )}
                        >
                          <XCircle className="w-3.5 h-3.5" /> 退回
                        </button>
                      </div>
                    </div>
                    {reviewDecision === 'RETURNED' && (
                      <div className="field">
                        <label className="field-label">退回原因（必填）</label>
                        <textarea
                          className="field-textarea"
                          value={reviewReason}
                          onChange={(e) => setReviewReason(e.target.value)}
                          placeholder="例如：缺少肝功能趋势图，请补充后重新提交。"
                        />
                      </div>
                    )}
                    <button
                      onClick={onReview}
                      className="btn btn-primary w-full"
                      disabled={!reviewDecision || (reviewDecision === 'RETURNED' && !reviewReason.trim())}
                    >
                      提交复核决定
                    </button>
                  </>
                )}
              </div>
            )}

            <div className="mt-5 pt-4 border-t border-ink-900/5">
              <div className="text-[11px] uppercase tracking-widest text-ink-500 mb-2">历史复核</div>
              {taskReviews.length === 0 ? (
                <div className="text-[12px] text-ink-500">暂无</div>
              ) : (
                <ul className="space-y-2">
                  {taskReviews.map((r) => {
                    const u = users.find((x) => x.id === r.reviewerId);
                    return (
                      <li key={r.id} className="rounded-lg border border-ink-900/5 p-2.5 text-[12px]">
                        <div className="flex items-center gap-2">
                          <Avatar userId={r.reviewerId} size={20} />
                          <span className="font-semibold text-ink-800">{u?.name}</span>
                          <span
                            className={cn(
                              'chip text-[10.5px]',
                              r.decision === 'APPROVED'
                                ? 'bg-teal-50 text-teal-700 border-teal-200'
                                : 'bg-danger-500/10 text-danger-700 border-danger-500/30',
                            )}
                          >
                            {r.decision === 'APPROVED' ? '通过' : '退回'}
                          </span>
                          <span className="ml-auto text-[10.5px] text-ink-500 font-mono">
                            {formatDate(r.createdAt, true)}
                          </span>
                        </div>
                        {r.reason && <div className="text-ink-600 mt-1.5 pl-7">{r.reason}</div>}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </section>

          <section className="surface p-5">
            <h3 className="font-display text-[15px] font-semibold mb-3">审计日志</h3>
            <ol className="space-y-2.5">
              {taskAudit.slice(0, 30).map((l) => {
                const actor = users.find((u) => u.id === l.actorId);
                return (
                  <li key={l.id} className="flex gap-2.5">
                    <Avatar userId={l.actorId} size={22} />
                    <div className="flex-1 min-w-0">
                      <div className="text-[12.5px] text-ink-800">
                        <span className="font-semibold">{actor?.name ?? '系统'}</span> {l.action}
                      </div>
                      <div className="text-[10.5px] text-ink-500 font-mono mt-0.5">
                        {formatDate(l.createdAt, true)} · {relativeFromNow(l.createdAt)}
                      </div>
                    </div>
                  </li>
                );
              })}
              {taskAudit.length === 0 && (
                <li className="text-center py-6 text-[12.5px] text-ink-500">暂无操作记录</li>
              )}
            </ol>
          </section>
        </div>
      )}
    </>
  );
}

function MetaItem({ icon: Icon, label, children }: { icon: React.ComponentType<{ className?: string }>; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5 text-[12px]">
      <Icon className="w-3.5 h-3.5 text-ink-400" />
      <span className="text-ink-500">{label}:</span>
      <span className="text-ink-800">{children}</span>
    </div>
  );
}

function Divider() {
  return <span className="w-px h-3 bg-ink-900/10" />;
}

function KeyField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-ink-900/[0.02] border border-ink-900/5 px-3 py-2">
      <div className="text-[10.5px] uppercase tracking-widest text-ink-500">{label}</div>
      <div className="text-[12.5px] text-ink-800 mt-0.5 font-medium">{value}</div>
    </div>
  );
}

function RowKV({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="text-ink-500 text-[11.5px] uppercase tracking-wider">{k}</div>
      <div className="text-ink-800">{v}</div>
    </div>
  );
}

function CommentItem({ c, users }: { c: Comment; users: ReturnType<typeof useStore.getState>['users'] }) {
  const author = users.find((u) => u.id === c.authorId);
  return (
    <div className="flex gap-3">
      <Avatar userId={c.authorId} size={32} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-display text-[13px] font-semibold text-ink-900">{author?.name}</span>
          <span className="text-[10.5px] text-ink-500 font-mono">{formatDate(c.createdAt, true)}</span>
          <span className="text-[10.5px] text-ink-500">· {relativeFromNow(c.createdAt)}</span>
        </div>
        <div className="mt-1 text-[12.5px] text-ink-700 leading-relaxed whitespace-pre-wrap">
          {c.content.split(/(@[一-龥a-zA-Z0-9]+)/g).map((part, i) =>
            part.startsWith('@') ? (
              <span key={i} className="text-cobalt-600 font-medium">
                {part}
              </span>
            ) : (
              <span key={i}>{part}</span>
            ),
          )}
        </div>
      </div>
    </div>
  );
}
