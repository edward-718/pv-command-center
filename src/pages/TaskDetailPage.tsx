import { useMemo, useState, useEffect } from 'react';
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
  Calendar,
  FileCheck,
  Plus,
  Edit2,
  Link as LinkIcon,
  Lock,
} from 'lucide-react';
import { useStore, roleCan, selectVisibleTasks } from '@/store/useStore';
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
  getDaysUntilDeadline,
  getMissingEvidence,
} from '@/lib/utils';
import type { Task, TaskStatus, Comment, FollowUpRecord, Causality, Submission, SubmissionStatus } from '@/types';
import { CAUSALITY_LABEL, SUBMISSION_STATUS_LABEL, SUBMISSION_STATUS_TONE } from '@/types';

const STATUS_TABS = [
  { key: 'comments', label: '评论与结论', icon: MessageSquareText },
  { key: 'followup', label: '随访', icon: Calendar },
  { key: 'medical', label: '医学评估', icon: FileText },
  { key: 'regulatory', label: '监管提交', icon: FileCheck },
  { key: 'evidence', label: '证据与日志', icon: Paperclip },
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
  const allTasks = useStore((s) => s.tasks);
  // Bug2修复: taskVisible依赖添加projects
  const taskVisible = useMemo(() => {
    if (!task || !me) return false;
    const visibleTasks = selectVisibleTasks({ ...useStore.getState(), projects, currentUser: me }, me);
    return visibleTasks.some((t) => t.id === task.id);
  }, [task, me, allTasks, projects]);
  const auditLogs = useStore((s) => s.auditLogs);
  const updateStatus = useStore((s) => s.updateTaskStatus);
  const updateField = useStore((s) => s.updateTaskField);
  const addComment = useStore((s) => s.addComment);
  const uploadAttachment = useStore((s) => s.uploadAttachment);
  const deleteAttachment = useStore((s) => s.deleteAttachment);
  const reviewTask = useStore((s) => s.reviewTask);
  const saveMedicalAssessment = useStore((s) => s.saveMedicalAssessment);
  const createFollowUpTask = useStore((s) => s.createFollowUpTask);
  const saveSubmission = useStore((s) => s.saveSubmission);
  const deleteSubmission = useStore((s) => s.deleteSubmission);
  const pushToast = useStore((s) => s.pushToast);

  const [tab, setTab] = useState<Tab>('comments');
  const [commentText, setCommentText] = useState('');
  const [reviewReason, setReviewReason] = useState('');
  const [reviewDecision, setReviewDecision] = useState<'APPROVED' | 'RETURNED' | null>(null);
  
  const [seriousness, setSeriousness] = useState<Task['seriousness']>(task?.seriousness);
  const [causality, setCausality] = useState<Causality | undefined>(task?.causality);
  const [meddraPt, setMeddraPt] = useState(task?.meddraPt ?? '');
  const [meddraLlt, setMeddraLlt] = useState(task?.meddraLlt ?? '');
  const [medicalOpinion, setMedicalOpinion] = useState(task?.medicalOpinion ?? '');
  const [signalFlag, setSignalFlag] = useState(task?.signalFlag ?? false);
  const [severity, setSeverity] = useState<Task['severity']>(task?.severity);
  
  type FollowUpStatus = 'NONE' | 'PENDING' | 'COMPLETED';
  const [followUpStatus, setFollowUpStatus] = useState<FollowUpStatus>((task?.followUpStatus as FollowUpStatus) ?? 'NONE');
  const [followUpRecords, setFollowUpRecords] = useState<FollowUpRecord[]>(task?.followUpRecords ?? []);
  const [newFollowUpDate, setNewFollowUpDate] = useState('');
  const [newFollowUpNote, setNewFollowUpNote] = useState('');
  
  const [showSubmissionDialog, setShowSubmissionDialog] = useState(false);
  const [editingSubmission, setEditingSubmission] = useState<Submission | null>(null);
  const [submissionForm, setSubmissionForm] = useState({
    agency: 'NMPA',
    channel: 'E2B',
    submitDate: new Date().toISOString().split('T')[0],
    receiptNo: '',
    receiptDate: '',
    status: 'PENDING' as SubmissionStatus,
    notes: '',
  });

  useEffect(() => {
    if (task) {
      setSeriousness(task.seriousness);
      setCausality(task.causality);
      setMeddraPt(task.meddraPt ?? '');
      setMeddraLlt(task.meddraLlt ?? '');
      setMedicalOpinion(task.medicalOpinion ?? '');
      setSignalFlag(task.signalFlag);
      setFollowUpStatus((task.followUpStatus as FollowUpStatus) ?? 'NONE');
      setFollowUpRecords(task.followUpRecords ?? []);
      setSeverity(task.severity);
    }
  }, [task]);

  const followUpTasks = useMemo(() => {
    if (!task) return [];
    return allTasks.filter((t) => t.projectId === task.projectId && t.followUpRound > 0 && t.id !== task.id);
  }, [allTasks, task]);

  const predecessorTasks = useMemo(() => {
    if (!task) return [];
    return allTasks.filter((t) => task.dependsOn.includes(t.id));
  }, [allTasks, task]);

  const successorTasks = useMemo(() => {
    if (!task) return [];
    return allTasks.filter((t) => t.dependsOn.includes(task.id));
  }, [allTasks, task]);

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

  if (!taskVisible) {
    return (
      <div className="surface p-10 text-center">
        <div className="text-[14px] font-semibold text-ink-800">无权限访问该任务</div>
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

  const isAssignee = me.id === task.assigneeId;
  const isReviewer = me.id === task.reviewerId;
  const canEditMedical = (me.role === 'PHYSICIAN' || me.role === 'PM' || me.role === 'ADMIN') && !task.blocked;
  const canEditFollowUpStatus = (me.role === 'PROCESSOR' || me.role === 'PM' || me.role === 'ADMIN' || me.id === task.assigneeId) && !task.blocked;
  const canEditFollowUpRecords = (me.role === 'PROCESSOR' || me.role === 'PM' || me.role === 'ADMIN' || me.role === 'PHYSICIAN') && !task.blocked;
  const canComment = !task.blocked && (isAssignee || isReviewer || (project && (project.memberIds.includes(me.id) || project.ownerId === me.id)) || me.role === 'PM' || me.role === 'ADMIN' || me.role === 'QA');
  const daysUntilRegDeadline = task.regulatoryDeadline ? getDaysUntilDeadline(task.regulatoryDeadline) : undefined;

  const onStatusChange = (next: TaskStatus) => {
    if (task.status === next) return;
    if (next === 'DONE' && !isReviewer && me.role !== 'PM' && me.role !== 'ADMIN') {
      pushToast('error', '提交至"已完成"需要由复核人确认，不能直接修改');
      return;
    }
    updateStatus(task.id, next);
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

  const onAddFollowUp = () => {
    if (!newFollowUpDate) {
      pushToast('error', '请选择随访日期');
      return;
    }
    if (!newFollowUpNote.trim()) {
      pushToast('error', '请填写随访记录内容');
      return;
    }
    const newRecord: FollowUpRecord = {
      id: `fu-${Date.now()}`,
      date: newFollowUpDate,
      note: newFollowUpNote.trim(),
      completed: true,
    };
    const updatedRecords = [...followUpRecords, newRecord];
    setFollowUpRecords(updatedRecords);
    updateField(task.id, 'followUpRecords', updatedRecords);
    setNewFollowUpDate('');
    setNewFollowUpNote('');
    pushToast('success', '随访记录已添加');
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

  const onSaveMedicalAssessment = () => {
    saveMedicalAssessment(task.id, {
      seriousness,
      severity,
      causality,
      meddraPt: meddraPt || undefined,
      meddraLlt: meddraLlt || undefined,
      medicalOpinion,
      signalFlag,
    });
  };

  const onCreateFollowUp = () => {
    const newTask = createFollowUpTask(task.id);
    if (newTask) {
      navigate(`/tasks/${newTask.id}`);
    }
  };

  const openAddSubmission = () => {
    setEditingSubmission(null);
    setSubmissionForm({
      agency: 'NMPA',
      channel: 'E2B',
      submitDate: new Date().toISOString().split('T')[0],
      receiptNo: '',
      receiptDate: '',
      status: 'PENDING',
      notes: '',
    });
    setShowSubmissionDialog(true);
  };

  const openEditSubmission = (sub: Submission) => {
    setEditingSubmission(sub);
    setSubmissionForm({
      agency: sub.agency,
      channel: sub.channel,
      submitDate: sub.submitDate,
      receiptNo: sub.receiptNo ?? '',
      receiptDate: sub.receiptDate ?? '',
      status: sub.status,
      notes: sub.notes ?? '',
    });
    setShowSubmissionDialog(true);
  };

  const onSaveSubmission = () => {
    if (!project) return;
    if (!submissionForm.agency) {
      pushToast('error', '请选择监管机构');
      return;
    }
    if (!submissionForm.channel) {
      pushToast('error', '请选择提交渠道');
      return;
    }
    if (!submissionForm.submitDate) {
      pushToast('error', '请选择提交日期');
      return;
    }
    if (!submissionForm.status) {
      pushToast('error', '请选择状态');
      return;
    }
    const result = saveSubmission(project.id, {
      ...submissionForm,
      id: editingSubmission?.id,
      taskId: task.id,
    });
    if (result) {
      setShowSubmissionDialog(false);
      setEditingSubmission(null);
    }
  };

  const onDeleteSubmission = (subId: string) => {
    if (!project) return;
    if (confirm('确定要删除这条提交记录吗？')) {
      deleteSubmission(project.id, subId);
    }
  };

  const missingEvidence = getMissingEvidence(task.requiredEvidence, task.evidenceUploaded, allAttachments);
  const evidenceHave = task.requiredEvidence.length - missingEvidence.length;
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
              {task.blocked && (
                <span className="chip chip-mono bg-danger-50 text-danger-700 border-danger-200 flex items-center gap-1">
                  <Lock className="w-3 h-3" /> 阻塞
                </span>
              )}
              {task.riskLevel === 'HIGH' && <RiskTag level="HIGH" />}
              {task.severity && <SeverityTag severity={task.severity} />}
              {task.caseId && (
                <span className="chip chip-mono bg-ink-900/[0.04] text-ink-700 border-ink-900/5">
                  {task.caseId}
                </span>
              )}
              {task.signalFlag && (
                <span className="chip chip-mono bg-amber-50 text-amber-700 border-amber-200">
                  ⚠ 信号标记
                </span>
              )}
              {task.followUpRound > 0 && (
                <span className="chip chip-mono bg-cobalt-50 text-cobalt-700 border-cobalt-200">
                  随访-{task.followUpRound}
                </span>
              )}
            </div>
            <h1 className="font-display text-[24px] font-semibold text-ink-900 leading-tight text-balance">
              {task.title}
            </h1>
            <p className="text-[13px] text-ink-500 mt-2 max-w-2xl leading-relaxed">{task.description}</p>

            {(predecessorTasks.length > 0 || successorTasks.length > 0) && (
              <div className="mt-4 p-3 rounded-lg bg-ink-900/[0.02] border border-ink-900/5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {predecessorTasks.length > 0 && (
                    <div>
                      <div className="text-[10.5px] uppercase tracking-widest text-ink-500 mb-2 flex items-center gap-1">
                        <LinkIcon className="w-3 h-3" /> 前置任务
                      </div>
                      <div className="space-y-1.5">
                        {predecessorTasks.map((pt) => (
                          <div key={pt.id} className="flex items-center justify-between text-[12px]">
                            <button
                              onClick={() => navigate(`/tasks/${pt.id}`)}
                              className="text-cobalt-600 hover:underline truncate max-w-[200px]"
                            >
                              {pt.title}
                            </button>
                            <StatusBadge status={pt.status} />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {successorTasks.length > 0 && (
                    <div>
                      <div className="text-[10.5px] uppercase tracking-widest text-ink-500 mb-2 flex items-center gap-1">
                        <ChevronRight className="w-3 h-3" /> 后续任务
                      </div>
                      <div className="space-y-1.5">
                        {successorTasks.map((st) => (
                          <div key={st.id} className="flex items-center justify-between text-[12px]">
                            <button
                              onClick={() => navigate(`/tasks/${st.id}`)}
                              className="text-cobalt-600 hover:underline truncate max-w-[200px]"
                            >
                              {st.title}
                            </button>
                            <div className="flex items-center gap-1">
                              {st.blocked && (
                                <span className="chip chip-mono text-[10px] bg-danger-50 text-danger-700 border-danger-200">
                                  阻塞
                                </span>
                              )}
                              <StatusBadge status={st.status} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

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
              {task.regulatoryDeadline && (
                <>
                  <Divider />
                  <MetaItem icon={FileCheck} label="法规截止">
                    <span
                      className={cn('font-mono font-semibold', {
                        'text-danger-600': daysUntilRegDeadline !== undefined && daysUntilRegDeadline < 0,
                        'text-amber-700': daysUntilRegDeadline !== undefined && daysUntilRegDeadline <= 7,
                        'text-teal-700': daysUntilRegDeadline !== undefined && daysUntilRegDeadline > 7,
                      })}
                    >
                      {formatDate(task.regulatoryDeadline, true)} · {daysUntilRegDeadline !== undefined ? `${daysUntilRegDeadline > 0 ? '剩' : '逾期'}${Math.abs(daysUntilRegDeadline)}天` : '—'}
                    </span>
                  </MetaItem>
                </>
              )}
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
              {task.blocked && (
                <span className="text-[11px] text-danger-600 font-medium flex items-center gap-1">
                  <Lock className="w-3 h-3" /> 前置任务未完成，操作已禁用
                </span>
              )}
              {!task.blocked && task.status === 'NOT_STARTED' && isAssignee && (
                <button
                  className="btn btn-cobalt text-[12px]"
                  onClick={() => onStatusChange('IN_PROGRESS')}
                >
                  开始处理
                </button>
              )}
              {!task.blocked && task.status === 'IN_PROGRESS' && isAssignee && (
                <button
                  className="btn btn-soft text-[12px]"
                  onClick={() => onStatusChange('IN_REVIEW')}
                >
                  <Send className="w-3.5 h-3.5" /> 提交复核
                </button>
              )}
              {!task.blocked && task.status === 'NEEDS_INFO' && isAssignee && (
                <>
                  <button
                    className="btn btn-cobalt text-[12px]"
                    onClick={() => onStatusChange('IN_PROGRESS')}
                  >
                    重新开始处理
                  </button>
                  <button
                    className="btn btn-soft text-[12px]"
                    onClick={() => onStatusChange('IN_REVIEW')}
                  >
                    <Send className="w-3.5 h-3.5" /> 补充后提交复核
                  </button>
                </>
              )}
              {!task.blocked && task.status === 'IN_REVIEW' && isReviewer && (
                <>
                  <button
                    className="btn btn-primary text-[12px]"
                    onClick={() => reviewTask(task.id, 'APPROVED')}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" /> 通过
                  </button>
                  <button
                    className="btn btn-danger text-[12px]"
                    onClick={() => setTab('evidence')}
                  >
                    <XCircle className="w-3.5 h-3.5" /> 退回
                  </button>
                </>
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
          {canComment && (
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
          )}

          {canEditMedical && (
            <div className="mt-6 pt-4 border-t border-ink-900/5">
              <h3 className="font-display text-[14px] font-semibold mb-3">内部结论</h3>
              <textarea
                className="field-textarea min-h-[150px]"
                value={medicalOpinion}
                onChange={(e) => setMedicalOpinion(e.target.value)}
                placeholder="在此记录处理进展、内部结论或行动项。例如：已与首诊医生取得联系，确认患者在用药前 6 个月内未使用其他肝毒性药物。下一步将补充 ALT 趋势图。"
              />
              <div className="mt-2 flex items-center gap-2">
                <button onClick={onSaveMedical} className="btn btn-soft text-[12px]">
                  <CheckCircle2 className="w-3.5 h-3.5" /> 保存结论
                </button>
                <span className="text-[11px] text-ink-500">保存后写入审计日志</span>
              </div>
            </div>
          )}
        </section>
      )}

      {tab === 'followup' && (
        <section className="surface p-5 max-w-3xl">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display text-[15px] font-semibold">随访管理</h3>
            {(me.role === 'PM' || me.role === 'PROCESSOR' || me.role === 'ADMIN') && (
              <button onClick={onCreateFollowUp} className="btn btn-primary text-[12px]">
                <Plus className="w-3.5 h-3.5" /> 创建随访任务
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="rounded-lg bg-ink-900/[0.02] border border-ink-900/5 p-3.5">
              <div className="text-[10.5px] uppercase tracking-widest text-ink-500 mb-1">随访状态</div>
              <select
                className="field-select py-1.5 text-[12px] w-full"
                value={followUpStatus}
                onChange={(e) => setFollowUpStatus(e.target.value as FollowUpStatus)}
                disabled={!canEditFollowUpStatus}
              >
                <option value="NONE">无需随访</option>
                <option value="PENDING">待随访</option>
                <option value="COMPLETED">已完成随访</option>
              </select>
            </div>
            <div className="rounded-lg bg-ink-900/[0.02] border border-ink-900/5 p-3.5">
              <div className="text-[10.5px] uppercase tracking-widest text-ink-500 mb-1">当前轮次</div>
              <div className="text-[13px] font-semibold text-ink-800">第 {task.followUpRound} 轮</div>
            </div>
            <div className="rounded-lg bg-ink-900/[0.02] border border-ink-900/5 p-3.5">
              <div className="text-[10.5px] uppercase tracking-widest text-ink-500 mb-1">总随访轮次</div>
              <div className="text-[13px] font-semibold text-ink-800">{project?.followUpCount ?? 0} 轮</div>
            </div>
          </div>

          {canEditFollowUpStatus && (
            <button onClick={onSaveFollowUp} className="btn btn-ghost text-[12px] mb-5">
              保存随访状态
            </button>
          )}

          {canEditFollowUpRecords && (
            <div className="rounded-lg border border-dashed border-cobalt-200 bg-cobalt-50/30 p-4 mb-6">
              <h4 className="text-[12.5px] font-semibold text-ink-800 mb-3">添加随访记录</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="field">
                  <label className="field-label text-[11px]">随访日期</label>
                  <input
                    type="date"
                    className="field-input text-[12px]"
                    value={newFollowUpDate}
                    onChange={(e) => setNewFollowUpDate(e.target.value)}
                  />
                </div>
                <div className="field">
                  <label className="field-label text-[11px]">随访记录</label>
                  <textarea
                    className="field-textarea text-[12px]"
                    value={newFollowUpNote}
                    onChange={(e) => setNewFollowUpNote(e.target.value)}
                    placeholder="记录随访结果、患者状态等"
                  />
                </div>
              </div>
              <button onClick={onAddFollowUp} className="btn btn-primary text-[12px] mt-3">
                添加随访记录
              </button>
            </div>
          )}

          <div>
            <h4 className="text-[12.5px] font-semibold text-ink-800 mb-3">随访任务列表</h4>
            {followUpTasks.length === 0 ? (
              <div className="text-center py-6 text-[12px] text-ink-500 rounded-lg border border-dashed border-ink-200">
                暂无随访任务，点击右上角创建
              </div>
            ) : (
              <div className="space-y-2">
                {followUpTasks
                  .sort((a, b) => b.followUpRound - a.followUpRound)
                  .map((ft) => (
                    <div
                      key={ft.id}
                      className="rounded-lg border border-ink-900/5 p-3.5 hover:border-cobalt-200 transition-colors cursor-pointer"
                      onClick={() => navigate(`/tasks/${ft.id}`)}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="chip chip-mono bg-cobalt-50 text-cobalt-700 border-cobalt-200 text-[11px]">
                            随访-{ft.followUpRound}
                          </span>
                          <span className="text-[13px] font-medium text-ink-800">{ft.title.replace(/\[随访-\d+\]\s*/g, '')}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {ft.blocked && (
                            <span className="chip text-[10px] bg-danger-50 text-danger-700 border-danger-200">
                              阻塞
                            </span>
                          )}
                          <StatusBadge status={ft.status} />
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-[11.5px] text-ink-500">
                        <span>截止：{formatDate(ft.dueAt, true)}</span>
                        <span>负责人：{users.find((u) => u.id === ft.assigneeId)?.name ?? '待分配'}</span>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>

          <div className="mt-6">
            <h4 className="text-[12.5px] font-semibold text-ink-800 mb-3">当前任务随访记录</h4>
            {followUpRecords.length === 0 ? (
              <div className="text-center py-4 text-[12px] text-ink-500">暂无随访记录</div>
            ) : (
              <ul className="space-y-3">
                {followUpRecords.map((record) => (
                  <li key={record.id} className="rounded-lg border border-ink-900/5 p-3.5">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-mono text-[12px] text-cobalt-600">{formatDate(record.date, true)}</span>
                      <span className="chip text-[10px] bg-teal-50 text-teal-700">已完成</span>
                    </div>
                    <p className="text-[12px] text-ink-700 leading-relaxed">{record.note}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}

      {tab === 'medical' && (
        <section className="surface p-5 max-w-3xl">
          <h3 className="font-display text-[15px] font-semibold mb-4">医学评估</h3>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
            <KeyField label="Day 0" value={task.dayZero ? formatDate(task.dayZero) : '—'} />
            <KeyField label="严重性" value={task.severity ?? '—'} />
            <KeyField label="是否严重" value={task.seriousness === 'SERIOUS' ? '严重' : task.seriousness === 'NON_SERIOUS' ? '非严重' : '—'} />
            <KeyField label="风险等级" value={<RiskTag level={task.riskLevel} />} />
          </div>

          <div className="space-y-5">
            <div>
              <h4 className="font-display text-[14px] font-semibold mb-3">严重性评估</h4>
              <div className="flex flex-wrap gap-4">
                {(['SERIOUS', 'NON_SERIOUS'] as const).map((val) => (
                  <label key={val} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="seriousness"
                      value={val}
                      checked={seriousness === val}
                      onChange={(e) => setSeriousness(e.target.value as Task['seriousness'])}
                      disabled={!canEditMedical}
                      className="w-4 h-4"
                    />
                    <span className="text-[13px] text-ink-700">
                      {val === 'SERIOUS' ? '严重' : '非严重'}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <h4 className="font-display text-[14px] font-semibold mb-3">严重程度</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {(['MILD', 'MODERATE', 'SEVERE', 'LIFE_THREATENING'] as const).map((val) => (
                  <label key={val} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="severity"
                      value={val}
                      checked={severity === val}
                      onChange={(e) => setSeverity(e.target.value as Task['severity'])}
                      disabled={!canEditMedical}
                      className="w-4 h-4"
                    />
                    <span className="text-[13px] text-ink-700">
                      {val === 'MILD' ? '轻度' : val === 'MODERATE' ? '中度' : val === 'SEVERE' ? '重度' : '危及生命'}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <h4 className="font-display text-[14px] font-semibold mb-3">因果关系评估</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {(Object.keys(CAUSALITY_LABEL) as Causality[]).map((val) => (
                  <label key={val} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="causality"
                      value={val}
                      checked={causality === val}
                      onChange={(e) => setCausality(e.target.value as Causality)}
                      disabled={!canEditMedical}
                      className="w-4 h-4"
                    />
                    <span className="text-[13px] text-ink-700">{CAUSALITY_LABEL[val]}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="field">
                <label className="field-label">MedDRA PT 编码</label>
                <input
                  type="text"
                  className="field-input"
                  value={meddraPt}
                  onChange={(e) => setMeddraPt(e.target.value)}
                  placeholder="例如：10012345"
                  disabled={!canEditMedical}
                />
              </div>
              <div className="field">
                <label className="field-label">MedDRA LLT 编码</label>
                <input
                  type="text"
                  className="field-input"
                  value={meddraLlt}
                  onChange={(e) => setMeddraLlt(e.target.value)}
                  placeholder="例如：10012345"
                  disabled={!canEditMedical}
                />
              </div>
            </div>

            <div>
              <h4 className="font-display text-[14px] font-semibold mb-2.5 flex items-center gap-2">
                <Pencil className="w-3.5 h-3.5 text-cobalt-600" /> 医学审评结论
              </h4>
              <textarea
                className="field-textarea min-h-[150px]"
                value={medicalOpinion}
                onChange={(e) => setMedicalOpinion(e.target.value)}
                placeholder="由 Safety Physician 填写：因果关系评估（RUCAM 评分）、严重性、预期性、监管建议等。"
                disabled={!canEditMedical}
              />
            </div>

            <div>
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={signalFlag}
                  onChange={(e) => setSignalFlag(e.target.checked)}
                  disabled={!canEditMedical}
                  className="w-4 h-4"
                />
                <span className="text-[13px] text-ink-700 font-medium">需升级信号（标记为潜在安全性信号）</span>
              </label>
              <p className="text-[11.5px] text-ink-500 mt-1 ml-6">
                勾选后，该病例将被标记为需要进一步评估的潜在安全性信号
              </p>
            </div>

            {canEditMedical && (
              <div className="pt-4 border-t border-ink-900/5">
                <button onClick={onSaveMedicalAssessment} className="btn btn-primary text-[12px]">
                  <CheckCircle2 className="w-3.5 h-3.5" /> 保存医学评估
                </button>
                <span className="text-[11px] text-ink-500 ml-3">保存后写入审计日志</span>
              </div>
            )}
          </div>

          <div className="mt-6 rounded-xl border border-dashed border-cobalt-200 bg-cobalt-50/30 p-3.5">
            <h4 className="font-display text-[13px] font-semibold mb-2 flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-cobalt-600" /> AI 助手建议
              <Chip tone="amber" className="text-[10px]">仅草稿</Chip>
            </h4>
            <p className="text-[12px] text-ink-700 leading-relaxed">
              建议：补充肝功能基线（ALT/AST/ALP/TBIL）以增强因果关系评估的可信度。可参考 RUCAM 量表的"过去用药史"和"伴随用药"两项。
            </p>
            <p className="mt-2 text-[11px] text-ink-500">⚠ AI 输出不替代医学判断，需要 Safety Physician 确认。</p>
            <button onClick={() => navigate('/ai')} className="mt-2 btn btn-soft text-[12px]">
              生成完整分析
            </button>
          </div>
        </section>
      )}

      {tab === 'regulatory' && (
        <section className="surface p-5 max-w-3xl">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display text-[15px] font-semibold">监管提交</h3>
            {(me.role === 'PM' || me.role === 'PROCESSOR' || me.role === 'ADMIN') && (
              <button onClick={openAddSubmission} className="btn btn-primary text-[12px]">
                <Plus className="w-3.5 h-3.5" /> 添加提交记录
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="rounded-lg bg-ink-900/[0.02] border border-ink-900/5 p-4">
              <div className="text-[10.5px] uppercase tracking-widest text-ink-500 mb-2">法规截止日期</div>
              <div className="flex items-center gap-2">
                <span
                  className={cn('font-mono text-[16px] font-semibold', {
                    'text-danger-600': daysUntilRegDeadline !== undefined && daysUntilRegDeadline < 0,
                    'text-amber-700': daysUntilRegDeadline !== undefined && daysUntilRegDeadline <= 7,
                    'text-teal-700': daysUntilRegDeadline !== undefined && daysUntilRegDeadline > 7,
                  })}
                >
                  {task.regulatoryDeadline ? formatDate(task.regulatoryDeadline, true) : '未设置'}
                </span>
                {daysUntilRegDeadline !== undefined && (
                  <span className={cn('chip text-[11px]', daysUntilRegDeadline <= 7 ? 'bg-amber-50 text-amber-700' : 'bg-teal-50 text-teal-700')}>
                    {daysUntilRegDeadline > 0 ? `${daysUntilRegDeadline} 天后` : `${Math.abs(daysUntilRegDeadline)} 天前`}
                  </span>
                )}
              </div>
            </div>
            <div className="rounded-lg bg-ink-900/[0.02] border border-ink-900/5 p-4">
              <div className="text-[10.5px] uppercase tracking-widest text-ink-500 mb-2">法规规则</div>
              <div className="text-[13px] font-semibold text-ink-800">
                {project?.regulatoryRule ?? '未设置'}
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-ink-900/5 p-4 mb-6">
            <h4 className="text-[12.5px] font-semibold text-ink-800 mb-3">提交记录</h4>
            {project?.submissions && project.submissions.length > 0 ? (
              <div className="space-y-3">
                {project.submissions
                  .sort((a, b) => new Date(b.submitDate).getTime() - new Date(a.submitDate).getTime())
                  .map((sub) => (
                    <div key={sub.id} className="rounded-lg border border-ink-900/5 p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <FileCheck className="w-4 h-4 text-teal-600" />
                          <span className="text-[13px] font-semibold text-ink-800">{sub.agency}</span>
                          <span className={cn('chip text-[10px]', SUBMISSION_STATUS_TONE[sub.status])}>
                            {SUBMISSION_STATUS_LABEL[sub.status]}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          {(me.role === 'PM' || me.role === 'ADMIN' || sub.createdBy === me.id) && (
                            <>
                              <button
                                onClick={(e) => { e.stopPropagation(); openEditSubmission(sub); }}
                                className="p-1.5 text-ink-500 hover:text-cobalt-600 hover:bg-cobalt-50 rounded"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); onDeleteSubmission(sub.id); }}
                                className="p-1.5 text-ink-500 hover:text-danger-600 hover:bg-danger-50 rounded"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-[12px]">
                        <div>
                          <span className="text-ink-500">提交渠道：</span>
                          <span className="text-ink-700">{sub.channel}</span>
                        </div>
                        <div>
                          <span className="text-ink-500">提交日期：</span>
                          <span className="text-ink-700 font-mono">{formatDate(sub.submitDate, true)}</span>
                        </div>
                        <div>
                          <span className="text-ink-500">回执编号：</span>
                          <span className="text-ink-700 font-mono">{sub.receiptNo || '—'}</span>
                        </div>
                        {sub.receiptDate && (
                          <div>
                            <span className="text-ink-500">回执日期：</span>
                            <span className="text-ink-700 font-mono">{formatDate(sub.receiptDate, true)}</span>
                          </div>
                        )}
                      </div>
                      {sub.notes && (
                        <div className="mt-2 pt-2 border-t border-ink-900/5 text-[12px] text-ink-600">
                          <span className="text-ink-500">备注：</span>{sub.notes}
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            ) : (
              <div className="text-center py-6 text-[12px] text-ink-500 rounded-lg border border-dashed border-ink-200">
                暂无提交记录，点击右上角添加
              </div>
            )}
          </div>

          <div className="rounded-lg border border-dashed border-cobalt-200 bg-cobalt-50/30 p-4">
            <h4 className="text-[12.5px] font-semibold text-ink-800 mb-2">提交提醒</h4>
            <ul className="text-[12px] text-ink-600 space-y-1 list-disc pl-4">
              <li>请确保在法规截止日期前完成所有必填证据收集</li>
              <li>提交前需经过质量复核确认</li>
              <li>保留所有提交凭证，便于后续审计</li>
            </ul>
          </div>
        </section>
      )}

      {showSubmissionDialog && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="surface w-full max-w-lg rounded-xl shadow-xl">
            <div className="flex items-center justify-between p-5 border-b border-ink-900/5">
              <h3 className="font-display text-[16px] font-semibold">
                {editingSubmission ? '编辑提交记录' : '添加监管提交记录'}
              </h3>
              <button
                onClick={() => setShowSubmissionDialog(false)}
                className="text-ink-400 hover:text-ink-600"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="field">
                  <label className="field-label">监管机构 *</label>
                  <select
                    className="field-select"
                    value={submissionForm.agency}
                    onChange={(e) => setSubmissionForm({ ...submissionForm, agency: e.target.value })}
                  >
                    <option value="NMPA">NMPA</option>
                    <option value="EMA">EMA</option>
                    <option value="FDA">FDA</option>
                    <option value="PMDA">PMDA</option>
                    <option value="其他">其他</option>
                  </select>
                </div>
                <div className="field">
                  <label className="field-label">提交渠道 *</label>
                  <select
                    className="field-select"
                    value={submissionForm.channel}
                    onChange={(e) => setSubmissionForm({ ...submissionForm, channel: e.target.value })}
                  >
                    <option value="E2B">E2B</option>
                    <option value="邮件">邮件</option>
                    <option value="传真">传真</option>
                    <option value="在线门户">在线门户</option>
                    <option value="其他">其他</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="field">
                  <label className="field-label">提交日期 *</label>
                  <input
                    type="date"
                    className="field-input"
                    value={submissionForm.submitDate}
                    onChange={(e) => setSubmissionForm({ ...submissionForm, submitDate: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label className="field-label">状态 *</label>
                  <select
                    className="field-select"
                    value={submissionForm.status}
                    onChange={(e) => setSubmissionForm({ ...submissionForm, status: e.target.value as SubmissionStatus })}
                  >
                    <option value="PENDING">待提交</option>
                    <option value="SUBMITTED">已提交</option>
                    <option value="CONFIRMED">已确认</option>
                    <option value="RETURNED">被退回</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="field">
                  <label className="field-label">回执编号</label>
                  <input
                    type="text"
                    className="field-input"
                    value={submissionForm.receiptNo}
                    onChange={(e) => setSubmissionForm({ ...submissionForm, receiptNo: e.target.value })}
                    placeholder="例如：REC-2026-001"
                  />
                </div>
                <div className="field">
                  <label className="field-label">回执日期</label>
                  <input
                    type="date"
                    className="field-input"
                    value={submissionForm.receiptDate}
                    onChange={(e) => setSubmissionForm({ ...submissionForm, receiptDate: e.target.value })}
                  />
                </div>
              </div>
              <div className="field">
                <label className="field-label">备注</label>
                <textarea
                  className="field-textarea min-h-[80px]"
                  value={submissionForm.notes}
                  onChange={(e) => setSubmissionForm({ ...submissionForm, notes: e.target.value })}
                  placeholder="补充说明..."
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 p-5 border-t border-ink-900/5">
              <button
                onClick={() => setShowSubmissionDialog(false)}
                className="btn btn-ghost text-[12px]"
              >
                取消
              </button>
              <button
                onClick={onSaveSubmission}
                className="btn btn-primary text-[12px]"
              >
                <CheckCircle2 className="w-3.5 h-3.5" /> 保存
              </button>
            </div>
          </div>
        </div>
      )}

      {tab === 'evidence' && (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-5">
          <section className="surface p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-[15px] font-semibold">附件与证据</h3>
              {roleCan(me.role, 'upload') && !task.blocked && (
                <button onClick={() => onUpload()} className="btn btn-primary text-[12px]">
                  <Upload className="w-3.5 h-3.5" /> 上传附件
                </button>
              )}
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
                        {(me.id === a.uploaderId || me.role === 'PM' || me.role === 'ADMIN') && !task.blocked && (
                          <button
                            className="text-ink-500 hover:text-danger-600"
                            onClick={() => {
                              if (confirm(`确定要删除附件「${a.fileName}」吗？`)) {
                                deleteAttachment(a.id);
                              }
                            }}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
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

          <section className="surface p-5 space-y-5">
            <div>
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

              <div className="mt-4 pt-4 border-t border-ink-900/5">
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
            </div>

            <div>
              <h3 className="font-display text-[15px] font-semibold mb-3">审计日志</h3>
              <ol className="space-y-2.5 max-h-[300px] overflow-y-auto">
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
            </div>
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