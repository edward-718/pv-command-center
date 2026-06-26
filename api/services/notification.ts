/**
 * 通知服务
 * - 生成时限提醒通知
 * - 逾期通知
 * - 复核结果通知
 * - 支持模板自定义提醒阈值
 */
import pvStore from '../store.js';
import { getUserById, type AuthUser } from '../middleware/auth.js';

type Notification = {
  id: string;
  userId: string;
  source: string;
  category: 'DEADLINE' | 'OVERDUE' | 'REVIEW' | 'EVIDENCE' | 'SYSTEM';
  content: string;
  status: 'UNREAD' | 'READ';
  createdAt: string;
};

type TaskRecord = {
  id: string;
  projectId: string;
  title: string;
  status: string;
  priority: string;
  riskLevel: string;
  assigneeId: string;
  dueAt: string;
  createdAt: string;
  updatedAt: string;
};

type Template = {
  id: string;
  reminderThresholds: number[];
};

type ProjectRecord = {
  id: string;
  templateId: string;
};

/**
 * 获取项目的提醒阈值
 */
function getReminderThresholds(projectId: string): number[] {
  const project = (pvStore.projects as ProjectRecord[]).find((p) => p.id === projectId);
  if (!project) return [7, 3, 1]; // 默认阈值

  const template = (pvStore.templates as Template[]).find((t) => t.id === project.templateId);
  return template?.reminderThresholds || [7, 3, 1];
}

/**
 * 检查任务时限并生成通知
 */
export function checkTaskDeadlines(): void {
  const now = Date.now();
  const tasks = Array.from(pvStore.tasks.values()) as TaskRecord[];

  tasks.forEach((task) => {
    if (task.status === 'DONE') return;

    const due = new Date(task.dueAt).getTime();
    const daysUntilDue = Math.ceil((due - now) / (24 * 60 * 60 * 1000));
    const thresholds = getReminderThresholds(task.projectId);

    // 逾期通知（仅生成一次）
    if (daysUntilDue < 0) {
      const existingNotification = (pvStore.notifications as Notification[]).find(
        (n) => n.source === task.id && n.category === 'OVERDUE'
      );
      if (!existingNotification) {
        createNotification({
          userId: task.assigneeId,
          source: task.id,
          category: 'OVERDUE',
          content: `任务「${task.title}」已逾期 ${Math.abs(daysUntilDue)} 天，请尽快处理。`,
        });
      }
    }

    // 按阈值生成到期提醒
    thresholds.forEach((threshold) => {
      if (daysUntilDue === threshold) {
        const existingNotification = (pvStore.notifications as Notification[]).find(
          (n) => n.source === task.id && n.category === 'DEADLINE' && n.content.includes(`${threshold}天`)
        );
        if (!existingNotification && task.status !== 'IN_REVIEW') {
          createNotification({
            userId: task.assigneeId,
            source: task.id,
            category: 'DEADLINE',
            content: `任务「${task.title}」还有 ${threshold} 天到期，请关注进度。`,
          });
        }
      }
    });

    // 今日到期提醒
    if (daysUntilDue === 0 && task.status !== 'IN_REVIEW') {
      const existingNotification = (pvStore.notifications as Notification[]).find(
        (n) => n.source === task.id && n.category === 'DEADLINE' && n.content.includes('今日到期')
      );
      if (!existingNotification) {
        createNotification({
          userId: task.assigneeId,
          source: task.id,
          category: 'DEADLINE',
          content: `任务「${task.title}」今日到期，请尽快完成。`,
        });
      }
    }
  });
}

/**
 * 证据缺失提醒
 */
export function checkEvidenceCompleteness(): void {
  const tasks = Array.from(pvStore.tasks.values()) as TaskRecord[];

  tasks.forEach((task) => {
    if (task.status === 'DONE' || task.status === 'IN_REVIEW') return;

    const taskData = pvStore.tasks.get(task.id) as Record<string, unknown> | undefined;
    if (!taskData) return;

    const requiredEvidence = (taskData.requiredEvidence as string[]) || [];
    const evidenceUploaded = (taskData.evidenceUploaded as string[]) || [];

    if (requiredEvidence.length === 0) return;

    const missing = requiredEvidence.filter((e) => !evidenceUploaded.includes(e));
    if (missing.length > 0) {
      // 距离到期 3 天内且证据未完成，提醒
      const now = Date.now();
      const due = new Date(task.dueAt).getTime();
      const daysUntilDue = Math.ceil((due - now) / (24 * 60 * 60 * 1000));

      if (daysUntilDue <= 3 && daysUntilDue >= 0) {
        const existingNotification = (pvStore.notifications as Notification[]).find(
          (n) => n.source === task.id && n.category === 'EVIDENCE'
        );
        if (!existingNotification) {
          createNotification({
            userId: task.assigneeId,
            source: task.id,
            category: 'EVIDENCE',
            content: `任务「${task.title}」缺少必填证据：${missing.join('、')}。`,
          });
        }
      }
    }
  });
}

/**
 * 创建复核结果通知
 */
export function notifyReviewResult(taskId: string, taskTitle: string, decision: 'APPROVED' | 'RETURNED', reason?: string): void {
  const task = pvStore.tasks.get(taskId) as TaskRecord | undefined;
  if (!task) return;

  if (decision === 'APPROVED') {
    createNotification({
      userId: task.assigneeId,
      source: taskId,
      category: 'REVIEW',
      content: `任务「${taskTitle}」已通过复核。`,
    });
  } else {
    createNotification({
      userId: task.assigneeId,
      source: taskId,
      category: 'REVIEW',
      content: `任务「${taskTitle}」被退回，需要补充材料。${reason ? `原因：${reason}` : ''}`,
    });
  }
}

/**
 * 创建通知
 */
function createNotification(params: {
  userId: string;
  source: string;
  category: Notification['category'];
  content: string;
}): void {
  const notification: Notification = {
    id: `n-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    userId: params.userId,
    source: params.source,
    category: params.category,
    content: params.content,
    status: 'UNREAD',
    createdAt: new Date().toISOString(),
  };
  (pvStore.notifications as unknown[]).unshift(notification);
  pvStore.save();
}

/**
 * 获取未读通知数量
 */
export function getUnreadCount(userId: string): number {
  return (pvStore.notifications as Notification[]).filter(
    (n) => n.userId === userId && n.status === 'UNREAD'
  ).length;
}

/**
 * 获取用户的各项通知数量
 */
export function getNotificationCounts(userId: string): {
  total: number;
  unread: number;
  overdue: number;
  deadline: number;
  review: number;
  evidence: number;
} {
  const userNotifications = (pvStore.notifications as Notification[]).filter((n) => n.userId === userId);
  return {
    total: userNotifications.length,
    unread: userNotifications.filter((n) => n.status === 'UNREAD').length,
    overdue: userNotifications.filter((n) => n.category === 'OVERDUE').length,
    deadline: userNotifications.filter((n) => n.category === 'DEADLINE').length,
    review: userNotifications.filter((n) => n.category === 'REVIEW').length,
    evidence: userNotifications.filter((n) => n.category === 'EVIDENCE').length,
  };
}
