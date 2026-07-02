import { useState, type DragEvent } from 'react';
import { Ban, CalendarClock, GripVertical, Inbox } from 'lucide-react';
import { useStore, roleCan } from '@/store/useStore';
import { Avatar } from '@/components/Avatar';
import { RiskTag } from '@/components/Badge';
import {
  cn,
  canTransition,
  dueUrgency,
  formatDate,
  relativeFromNow,
} from '@/lib/utils';
import { TASK_STATUS_LABEL, type Task, type TaskStatus } from '@/types';

export interface KanbanBoardProps {
  tasks: Task[];
  onTaskClick: (taskId: string) => void;
}

// 状态列顺序：从左到右
const COLUMNS: TaskStatus[] = [
  'NOT_STARTED',
  'IN_PROGRESS',
  'IN_REVIEW',
  'NEEDS_INFO',
  'DONE',
];

const COLUMN_DOT: Record<TaskStatus, string> = {
  NOT_STARTED: 'bg-ink-400',
  IN_PROGRESS: 'bg-cobalt-500',
  IN_REVIEW: 'bg-amber-500',
  NEEDS_INFO: 'bg-danger-500',
  DONE: 'bg-teal-500',
};

export function KanbanBoard({ tasks, onTaskClick }: KanbanBoardProps) {
  const me = useStore((s) => s.currentUser);
  const updateTaskStatus = useStore((s) => s.updateTaskStatus);
  const pushToast = useStore((s) => s.pushToast);

  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<TaskStatus | null>(null);
  const [pendingDrop, setPendingDrop] = useState<{ taskId: string; target: TaskStatus } | null>(null);
  const [dropReason, setDropReason] = useState('');

  const blockedTasks = tasks.filter((t) => t.blocked);
  const activeTasks = tasks.filter((t) => !t.blocked);

  const draggingTask =
    draggingId != null ? tasks.find((t) => t.id === draggingId) ?? null : null;

  const canReview = me ? roleCan(me.role, 'review') : false;

  // Bug5修复: 检查编辑权限（assignee/reviewer/PM/ADMIN）
  const canEditTask = (task: Task): boolean => {
    if (!me) return false;
    if (me.role === 'PM' || me.role === 'ADMIN') return true;
    if (task.assigneeId === me.id) return true;
    if (task.reviewerId === me.id) return true;
    return false;
  };

  // Bug3修复: 卡片是否可拖动需检查是否存在向右的有效目标
  const isCardDraggable = (task: Task): boolean => {
    if (!me || task.blocked) return false;
    if (!canEditTask(task)) return false;
    const fromIdx = COLUMNS.indexOf(task.status);
    return COLUMNS.some((c, toIdx) => toIdx > fromIdx && canTransition(task.status, c));
  };

  // 目标列是否允许放置：只允许从左向右拖拽（forward），且拖入 IN_REVIEW 需复核权限
  const isDropAllowed = (task: Task | null, target: TaskStatus): boolean => {
    if (!task || !me || task.blocked) return false;
    if (!canEditTask(task)) return false; // Bug5修复
    if (!canTransition(task.status, target)) return false;
    // PRD 5.1: 只能从左侧列拖到右侧列，不允许反向拖拽
    const fromIdx = COLUMNS.indexOf(task.status);
    const toIdx = COLUMNS.indexOf(target);
    if (toIdx <= fromIdx) return false;
    if (target === 'IN_REVIEW' && !canReview) return false;
    return true;
  };

  const handleDragStart = (e: DragEvent<HTMLDivElement>, task: Task) => {
    setDraggingId(task.id);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', task.id);
  };

  const handleDragEnd = () => {
    setDraggingId(null);
    setDragOverCol(null);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>, target: TaskStatus) => {
    if (!isDropAllowed(draggingTask, target)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverCol !== target) setDragOverCol(target);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>, target: TaskStatus) => {
    if (dragOverCol !== target) return;
    const related = e.relatedTarget as Node | null;
    if (related && e.currentTarget.contains(related)) return;
    setDragOverCol(null);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>, target: TaskStatus) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('text/plain') || draggingId;
    const task = taskId ? tasks.find((t) => t.id === taskId) : null;
    setDraggingId(null);
    setDragOverCol(null);
    if (!task || !me) return;
    if (task.status === target) return;
    if (task.blocked) {
      pushToast('error', '任务被阻塞，前置任务未完成，无法拖动');
      return;
    }
    if (!canTransition(task.status, target)) {
      pushToast('error', '该状态流转不被允许');
      return;
    }
    // PRD 5.1: 只能从左侧列拖到右侧列
    const fromIdx = COLUMNS.indexOf(task.status);
    const toIdx = COLUMNS.indexOf(target);
    if (toIdx <= fromIdx) {
      pushToast('error', '看板视图仅允许向右拖拽（推进状态）');
      return;
    }
    if (target === 'IN_REVIEW' && !canReview) {
      pushToast('error', '权限不足，仅具备复核权限的角色可拖入「待复核」列');
      return;
    }
    // PRD 5.1: 拖拽到「待复核」和「需补充」列时，弹窗要求填写说明
    if (target === 'IN_REVIEW' || target === 'NEEDS_INFO') {
      setPendingDrop({ taskId: task.id, target });
      setDropReason('');
      return;
    }
    updateTaskStatus(task.id, target);
  };

  const confirmDrop = () => {
    if (!pendingDrop) return;
    updateTaskStatus(pendingDrop.taskId, pendingDrop.target, dropReason || undefined);
    setPendingDrop(null);
    setDropReason('');
  };

  const dueTone = (iso: string, isDone: boolean) => {
    if (isDone) return 'text-ink-500';
    const u = dueUrgency(iso);
    if (u === 'overdue') return 'text-danger-600 font-semibold';
    if (u === 'today' || u === 'soon') return 'text-amber-700';
    return 'text-ink-600';
  };

  const renderCard = (task: Task, draggable: boolean) => {
    const isDragging = draggingId === task.id;
    const isDone = task.status === 'DONE';
    return (
      <div
        key={task.id}
        draggable={draggable}
        onDragStart={draggable ? (e) => handleDragStart(e, task) : undefined}
        onDragEnd={draggable ? handleDragEnd : undefined}
        onClick={() => onTaskClick(task.id)}
        className={cn(
          'group surface p-2.5 rounded-xl transition-all',
          'hover:shadow-pop hover:-translate-y-0.5',
          draggable ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer',
          isDragging && 'opacity-40 ring-2 ring-cobalt-400',
        )}
      >
        <div className="flex items-start gap-1.5">
          {draggable && (
            <GripVertical className="w-3.5 h-3.5 text-ink-300 mt-0.5 shrink-0 group-hover:text-ink-500" />
          )}
          <div className="min-w-0 flex-1">
            <div className="text-[12.5px] font-medium text-ink-900 line-clamp-2 leading-snug">
              {task.title}
            </div>
          </div>
          {task.blocked && (
            <span className="chip bg-danger-500/10 text-danger-700 border-danger-500/30 shrink-0">
              <Ban className="w-3 h-3" />
              阻塞
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1.5 mt-2">
          <Avatar userId={task.assigneeId} size={20} />
          <RiskTag level={task.riskLevel} />
          <div className="ml-auto flex items-center gap-1 text-[11px] shrink-0">
            <CalendarClock className="w-3 h-3 text-ink-400" />
            <span className={cn('font-mono', dueTone(task.dueAt, isDone))}>
              {formatDate(task.dueAt)}
            </span>
          </div>
        </div>
        <div className="text-[10.5px] text-ink-400 mt-1">
          {relativeFromNow(task.dueAt)}
        </div>
      </div>
    );
  };

  const renderColumn = (status: TaskStatus) => {
    const colTasks = activeTasks.filter((t) => t.status === status);
    const isHover = dragOverCol === status;
    return (
      <div
        key={status}
        onDragOver={(e) => handleDragOver(e, status)}
        onDragLeave={(e) => handleDragLeave(e, status)}
        onDrop={(e) => handleDrop(e, status)}
        className={cn(
          'surface flex flex-col min-h-[200px] transition-all',
          isHover && 'ring-2 ring-cobalt-400 bg-cobalt-50/50',
        )}
      >
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-ink-100">
          <div className="flex items-center gap-2">
            <span className={cn('dot', COLUMN_DOT[status])} />
            <span className="text-[12.5px] font-semibold text-ink-800">
              {TASK_STATUS_LABEL[status]}
            </span>
          </div>
          <span className="chip chip-mono bg-ink-100 text-ink-600 border-ink-200">
            {colTasks.length}
          </span>
        </div>
        <div className="flex flex-col gap-2 p-2 overflow-y-auto scrollbar-thin max-h-[60vh] min-h-[120px] flex-1">
          {colTasks.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-[11px] text-ink-400 py-6">
              <Inbox className="w-3.5 h-3.5 mr-1" /> 暂无任务
            </div>
          ) : (
            colTasks.map((t) => renderCard(t, isCardDraggable(t)))
          )}
        </div>
      </div>
    );
  };

  const renderBlockedSection = () => {
    if (blockedTasks.length === 0) return null;
    return (
      <div className="surface p-3">
        <div className="flex items-center gap-2 mb-2">
          <Ban className="w-4 h-4 text-danger-600" />
          <span className="text-[12.5px] font-semibold text-ink-800">
            阻塞任务
          </span>
          <span className="chip chip-mono bg-danger-500/10 text-danger-700 border-danger-500/30">
            {blockedTasks.length}
          </span>
          <span className="text-[11px] text-ink-400 ml-1">
            前置任务未完成，暂不可拖动
          </span>
        </div>
        <div className="flex gap-2 overflow-x-auto scrollbar-thin pb-1">
          {blockedTasks.map((t) => (
            <div key={t.id} className="w-[230px] shrink-0">
              {renderCard(t, false)}
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-3">
      {renderBlockedSection()}
      <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-3">
        {COLUMNS.map(renderColumn)}
      </div>

      {/* 拖拽说明弹窗 */}
      {pendingDrop && (
        <div className="fixed inset-0 bg-ink-900/40 flex items-center justify-center z-50" onClick={() => setPendingDrop(null)}>
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="p-5">
              <h3 className="font-display text-[14px] font-semibold mb-2">
                {pendingDrop.target === 'IN_REVIEW' ? '提交复核说明' : '需补充说明'}
              </h3>
              <textarea
                className="field-input text-[12px] min-h-[80px] mt-2"
                placeholder="请输入说明（可选）..."
                value={dropReason}
                onChange={(e) => setDropReason(e.target.value)}
              />
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-ink-900/5">
              <button onClick={() => setPendingDrop(null)} className="btn btn-ghost text-[12px]">取消</button>
              <button onClick={confirmDrop} className="btn btn-primary text-[12px]">确认</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
